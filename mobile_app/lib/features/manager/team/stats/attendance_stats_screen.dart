import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/allowlist_entry.dart';
import '../../../../data/models/leave_request.dart';
import '../../../../data/providers.dart';
import '../../../../widgets/filter_pill.dart';
import '../../../../widgets/kpi_tile.dart';
import '../../manager_providers.dart';
import '../../period_selector.dart';
import '../../summary/widgets/horizontal_bar_row.dart';
import '../../summary/widgets/simple_bar_chart.dart';
import '../team_providers.dart';

const _countedStatuses = [
  AttendanceStatus.present,
  AttendanceStatus.late,
  AttendanceStatus.absent,
  AttendanceStatus.nightDuty,
  AttendanceStatus.onDuty,
  AttendanceStatus.onLeave,
];

/// Read-only present/absent/late/On-Leave trend + percentages over a
/// Year/Quarter/Month/Week drill-down - mirrors SummaryScreen's structure
/// and reuses the exact same Period/PeriodSelector/FilterPill/KpiTile/
/// HorizontalBarRow/SimpleBarChart widgets, just resolved from attendance +
/// approved leave_requests instead of leave_requests alone.
class AttendanceStatsScreen extends ConsumerStatefulWidget {
  const AttendanceStatsScreen({super.key});

  @override
  ConsumerState<AttendanceStatsScreen> createState() => _AttendanceStatsScreenState();
}

class _AttendanceStatsScreenState extends ConsumerState<AttendanceStatsScreen> {
  late Period _period = Period.yearOf(DateTime.now().year);
  String? _selectedEmail; // null = whole team
  bool _weekMode = false; // only meaningful once a quarter is selected

