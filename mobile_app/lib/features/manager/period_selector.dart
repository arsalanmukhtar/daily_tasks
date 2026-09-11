import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/week_utils.dart';

enum PeriodGranularity { year, quarter, month, week }

/// One Year/Quarter/Month/Week selection - shared by the Archived and
/// Summary tabs' drill-down (mirrors the Kotlin app's ArchiveGranularity /
/// Summary period card, which both use the same Year->Quarter->Month->Week
/// idea).
class Period {
  const Period(this.granularity, this.year, {this.quarter, this.month, this.isoWeek});

  final PeriodGranularity granularity;
  final int year;
  final int? quarter; // 1-4
  final int? month; // 1-12
  final int? isoWeek;

  static Period yearOf(int year) => Period(PeriodGranularity.year, year);

  DateTimeRange range() {
    switch (granularity) {
      case PeriodGranularity.year:
        return DateTimeRange(start: DateTime(year), end: DateTime(year + 1));
      case PeriodGranularity.quarter:
        final startMonth = (quarter! - 1) * 3 + 1;
        return DateTimeRange(start: DateTime(year, startMonth), end: DateTime(year, startMonth + 3));
      case PeriodGranularity.month:
        return DateTimeRange(start: DateTime(year, month!), end: DateTime(year, month! + 1));
      case PeriodGranularity.week:
        // ISO week 1 is the week containing 4 January.
        final jan4 = DateTime(year, 1, 4);
        final week1Monday = jan4.subtract(Duration(days: jan4.weekday - 1));
        final start = week1Monday.add(Duration(days: (isoWeek! - 1) * 7));
        return DateTimeRange(start: start, end: start.add(const Duration(days: 7)));
    }
  }

  bool contains(DateTime date) {
    final r = range();
    return !date.isBefore(r.start) && date.isBefore(r.end);
  }

  String get label {
    switch (granularity) {
      case PeriodGranularity.year:
        return '$year';
      case PeriodGranularity.quarter:
        return 'Q$quarter $year';
      case PeriodGranularity.month:
        return DateFormat('MMMM yyyy').format(DateTime(year, month!));
      case PeriodGranularity.week:
        return 'Week $isoWeek, $year';
    }
  }
}

const _granularities = [
  (PeriodGranularity.year, 'Year'),
  (PeriodGranularity.quarter, 'Quarter'),
  (PeriodGranularity.month, 'Month'),
  (PeriodGranularity.week, 'Week'),
];

/// Segmented Year/Quarter/Month/Week control + prev/next navigation for
/// the currently selected [period]. Weeks are only offered once a quarter
/// is selected (a whole year of weekly bars/cards would be unreasonably
/// cramped - same reasoning as the Kotlin app's Summary chart toggle).
///
/// Custom-built rather than Material's SegmentedButton: that widget sizes
/// itself to its content instead of filling the row, and "Quarter" (the
/// longest label) doesn't fit its own segment's default width, wrapping to
/// two lines and throwing the whole control's height/alignment off the
/// moment it's selected. Four equal Expanded segments in a fixed-height
/// track sidesteps both problems and matches the brand-colored "active"
/// pill look the rest of this screen's filters already use.
class PeriodSelector extends StatelessWidget {
  const PeriodSelector({required this.period, required this.onChanged, super.key});

  final Period period;
  final ValueChanged<Period> onChanged;

  void _select(PeriodGranularity g) {
    switch (g) {
      case PeriodGranularity.year:
        onChanged(Period.yearOf(period.year));
      case PeriodGranularity.quarter:
        onChanged(Period(PeriodGranularity.quarter, period.year, quarter: period.quarter ?? 1));
      case PeriodGranularity.month:
        onChanged(Period(PeriodGranularity.month, period.year, month: period.month ?? 1));
      case PeriodGranularity.week:
        onChanged(Period(PeriodGranularity.week, period.year, isoWeek: period.isoWeek ?? isoWeekOf(DateTime.now()).week));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 40,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(color: AppColors.surface2, borderRadius: BorderRadius.circular(11)),
          child: Row(
            children: [
              for (final (g, label) in _granularities)
                Expanded(child: _segment(granularity: g, label: label)),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _navButton(icon: Icons.chevron_left_rounded, onTap: () => onChanged(_shift(-1))),
            Expanded(
              child: Text(
                period.label,
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(color: AppColors.brandPrimaryDark, fontWeight: FontWeight.w800),
              ),
            ),
            _navButton(icon: Icons.chevron_right_rounded, onTap: () => onChanged(_shift(1))),
          ],
        ),
      ],
    );
  }

  Widget _segment({required PeriodGranularity granularity, required String label}) {
    final selected = period.granularity == granularity;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _select(granularity),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.brandPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          maxLines: 1,
          softWrap: false,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.ink700,
          ),
        ),
      ),
    );
  }

  Widget _navButton({required IconData icon, required VoidCallback onTap}) {
    return Material(
      color: AppColors.brandTint,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, size: 22, color: AppColors.brandPrimaryDark),
        ),
      ),
    );
  }

  Period _shift(int delta) {
    switch (period.granularity) {
      case PeriodGranularity.year:
        return Period.yearOf(period.year + delta);
      case PeriodGranularity.quarter:
        var q = period.quarter! + delta;
        var y = period.year;
        if (q < 1) {
          q = 4;
          y--;
        } else if (q > 4) {
          q = 1;
          y++;
        }
        return Period(PeriodGranularity.quarter, y, quarter: q);
      case PeriodGranularity.month:
        var m = period.month! + delta;
        var y = period.year;
        if (m < 1) {
          m = 12;
          y--;
        } else if (m > 12) {
          m = 1;
          y++;
        }
        return Period(PeriodGranularity.month, y, month: m);
      case PeriodGranularity.week:
        var w = period.isoWeek! + delta;
        var y = period.year;
        if (w < 1) {
          y--;
          w = 52;
        } else if (w > 52) {
          y++;
          w = 1;
        }
        return Period(PeriodGranularity.week, y, isoWeek: w);
    }
  }
}
