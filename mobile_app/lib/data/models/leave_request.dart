import 'package:cloud_firestore/cloud_firestore.dart';

import 'attachment.dart';
import 'leave_type.dart';

/// Mirrors android-app's data/LeaveRequest.kt field-for-field - this is
/// already the canonical cross-client shape (web + Kotlin app both read
/// and write exactly these fields on `leaveRequests/{requestId}`).
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

  bool get isArchived {
    if (status == 'withdrawn') return true;
    final end = endDate ?? startDate;
    if (end == null) return false;
    final today = DateTime.now();
    final endDay = DateTime(end.year, end.month, end.day);
    final todayDay = DateTime(today.year, today.month, today.day);
    return endDay.isBefore(todayDay);
  }

  factory LeaveRequest.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    DateTime? ts(String key) => (data[key] as Timestamp?)?.toDate();
    return LeaveRequest(
      requestId: doc.id,
      requestedAt: ts('requestedAt'),
      startDate: ts('startDate'),
      endDate: ts('endDate'),
      customDates: (data['customDates'] as List<dynamic>?)
              ?.whereType<Timestamp>()
              .map((t) => t.toDate())
              .toList() ??
          const [],
      email: data['email'] as String? ?? '',
      name: data['name'] as String? ?? '',
      weekLabel: data['weekLabel'] as String? ?? '',
      type: LeaveType.normalize(data['type'] as String?),
      reasonHtml: data['reasonHtml'] as String? ?? '',
      status: data['status'] as String? ?? 'requested',
      resolvedAt: ts('resolvedAt'),
      resolvedBy: data['resolvedBy'] as String? ?? '',
      attachments: (data['attachments'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(Attachment.fromMap)
              .toList() ??
          const [],
      halfDayPeriod: data['halfDayPeriod'] as String? ?? '',
      shortLeaveTime: data['shortLeaveTime'] as String? ?? '',
      checkOutTime: data['checkOutTime'] as String? ?? '',
      checkInTime: data['checkInTime'] as String? ?? '',
      decisionNote: data['decisionNote'] as String? ?? '',
      withdrawnAt: ts('withdrawnAt'),
    );
  }
}
