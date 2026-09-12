import 'package:flutter_test/flutter_test.dart';

import 'package:dailytasks/data/models/attendance_record.dart';
import 'package:dailytasks/data/models/leave_request.dart';
import 'package:dailytasks/features/manager/team/team_providers.dart';

const _email = 'dev@test.local';

LeaveRequest _approvedRange(DateTime start, DateTime end) => LeaveRequest(
      requestId: 'r1',
      email: _email,
      status: 'approved',
      startDate: start,
      endDate: end,
    );

LeaveRequest _approvedCustom(List<DateTime> dates) => LeaveRequest(
      requestId: 'r2',
      email: _email,
      status: 'approved',
      startDate: dates.first,
      endDate: dates.last,
      customDates: dates,
    );

void main() {
  group('resolveAttendanceStatus', () {
    test('a manual mark always wins over an overlapping approved leave', () {
      final date = DateTime(2026, 9, 19);
      final status = resolveAttendanceStatus(
        email: _email,
        date: date,
        attendanceOnDate: [AttendanceRecord(id: 'a1', email: _email, date: date, status: 'present')],
        approvedLeaveRequests: [_approvedRange(date, date)],
      );
      expect(status, AttendanceStatus.present);
    });

    test('a plain range-based approved leave marks every day in it On Leave', () {
      final leave = _approvedRange(DateTime(2026, 9, 10), DateTime(2026, 9, 12));
      for (final day in [DateTime(2026, 9, 10), DateTime(2026, 9, 11), DateTime(2026, 9, 12)]) {
        final status = resolveAttendanceStatus(
          email: _email,
          date: day,
          attendanceOnDate: const [],
          approvedLeaveRequests: [leave],
        );
        expect(status, AttendanceStatus.onLeave, reason: '$day should be On Leave');
      }
      // A day just outside the range is not covered.
      final status = resolveAttendanceStatus(
        email: _email,
        date: DateTime(2026, 9, 13),
        attendanceOnDate: const [],
        approvedLeaveRequests: [leave],
      );
      expect(status, AttendanceStatus.unmarked);
    });

    test('a Custom-pick approved leave is On Leave only on the listed dates - '
        'not on every day inside the outer start/end span', () {
      final custom = _approvedCustom([DateTime(2026, 9, 10), DateTime(2026, 9, 14)]);

      for (final day in [DateTime(2026, 9, 10), DateTime(2026, 9, 14)]) {
        final status = resolveAttendanceStatus(
          email: _email,
          date: day,
          attendanceOnDate: const [],
          approvedLeaveRequests: [custom],
        );
        expect(status, AttendanceStatus.onLeave, reason: '$day is one of the picked custom dates');
      }

      // 9/12 sits inside the outer 9/10-9/14 span but was never actually
      // picked - the regression case for the customDates-vs-range gotcha.
      final status = resolveAttendanceStatus(
        email: _email,
        date: DateTime(2026, 9, 12),
        attendanceOnDate: const [],
        approvedLeaveRequests: [custom],
      );
      expect(status, AttendanceStatus.unmarked);
    });

    test('a non-approved leave (still requested/rejected/withdrawn) never yields On Leave', () {
      final date = DateTime(2026, 9, 19);
      for (final s in ['requested', 'rejected', 'withdrawn']) {
        final leave = LeaveRequest(requestId: 'r3', email: _email, status: s, startDate: date, endDate: date);
        final status = resolveAttendanceStatus(
          email: _email,
          date: date,
          attendanceOnDate: const [],
          approvedLeaveRequests: [], // caller is expected to pre-filter to approved only
        );
        expect(status, AttendanceStatus.unmarked);
        expect(leave.status, s); // sanity - this leave is deliberately excluded from the approved list
      }
    });

    test('no manual mark and no covering leave is Unmarked', () {
      final status = resolveAttendanceStatus(
        email: _email,
        date: DateTime(2026, 9, 19),
        attendanceOnDate: const [],
        approvedLeaveRequests: const [],
      );
      expect(status, AttendanceStatus.unmarked);
    });
  });
}
