import 'attachment.dart';
import 'leave_type.dart';

/// Mirrors the server's leaveRequests client shape (GET/POST/PATCH
/// /api/leave-requests - see server/src/routes/leaveRequests.js's
/// toClientShape) - the same canonical cross-client shape the web app and
/// the old Kotlin app both used against Firestore's `leaveRequests/{id}`.
class LeaveRequest {
  const LeaveRequest({
    required this.requestId,
    this.requestedAt,
    this.startDate,
    this.endDate,
    this.customDates = const [],
    this.email = '',
    this.name = '',
    this.weekLabel = '',
    this.type = LeaveType.casualShort,
    this.reasonHtml = '',
    this.status = 'requested',
    this.resolvedAt,
    this.resolvedBy = '',
    this.attachments = const [],
    this.halfDayPeriod = '',
    this.shortLeaveTime = '',
    this.checkOutTime = '',
    this.checkInTime = '',
    this.decisionNote = '',
    this.withdrawnAt,
    this.dismissed = false,
  });

  final String requestId;
  final DateTime? requestedAt;
  final DateTime? startDate;
  final DateTime? endDate;
  // Only set for a Custom (non-contiguous) date pick with more than one day -
  // startDate/endDate still cover the full first-to-last span.
  final List<DateTime> customDates;
  final String email;
  final String name;
  final String weekLabel;
  final LeaveType type;
  final String reasonHtml;
  final String status; // requested | approved | rejected | withdrawn
  final DateTime? resolvedAt;
  final String resolvedBy;
  final List<Attachment> attachments;
  // 'AM' | 'PM', only meaningful when type == casualShort.
  final String halfDayPeriod;
  final String shortLeaveTime;
  // Only meaningful when type == casualOutPass.
  final String checkOutTime;
  final String checkInTime;
  // Plain text, never HTML - see PROJECT.md's rich-text note.
  final String decisionNote;
  final DateTime? withdrawnAt;
  final bool dismissed;

  bool get isArchived {
    if (status == 'withdrawn') return true;
    final end = endDate ?? startDate;
    if (end == null) return false;
    final today = DateTime.now();
    final endDay = DateTime(end.year, end.month, end.day);
    final todayDay = DateTime(today.year, today.month, today.day);
    return endDay.isBefore(todayDay);
  }

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    DateTime? dt(String key) {
      final value = json[key] as String?;
      return value == null ? null : DateTime.tryParse(value);
    }

    return LeaveRequest(
      requestId: json['requestId'] as String? ?? '',
      requestedAt: dt('requestedAt'),
      startDate: dt('startDate'),
      endDate: dt('endDate'),
      customDates: (json['customDates'] as List<dynamic>?)
              ?.whereType<String>()
              .map(DateTime.parse)
              .toList() ??
          const [],
      email: json['email'] as String? ?? '',
      name: json['name'] as String? ?? '',
      weekLabel: json['weekLabel'] as String? ?? '',
      type: LeaveType.normalize(json['type'] as String?),
      reasonHtml: json['reasonHtml'] as String? ?? '',
      status: json['status'] as String? ?? 'requested',
      resolvedAt: dt('resolvedAt'),
      resolvedBy: json['resolvedBy'] as String? ?? '',
      attachments: (json['attachments'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(Attachment.fromMap)
              .toList() ??
          const [],
      halfDayPeriod: json['halfDayPeriod'] as String? ?? '',
      shortLeaveTime: json['shortLeaveTime'] as String? ?? '',
      checkOutTime: json['checkOutTime'] as String? ?? '',
      checkInTime: json['checkInTime'] as String? ?? '',
      decisionNote: json['decisionNote'] as String? ?? '',
      withdrawnAt: dt('withdrawnAt'),
      dismissed: json['dismissed'] as bool? ?? false,
    );
  }
}
