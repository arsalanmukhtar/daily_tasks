import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/allowlist_entry.dart';
import '../../../data/models/attendance_record.dart';
import '../../../data/models/leave_request.dart';
import '../../../data/providers.dart';

/// The day the Attendance sub-tab is currently showing/marking - defaults
/// to today, changed via the roster screen's date navigator.
final selectedDayProvider = StateProvider<DateTime>((ref) => DateTime.now());

/// Keyed by a record (not DateTimeRange, which has no useful equality for
/// provider-family caching) - every manual attendance mark in [start, end]
/// inclusive. Backs both the single-day roster (start == end) and the
/// Stats sub-tab's whole selected Period.
final attendanceRangeProvider = StreamProvider.family<List<AttendanceRecord>, (DateTime start, DateTime end)>(
  (ref, range) => ref.watch(attendanceRepositoryProvider).watchRange(range.$1, range.$2),
);

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

enum AttendanceStatus { present, absent, late, nightDuty, onDuty, onLeave, unmarked }

/// The 5 manually-markable statuses, in the order they're offered in
/// AttendanceMarkSheet - onLeave/unmarked are never written, only derived
/// (see resolveAttendanceStatus below).
const manualAttendanceStatuses = [
  AttendanceStatus.present,
  AttendanceStatus.late,
  AttendanceStatus.absent,
  AttendanceStatus.nightDuty,
  AttendanceStatus.onDuty,
];

/// (label, foreground, background) for a StatusChip - reuses the same
/// filled-pill widget every other status/type/duration chip in this app
/// already uses, keyed to the closest matching existing AppColors role
/// rather than inventing a new palette: Present/Absent/Late reuse the
/// leave-request status colors, Night Duty/On Duty reuse two otherwise-
/// unused type-family colors (foreignTrip's blue / umrah's teal) so they
/// read as clearly distinct from the 3 correction-style statuses, On Leave
/// reuses the neutral `meta` role, Unmarked reuses `statusWithdrawn` (also a
/// neutral, but visually the "nothing happened yet" gray).
extension AttendanceStatusPresentation on AttendanceStatus {
  String get label => switch (this) {
        AttendanceStatus.present => 'Present',
        AttendanceStatus.absent => 'Absent',
        AttendanceStatus.late => 'Late',
        AttendanceStatus.nightDuty => 'Night Duty',
        AttendanceStatus.onDuty => 'On Duty',
        AttendanceStatus.onLeave => 'On Leave',
        AttendanceStatus.unmarked => 'Unmarked',
      };

  Color get foreground => switch (this) {
        AttendanceStatus.present => AppColors.statusApproved,
        AttendanceStatus.absent => AppColors.statusRejected,
        AttendanceStatus.late => AppColors.statusRequested,
        AttendanceStatus.nightDuty => AppColors.typeForeignTrip,
        AttendanceStatus.onDuty => AppColors.typeUmrah,
        AttendanceStatus.onLeave => AppColors.meta,
        AttendanceStatus.unmarked => AppColors.statusWithdrawn,
      };

  Color get background => switch (this) {
        AttendanceStatus.present => AppColors.statusApprovedBg,
        AttendanceStatus.absent => AppColors.statusRejectedBg,
        AttendanceStatus.late => AppColors.statusRequestedBg,
        AttendanceStatus.nightDuty => AppColors.typeForeignTripBg,
        AttendanceStatus.onDuty => AppColors.typeUmrahBg,
        AttendanceStatus.onLeave => AppColors.metaBg,
        AttendanceStatus.unmarked => AppColors.statusWithdrawnBg,
      };

  /// The exact string the server's `status` column/API expects - only
  /// meaningful for the 5 manual statuses above (enum name == server value
  /// for present/absent/late; the other two are explicit here since Dart's
  /// enum .name for `nightDuty`/`onDuty` is camelCase, not snake_case).
  String get apiValue => switch (this) {
        AttendanceStatus.nightDuty => 'night_duty',
        AttendanceStatus.onDuty => 'on_duty',
        _ => name,
      };
}

/// A manual Present/Absent/Late mark always wins over a derived On Leave
/// day (covers a manager correcting a record after the fact). Absent a
/// manual mark, a day covered by an *approved* leave request - reusing
/// LeaveRequest.leaveDays, which already handles the Custom-pick-vs-range
/// distinction correctly, so that logic isn't duplicated here - shows as
/// On Leave; otherwise the day is Unmarked (excluded from stats, per the
/// product decision recorded in PROJECT.md's Team-feature plan).
AttendanceStatus resolveAttendanceStatus({
  required String email,
  required DateTime date,
  required List<AttendanceRecord> attendanceOnDate,
  required List<LeaveRequest> approvedLeaveRequests,
}) {
  for (final a in attendanceOnDate) {
    if (a.email != email || !_sameDay(a.date, date)) continue;
    return switch (a.status) {
      'present' => AttendanceStatus.present,
      'late' => AttendanceStatus.late,
      'night_duty' => AttendanceStatus.nightDuty,
      'on_duty' => AttendanceStatus.onDuty,
      _ => AttendanceStatus.absent,
    };
  }
  final onLeave = approvedLeaveRequests.any(
    (r) => r.email == email && r.leaveDays.any((d) => _sameDay(d, date)),
  );
  return onLeave ? AttendanceStatus.onLeave : AttendanceStatus.unmarked;
}

/// Same shape as manager_providers.dart's LeaveRequestSearch/
/// UninformedLeaveSearch - shared free-text search over the roster, used by
/// the Directory sub-tab against the same globalSearchQueryProvider every
/// other manager tab already reads.
extension TeamDirectorySearch on AllowlistEntry {
  bool matchesQuery(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return name.toLowerCase().contains(q) ||
        email.toLowerCase().contains(q) ||
        designation.toLowerCase().contains(q) ||
        domain.toLowerCase().contains(q);
  }
}
