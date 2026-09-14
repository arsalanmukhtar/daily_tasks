import '../../core/api/api_client.dart';
import '../../core/api/realtime_client.dart';
import '../../core/api/watch_resource.dart';
import '../models/attendance_record.dart';

/// Manager-marked present/absent/late rows - GET/PUT/DELETE
/// /api/attendance. "On Leave" is never fetched here - see
/// team_providers.dart's resolveAttendanceStatus, which derives it from the
/// already-loaded leave_requests list instead.
class AttendanceRepository {
  AttendanceRepository({required ApiClient apiClient, required this._realtime}) : _api = apiClient;

  final ApiClient _api;
  final RealtimeClient _realtime;

  String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<List<AttendanceRecord>> _fetchRange(DateTime start, DateTime end) async {
    final json = await _api.get('/attendance?start=${_iso(start)}&end=${_iso(end)}') as List<dynamic>;
    return json.map((e) => AttendanceRecord.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Refetches on any 'attendance' broadcast - same "REST + WebSocket ping"
  /// pattern as LeaveRepository.watchAllRequests(). Callers key a provider
  /// family on (start, end), so switching the selected day/Period fetches
  /// the new range.
  Stream<List<AttendanceRecord>> watchRange(DateTime start, DateTime end) => watchResource(
        realtime: _realtime,
        resourceName: 'attendance',
        fetch: () => _fetchRange(start, end),
      );

  Future<AttendanceRecord> mark(
    String email,
    DateTime date, {
    required String status,
    String note = '',
    String? arrivalTime,
  }) async {
    final json = await _api.put(
      '/attendance/${Uri.encodeComponent(email)}/${_iso(date)}',
      {'status': status, 'note': note, if (arrivalTime != null) 'arrivalTime': arrivalTime},
    ) as Map<String, dynamic>;
    return AttendanceRecord.fromJson(json);
  }

  /// Marks 'on_duty' across a contiguous range in one call instead of one
  /// PUT per day - see server/src/routes/attendance.js's PUT /:email/range.
  /// Returns which dates actually got marked vs. skipped (already covered
  /// by an approved leave), so the caller can tell the manager e.g. "4 of 5
  /// marked, 1 already on leave".
  Future<({List<String> marked, List<String> skipped})> markRange(
    String email, {
    required DateTime start,
    required DateTime end,
    String note = '',
  }) async {
    final json = await _api.put('/attendance/${Uri.encodeComponent(email)}/range', {
      'startDate': _iso(start),
      'endDate': _iso(end),
      'status': 'on_duty',
      'note': note,
    }) as Map<String, dynamic>;
    return (
      marked: (json['marked'] as List<dynamic>).cast<String>(),
      skipped: (json['skipped'] as List<dynamic>).cast<String>(),
    );
  }

  Future<void> unmark(String email, DateTime date) =>
      _api.delete('/attendance/${Uri.encodeComponent(email)}/${_iso(date)}');
}
