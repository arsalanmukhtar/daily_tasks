import '../../core/api/api_client.dart';
import '../../core/api/realtime_client.dart';
import '../../core/api/watch_resource.dart';
import '../models/uninformed_leave.dart';

/// uninformedLeaves operations against the self-hosted API (was Firestore) -
/// see server/src/routes/uninformedLeaves.js. Developer-facing methods
/// mirror app.js's fetchOpenUninformedReports_/submitUninformedResolution_;
/// [watchAllReports]/[report]/[resolve]/[reject] are the manager-only
/// additions for the Flutter unification (Report tab), mirroring the
/// Kotlin app's ReportViewModel/LeaveApiClient one-to-one.
class UninformedLeaveRepository {
  UninformedLeaveRepository({required ApiClient apiClient, required this._realtime})
      : _api = apiClient;

  final ApiClient _api;
  final RealtimeClient _realtime;

  Future<List<UninformedLeave>> _fetchAll() async {
    final json = await _api.get('/uninformed-leaves') as List<dynamic>;
    return json.map((e) => UninformedLeave.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Live list of this developer's own open reports (awaiting their
  /// explanation, or already explained and awaiting the manager) - the
  /// server already scopes GET /uninformed-leaves to the caller's own email
  /// for a non-owner, so this just filters to the two "still open" statuses
  /// client-side, same as app.js's fetchOpenUninformedReports_.
  Stream<List<UninformedLeave>> watchMyOpenReports(String email) {
    return watchResource(
      realtime: _realtime,
      resourceName: 'uninformedLeaves',
      fetch: () async {
        final all = await _fetchAll();
        final open = all.where((r) => r.status == 'reported' || r.status == 'explained').toList()
          ..sort((a, b) => (b.reportedAt ?? DateTime(0)).compareTo(a.reportedAt ?? DateTime(0)));
        return open;
      },
    );
  }

  /// Manager-only: every report regardless of status - the same endpoint
  /// returns everyone's rows once the caller's JWT has isOwner==true.
  Stream<List<UninformedLeave>> watchAllReports() {
    return watchResource(realtime: _realtime, resourceName: 'uninformedLeaves', fetch: _fetchAll);
  }

  Future<UninformedLeave?> fetchById(String reportId) async {
    final all = await _fetchAll();
    for (final report in all) {
      if (report.reportId == reportId) return report;
    }
    return null;
  }

  /// Submits the developer's explanation - status moves reported -> explained.
  Future<void> submitExplanation(String reportId, String explanationHtml) {
    return _api.patch('/uninformed-leaves/$reportId/explain', {'explanationHtml': explanationHtml});
  }

  /// Manager-only: flags a developer as absent without notice.
  Future<void> report({
    required String email,
    required String name,
    required DateTime date,
    required String reasonHtml,
  }) {
    return _api.post('/uninformed-leaves', {
      'email': email,
      'name': name,
      'date': date.toIso8601String().substring(0, 10),
      'reasonHtml': reasonHtml,
    });
  }

  /// Manager-only: accepts an explanation, or resolves a fresh report
  /// directly (same call for both, matching the Kotlin app's
  /// resolveUninformedLeave()) - explained|reported -> resolved. The server
  /// atomically converts this into an approved leave request in the same
  /// transaction (see uninformedLeaves.js's :id/accept route).
  Future<void> resolve(String reportId, String resolutionHtml) {
    return _api.patch('/uninformed-leaves/$reportId/accept', {'resolutionHtml': resolutionHtml});
  }

  /// Manager-only: bounces an explanation back to the developer with a note
  /// - explained -> reported.
  Future<void> reject(String reportId, String rejectionNote) {
    return _api.patch('/uninformed-leaves/$reportId/reject', {'rejectionNote': rejectionNote});
  }
}
