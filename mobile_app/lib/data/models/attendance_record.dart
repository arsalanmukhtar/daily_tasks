/// A manager-marked present/absent/late/night_duty/on_duty row - GET/PUT
/// /api/attendance's client shape (see server/src/routes/attendance.js's
/// toClientShape). There's no 'onLeave' status here - that's derived
/// client-side by cross-referencing approved leave_requests (see
/// team_providers.dart's resolveAttendanceStatus), never stored as a row.
class AttendanceRecord {
  const AttendanceRecord({
    required this.id,
    required this.email,
    required this.date,
    required this.status,
    this.note = '',
    this.arrivalTime,
    this.batchId,
    this.markedBy = '',
    this.markedAt,
    this.updatedAt,
  });

  final String id;
  final String email;
  final DateTime date;
  final String status; // 'present' | 'absent' | 'late' | 'night_duty' | 'on_duty'
  final String note;
  final String? arrivalTime; // 'HH:MM', only meaningful when status == 'late'
  final String? batchId; // shared by every row created from one On Duty range-mark
  final String markedBy;
  final DateTime? markedAt;
  final DateTime? updatedAt;

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    DateTime? dt(String key) {
      final value = json[key] as String?;
      return value == null ? null : DateTime.tryParse(value);
    }

    return AttendanceRecord(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      // The server always sends a plain 'YYYY-MM-DD' string for this field
      // (see attendance.js's to_char cast - avoids a server-timezone-
      // dependent off-by-one-day shift) - parsed as a local calendar date.
      date: DateTime.parse(json['date'] as String),
      status: json['status'] as String? ?? 'present',
      note: json['note'] as String? ?? '',
      arrivalTime: json['arrivalTime'] as String?,
      batchId: json['batchId'] as String?,
      markedBy: json['markedBy'] as String? ?? '',
      markedAt: dt('markedAt'),
      updatedAt: dt('updatedAt'),
    );
  }
}
