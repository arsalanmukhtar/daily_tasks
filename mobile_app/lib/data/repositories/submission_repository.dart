import '../../core/api/api_client.dart';
import '../../core/api/realtime_client.dart';
import '../../core/api/watch_resource.dart';
import '../models/submission.dart';

/// Mirrors app.js's submitWeek_()/fetchUserSubmissions_(), now against
/// server/src/routes/submissions.js instead of Firestore.
class SubmissionRepository {
  SubmissionRepository({required ApiClient apiClient, required this._realtime})
      : _api = apiClient;

  final ApiClient _api;
  final RealtimeClient _realtime;

  Future<List<Submission>> _fetchMine() async {
    final json = await _api.get('/submissions/mine') as List<dynamic>;
    return json.map((e) => Submission.fromJson(e as Map<String, dynamic>)).toList();
  }

  Stream<List<Submission>> watchMySubmissions(String email) {
    return watchResource(realtime: _realtime, resourceName: 'submissions', fetch: _fetchMine);
  }

  /// Self-service only (`email` is always the caller's own - /mine is
  /// always self-scoped server-side regardless of role) - finds one week in
  /// the caller's own submissions rather than a dedicated single-week
  /// route, same "filter the already-fetched list" approach used elsewhere
  /// in this rewire.
  Future<Submission?> fetchByWeekLabel(String email, String weekLabel) async {
    final mine = await _fetchMine();
    for (final submission in mine) {
      if (submission.weekLabel == weekLabel) return submission;
    }
    return null;
  }

  /// Upserts by `(email, weekLabel)` server-side - resubmitting the same
  /// week overwrites it in place, same as the web app.
  Future<void> submitWeek({
    required String email,
    required String name,
    required String designation,
    required String reportedTo,
    required String domain,
    required String weekLabel,
    required String weekRange,
    required List<TaskRow> taskRows,
  }) {
    return _api.put('/submissions/${Uri.encodeComponent(weekLabel)}', {
      'name': name,
      'designation': designation,
      'reportedTo': reportedTo,
      'domain': domain,
      'weekRange': weekRange,
      'taskRows': taskRows.map((r) => r.toMap()).toList(),
    });
  }
}
