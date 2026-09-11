import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/leave_request.dart';

final _monthFmt = DateFormat('MMMM yyyy');
const _weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/// Read-only month calendar marking every day a request actually covers
/// (see LeaveRequest.leaveDays) - opened by tapping the "Date" row/calendar
/// icon in RequestDetailSheet. A single formatted date or "start - end"
/// range in text doesn't convey a non-contiguous "4 days (custom)" pick
/// clearly; this shows exactly which days those are, one month at a time.
class LeaveDatesCalendarSheet extends StatefulWidget {
  const LeaveDatesCalendarSheet({required this.request, super.key});

  final LeaveRequest request;

  @override
  State<LeaveDatesCalendarSheet> createState() => _LeaveDatesCalendarSheetState();
}

class _LeaveDatesCalendarSheetState extends State<LeaveDatesCalendarSheet> {
  late final List<DateTime> _markedDates = widget.request.leaveDays;
  late DateTime _visibleMonth = _markedDates.isNotEmpty
      ? DateTime(_markedDates.first.year, _markedDates.first.month)
      : DateTime(DateTime.now().year, DateTime.now().month);

  bool _isMarked(DateTime day) =>
      _markedDates.any((d) => d.year == day.year && d.month == day.month && d.day == day.day);

  void _shiftMonth(int delta) {
    setState(() => _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month + delta));
  }

  @override
  Widget build(BuildContext context) {
    final firstOfMonth = DateTime(_visibleMonth.year, _visibleMonth.month, 1);
    final daysInMonth = DateTime(_visibleMonth.year, _visibleMonth.month + 1, 0).day;
    // Monday-first grid, matching the web app's/apply-leave calendar's week
    // convention.
    final leadingBlanks = (firstOfMonth.weekday - DateTime.monday) % 7;
    final today = DateTime.now();
    final r = widget.request;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    r.customDates.length > 1
                        ? '${_markedDates.length} days (custom)'
                        : _markedDates.length == 1
                            ? '1 day'
                            : '${_markedDates.length} days',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(icon: const Icon(Icons.chevron_left_rounded), onPressed: () => _shiftMonth(-1)),
                Text(_monthFmt.format(_visibleMonth), style: const TextStyle(fontWeight: FontWeight.w700)),
                IconButton(icon: const Icon(Icons.chevron_right_rounded), onPressed: () => _shiftMonth(1)),
              ],
            ),
            Row(
              children: [
                for (final w in _weekdayLabels)
                  Expanded(
                    child: Center(
                      child: Text(w, style: TextStyle(color: AppColors.ink500, fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7),
              itemCount: leadingBlanks + daysInMonth,
              itemBuilder: (context, index) {
                if (index < leadingBlanks) return const SizedBox.shrink();
                final day = DateTime(_visibleMonth.year, _visibleMonth.month, index - leadingBlanks + 1);
                final marked = _isMarked(day);
                final isToday = day.year == today.year && day.month == today.month && day.day == today.day;
                return Padding(
                  padding: const EdgeInsets.all(3),
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: marked ? AppColors.brandPrimary : null,
                        shape: BoxShape.circle,
                        border: (isToday && !marked) ? Border.all(color: AppColors.brandPrimary, width: 1.4) : null,
                      ),
                      child: Center(
                        child: Text(
                          '${day.day}',
                          style: TextStyle(
                            color: marked ? Colors.white : AppColors.ink900,
                            fontWeight: marked ? FontWeight.w700 : FontWeight.w500,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