  @override
  Widget build(BuildContext context) {
    final roster = ref.watch(rosterProvider).valueOrNull?.where((u) => u.active).toList() ?? const [];
    final approvedLeave = (ref.watch(allLeaveRequestsProvider).valueOrNull ?? const <LeaveRequest>[])
        .where((r) => r.status == 'approved')
        .toList();

    final range = _period.range();
    final rangeEndInclusive = range.end.subtract(const Duration(days: 1));
    final attendanceAsync = ref.watch(attendanceRangeProvider((range.start, rangeEndInclusive)));

    return attendanceAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Could not load attendance stats: $err')),
      data: (records) {
        final people = _selectedEmail == null ? roster : roster.where((u) => u.email == _selectedEmail).toList();
        final counts = _countDays(people, range, records, approvedLeave);
        final knownTotal = _countedStatuses.fold(0, (sum, s) => sum + (counts[s] ?? 0));

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _developerPicker(roster),
            const SizedBox(height: 16),
            PeriodSelector(period: _period, onChanged: (p) => setState(() => _period = p)),
            const SizedBox(height: 16),
            _kpiRow(counts, knownTotal),
            const SizedBox(height: 20),
            Text('Breakdown', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            _breakdown(counts),
            if (_period.granularity == PeriodGranularity.year || _period.granularity == PeriodGranularity.quarter) ...[
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Present days trend', style: Theme.of(context).textTheme.titleMedium),
                  if (_period.granularity == PeriodGranularity.quarter)
                    SegmentedButton<bool>(
                      segments: const [
                        ButtonSegment(value: false, label: Text('Month')),
                        ButtonSegment(value: true, label: Text('Week')),
                      ],
                      selected: {_weekMode},
                      onSelectionChanged: (s) => setState(() => _weekMode = s.first),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              _trendChart(people, records),
            ],
          ],
        );
      },
    );
  }

  Widget _developerPicker(List<AllowlistEntry> roster) {
    return FilterPill<String?>(
      value: _selectedEmail,
      items: [null, ...roster.map((u) => u.email)],
      labelOf: (v) {
        if (v == null) return 'Whole team';
        final match = roster.where((u) => u.email == v);
        return match.isNotEmpty ? match.first.name : v;
      },
      onChanged: (v) => setState(() => _selectedEmail = v),
    );
  }

  /// Every calendar day in [range] (half-open) x [people], resolved through
  /// resolveAttendanceStatus and tallied. Unmarked days are counted too (so
  /// the breakdown bar can show them) but deliberately excluded from
  /// [knownTotal] (and therefore every percentage) - a day with no data yet
  /// isn't an absence.
  Map<AttendanceStatus, int> _countDays(
    List<AllowlistEntry> people,
    DateTimeRange range,
    List records,
    List<LeaveRequest> approvedLeave,
  ) {
    final counts = <AttendanceStatus, int>{for (final s in AttendanceStatus.values) s: 0};
    for (final user in people) {
      for (var d = range.start; d.isBefore(range.end); d = d.add(const Duration(days: 1))) {
        final status = resolveAttendanceStatus(
          email: user.email,
          date: d,
          attendanceOnDate: records.cast(),
          approvedLeaveRequests: approvedLeave,
        );
        counts[status] = (counts[status] ?? 0) + 1;
      }
    }
    return counts;
  }

  Widget _kpiRow(Map<AttendanceStatus, int> counts, int knownTotal) {
    String pct(AttendanceStatus s) {
      final n = counts[s] ?? 0;
      if (knownTotal == 0) return '0%';
      return '${(n * 100 / knownTotal).round()}%';
    }

    Widget tile(AttendanceStatus s) => Expanded(
          child: KpiTile(
            label: s.label,
            sublabel: pct(s),
            value: '${counts[s] ?? 0}',
            foreground: s.foreground,
            background: s.background,
          ),
        );

    return Column(
      children: [
        Row(
          children: [
            tile(AttendanceStatus.present),
            const SizedBox(width: 8),
            tile(AttendanceStatus.late),
            const SizedBox(width: 8),
            tile(AttendanceStatus.absent),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            tile(AttendanceStatus.nightDuty),
            const SizedBox(width: 8),
            tile(AttendanceStatus.onDuty),
            const SizedBox(width: 8),
            tile(AttendanceStatus.onLeave),
          ],
        ),
      ],
    );
  }

  /// Only the 4 "known" statuses share a bar scale - Unmarked is usually
  /// the overwhelming majority of any period (most days simply haven't
  /// been marked yet), and including it here would make every meaningful
  /// bar collapse to a sliver against it. It's still surfaced, just as a
  /// plain count below the chart instead of a 5th bar.
  Widget _breakdown(Map<AttendanceStatus, int> counts) {
    final maxValue = _countedStatuses.map((s) => counts[s] ?? 0).fold(0, (a, b) => a > b ? a : b);
    final unmarked = counts[AttendanceStatus.unmarked] ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final s in _countedStatuses)
          HorizontalBarRow(label: s.label, value: counts[s] ?? 0, maxValue: maxValue, color: s.foreground),
        if (unmarked > 0) ...[
          const SizedBox(height: 6),
          Text(
            '$unmarked day${unmarked == 1 ? '' : 's'} not yet marked in this period',
            style: TextStyle(color: AppColors.ink500, fontSize: 12),
          ),
        ],
      ],
    );
  }

  Widget _trendChart(List<AllowlistEntry> people, List records) {
    int presentCountIn(DateTimeRange r) {
      var total = 0;
      for (final user in people) {
        for (var d = r.start; d.isBefore(r.end); d = d.add(const Duration(days: 1))) {
          final status = resolveAttendanceStatus(
            email: user.email,
            date: d,
            attendanceOnDate: records.cast(),
            approvedLeaveRequests: const [],
          );
          if (status == AttendanceStatus.present) total++;
        }
      }
      return total;
    }

    final year = _period.year;
    if (_period.granularity == PeriodGranularity.quarter && _weekMode) {
      final quarter = _period.quarter!;
      final weeks = List.generate(13, (i) => ((quarter - 1) * 13) + i + 1);
      final counts = weeks.map((w) => presentCountIn(Period(PeriodGranularity.week, year, isoWeek: w).range())).toList();
      return SimpleBarChart(labels: weeks.map((w) => 'W$w').toList(), values: counts);
    }

    final monthsInScope = _period.granularity == PeriodGranularity.quarter
        ? List.generate(3, (i) => (_period.quarter! - 1) * 3 + i + 1)
        : List.generate(12, (i) => i + 1);
    const monthLabels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    final counts = monthsInScope.map((m) => presentCountIn(Period(PeriodGranularity.month, year, month: m).range())).toList();
    return SimpleBarChart(labels: monthsInScope.map((m) => monthLabels[m - 1]).toList(), values: counts);
  }
}
