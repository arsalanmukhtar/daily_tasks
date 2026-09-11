import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/allowlist_entry.dart';
import '../../../data/models/leave_request.dart';
import '../../../data/models/leave_type.dart';
import '../../../data/models/uninformed_leave.dart';
import '../../../data/providers.dart';
import '../../../widgets/avatar.dart';
import '../../../widgets/filter_pill.dart';
import '../../../widgets/kpi_tile.dart';
import '../manager_providers.dart';
import '../period_selector.dart';
import 'widgets/horizontal_bar_row.dart';
import 'widgets/simple_bar_chart.dart';

/// Read-only KPI/chart dashboard - pure client-side aggregation over
/// allLeaveRequestsProvider/allUninformedLeavesProvider/rosterProvider, no
/// dedicated server endpoint (mirrors the Kotlin app's LeaveSummaryScreen,
/// which does the same math client-side over its own Firestore listeners).
///
/// Simplification vs. the Kotlin app: the developer filter here is a
/// single-select ("All developers" or one person) rather than the Kotlin
/// app's multi-select "Compare" mode - full multi-select comparison is a
/// meaningfully bigger UI for a secondary feature, left for a follow-up
/// if it turns out to be missed.
class SummaryScreen extends ConsumerStatefulWidget {
  const SummaryScreen({super.key});

