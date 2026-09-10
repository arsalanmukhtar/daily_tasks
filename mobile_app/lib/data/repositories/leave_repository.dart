import '../../core/api/api_client.dart';
import '../../core/api/realtime_client.dart';
import '../../core/api/watch_resource.dart';
import '../models/attachment.dart';
import '../models/leave_request.dart';
import '../models/leave_type.dart';

/// leaveRequests operations against the self-hosted API (was Firestore) -
/// see server/src/routes/leaveRequests.js. Developer-facing methods mirror
/// app.js's leaveSendBtn click handler and the withdraw/dismiss flows;
/// [watchAllRequests]/[decide] are the manager-only additions for the
/// Flutter unification (Requests/Archived tabs) - the server already
/// returns every request to an owner caller from the same GET endpoint.
class LeaveRepository {
  LeaveRepository({required ApiClient apiClient, required this._realtime})
    : _api = apiClient;

  final ApiClient _api;
  final RealtimeClient _realtime;

  Future<List<LeaveRequest>> _fetchMine() async {
    final json = await _api.get('/leave-requests') as List<dynamic>;
    return json
        .map((e) => LeaveRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Live list of the signed-in developer's own requests, newest first -
  /// the server already scopes this to the caller's own email for a
  /// non-owner (see leaveRequests.js's GET route).
  Stream<List<LeaveRequest>> watchMyRequests(String email) {
    return watchResource(
      realtime: _realtime,
      resourceName: 'leaveRequests',
      fetch: _fetchMine,
    );
  }

  /// Manager-only: every developer's requests - the exact same endpoint
  /// returns everyone's rows once the caller's JWT has isOwner==true.
  Stream<List<LeaveRequest>> watchAllRequests() {
    return watchResource(
      realtime: _realtime,
      resourceName: 'leaveRequests',
      fetch: _fetchMine,
    );
  }

  /// Creates a new leave request. `customDates` should only be passed for a
  /// non-contiguous multi-date pick (see LeaveRequest.customDates doc).
  Future<String> createLeaveRequest({
    required String name,
    required LeaveType type,
    required String weekLabel,
    required DateTime startDate,
    required DateTime endDate,
    required String reasonHtml,
    List<DateTime>? customDates,
    String halfDayPeriod = '',
    String shortLeaveTime = '',
    String checkOutTime = '',
    String checkInTime = '',
  }) async {
    String isoDate(DateTime d) => d.toIso8601String().substring(0, 10);
    final payload = <String, dynamic>{
      'name': name,
      'weekLabel': weekLabel,
      'type': type.value,
      'startDate': isoDate(startDate),
      'endDate': isoDate(endDate),
      'reasonHtml': reasonHtml == '<br>' ? '' : reasonHtml,
    };
    if (customDates != null && customDates.length > 1) {
      payload['customDates'] = customDates.map(isoDate).toList();
    }
    if (type == LeaveType.casualShort) {
      payload['halfDayPeriod'] = halfDayPeriod;
      payload['shortLeaveTime'] = shortLeaveTime;
    } else if (type == LeaveType.casualOutPass) {
      payload['checkOutTime'] = checkOutTime;
      payload['checkInTime'] = checkInTime;
    }
    final result =
        await _api.post('/leave-requests', payload) as Map<String, dynamic>;
    return result['requestId'] as String;
  }

  /// Attaches uploaded file metadata right after create - a separate call
  /// because the upload itself only starts once the request (and thus
  /// requestId) already exists. Only legal while status is still
  /// "requested" - see leaveRequests.js's :id/attachments route.
  Future<void> attachFiles(String requestId, List<Attachment> attachments) {
    return _api.patch('/leave-requests/$requestId/attachments', {
      'attachments': attachments.map((a) => a.toMap()).toList(),
    });
  }

  /// Only legal while status is still "requested" - the server rejects this
  /// transition once a manager has already decided.
  Future<void> withdraw(String requestId) {
    return _api.patch('/leave-requests/$requestId/withdraw');
  }

  /// Acknowledges an already-decided request so it stops showing as "new" -
  /// does not affect status/history, purely a per-viewer flag.
  Future<void> dismiss(String requestId) {
    return _api.patch('/leave-requests/$requestId/dismiss');
  }

  /// Manager-only: approve or reject a still-pending request, with an
  /// optional decision note (plain text, never HTML - see
  /// LeaveRequest.decisionNote's doc comment). Mirrors the Kotlin app's
  /// LeaveApiClient.decideLeave().
  Future<void> decide(String requestId, {required bool approve, String? note}) {
    return _api.patch('/leave-requests/$requestId/decide', {
      'decision': approve ? 'approved' : 'rejected',
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
  }
}