  @override
  ConsumerState<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends ConsumerState<SummaryScreen> {
  late Period _period = Period.yearOf(DateTime.now().year);
  String? _selectedEmail; // null = all developers
  bool _weekMode = false; // only meaningful once a quarter is selected

  static const _typeOrder = [
    LeaveType.casualFull,
    LeaveType.casualShort,
    LeaveType.medical,
    LeaveType.casualOutPass,
    LeaveType.foreignTrip,
    LeaveType.umrah,
  ];

  DateTime _groupDate(LeaveRequest r) => r.startDate ?? r.requestedAt ?? DateTime(1970);

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(allLeaveRequestsProvider);
    final uninformedAsync = ref.watch(allUninformedLeavesProvider);
    final roster = ref.watch(rosterProvider).valueOrNull ?? const [];

    return requestsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Could not load summary: $err')),
      data: (allRequests) {
        final uninformed = uninformedAsync.valueOrNull ?? const [];
        final scoped = allRequests
            .where((r) => _selectedEmail == null || r.email == _selectedEmail)
            .where((r) => _period.contains(_groupDate(r)))
            .toList();
        final scopedUninformed = uninformed
            .where((u) => _selectedEmail == null || u.email == _selectedEmail)
            .where((u) => _period.contains(u.date ?? u.reportedAt ?? DateTime(1970)))
            .toList();

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _developerPicker(roster),
            const SizedBox(height: 16),
            PeriodSelector(period: _period, onChanged: (p) => setState(() => _period = p)),
            const SizedBox(height: 16),
            _kpiRow(scoped),
            const SizedBox(height: 20),
            Text('By leave type', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            _byTypeChart(scoped, scopedUninformed),
            if (_period.granularity == PeriodGranularity.year || _period.granularity == PeriodGranularity.quarter) ...[
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Monthly trend', style: Theme.of(context).textTheme.titleMedium),
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
              _trendChart(allRequests),
            ],
            const SizedBox(height: 20),
            Text('Most requests this month', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            _leaderboard(allRequests, roster),
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
        if (v == null) return 'All developers';
        final match = roster.where((u) => u.email == v);
        return match.isNotEmpty ? match.first.name : v;
      },
      onChanged: (v) => setState(() => _selectedEmail = v),
    );
  }

  Widget _kpiRow(List<LeaveRequest> scoped) {
    int count(bool Function(LeaveRequest) f) => scoped.where(f).length;
    return Row(
      children: [
        Expanded(
          child: KpiTile(
            label: 'Total',
            value: '${scoped.length}',
            foreground: AppColors.ink900,
            background: AppColors.surface2,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: KpiTile(
            label: 'Approved',
            value: '${count((r) => r.status == 'approved')}',
            foreground: AppColors.statusApproved,
            background: AppColors.statusApprovedBg,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: KpiTile(
            label: 'Rejected',
            value: '${count((r) => r.status == 'rejected')}',
            foreground: AppColors.statusRejected,
            background: AppColors.statusRejectedBg,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: KpiTile(
            label: 'Pending',
            value: '${count((r) => r.status == 'requested')}',
            foreground: AppColors.statusRequested,
            background: AppColors.statusRequestedBg,
          ),
        ),
      ],
    );
  }

  Widget _byTypeChart(List<LeaveRequest> scoped, List<UninformedLeave> scopedUninformed) {
    final counts = <LeaveType, int>{for (final t in _typeOrder) t: 0};
    for (final r in scoped) {
      if (counts.containsKey(r.type)) counts[r.type] = counts[r.type]! + 1;
    }
    // uninformedAbsence counts from the uninformed-leaves list itself (every
    // filed report in scope), not from leaveRequests - matching the Kotlin
    // app's one deliberate exception (a report only becomes a leaveRequests
    // row once accepted, but should count as soon as it's filed).
    final maxValue = [...counts.values, scopedUninformed.length].fold(0, (a, b) => a > b ? a : b);
    return Column(
      children: [
        for (final t in _typeOrder)
          HorizontalBarRow(
            label: t.label,
            value: counts[t]!,
            maxValue: maxValue,
            color: AppColors.forLeaveTypeBar(t.value),
          ),
        HorizontalBarRow(
          label: 'Uninformed',
          value: scopedUninformed.length,
          maxValue: maxValue,
          color: AppColors.forLeaveTypeBar('uninformedAbsence'),
        ),
      ],
    );
  }

  Widget _trendChart(List<LeaveRequest> allRequests) {
    final year = _period.year;
    final inYear = allRequests.where((r) {
      final d = _groupDate(r);
      return d.year == year && (_selectedEmail == null || r.email == _selectedEmail);
    }).toList();

    if (_period.granularity == PeriodGranularity.quarter && _weekMode) {
      final quarter = _period.quarter!;
      final weeks = List.generate(13, (i) => ((quarter - 1) * 13) + i + 1);
      final counts = weeks.map((w) {
        final period = Period(PeriodGranularity.week, year, isoWeek: w);
        return inYear.where((r) => period.contains(_groupDate(r))).length;
      }).toList();
      return SimpleBarChart(labels: weeks.map((w) => 'W$w').toList(), values: counts);
    }

    final monthsInScope = _period.granularity == PeriodGranularity.quarter
        ? List.generate(3, (i) => (_period.quarter! - 1) * 3 + i + 1)
        : List.generate(12, (i) => i + 1);
    const monthLabels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    final counts = monthsInScope.map((m) => inYear.where((r) => _groupDate(r).month == m).length).toList();
    return SimpleBarChart(labels: monthsInScope.map((m) => monthLabels[m - 1]).toList(), values: counts);
  }

  Widget _leaderboard(List<LeaveRequest> allRequests, List<AllowlistEntry> roster) {
    final now = DateTime.now();
    final thisMonth = allRequests.where((r) {
      final d = _groupDate(r);
      return d.year == now.year && d.month == now.month;
    });
    final counts = <String, int>{};
    for (final r in thisMonth) {
      counts[r.email] = (counts[r.email] ?? 0) + 1;
    }
    final sorted = counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final top5 = sorted.take(5).toList();
    if (top5.isEmpty) return const Text('No requests yet this month.');

    String nameFor(String email) {
      final match = roster.where((u) => u.email == email);
      return match.isNotEmpty ? match.first.name : email;
    }

    return Column(
      children: [
        for (var i = 0; i < top5.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                Text('${i + 1}', style: TextStyle(color: AppColors.ink500, fontWeight: FontWeight.w700)),
                const SizedBox(width: 12),
                Avatar(name: nameFor(top5[i].key), email: top5[i].key, size: 28),
                const SizedBox(width: 10),
                Expanded(child: Text(nameFor(top5[i].key))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: AppColors.brandTint, borderRadius: BorderRadius.circular(50)),
                  child: Text('${top5[i].value}', style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
