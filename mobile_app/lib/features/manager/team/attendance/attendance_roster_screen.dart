import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/leave_request.dart';
import '../../../../data/providers.dart';
import '../../../../widgets/avatar.dart';
import '../../../../widgets/status_chip.dart';
import '../../manager_providers.dart';
import '../team_providers.dart';
import 'widgets/attendance_mark_sheet.dart';

final _dateFmt = DateFormat('EEEE, d MMMM yyyy');

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

/// One day's roster - a date navigator (prev/next + tap-to-pick) over the
/// active team, each row showing its resolved AttendanceStatus (manual mark,
/// derived On Leave, or Unmarked) and opening AttendanceMarkSheet on tap.
class AttendanceRosterScreen extends ConsumerWidget {
  const AttendanceRosterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final day = ref.watch(selectedDayProvider);
    final dayOnly = DateTime(day.year, day.month, day.day);
    final roster = ref.watch(rosterProvider).valueOrNull?.where((u) => u.active).toList() ?? const [];
    final query = ref.watch(globalSearchQueryProvider);
    final filtered = roster.where((u) => u.matchesQuery(query)).toList()
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

    final attendanceAsync = ref.watch(attendanceRangeProvider((dayOnly, dayOnly)));
    final approvedLeave = (ref.watch(allLeaveRequestsProvider).valueOrNull ?? const <LeaveRequest>[])
        .where((r) => r.status == 'approved')
        .toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: _dateNavigator(context, ref, dayOnly),
        ),
        Expanded(
          child: attendanceAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(child: Text('Could not load attendance: $err')),
            data: (records) {
              if (filtered.isEmpty) {
                return Center(
                  child: Text(
                    query.trim().isEmpty ? 'No active team members.' : 'No one matches your search',
                    style: TextStyle(color: AppColors.ink500),
                  ),
                );
              }
              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                itemCount: filtered.length,
                itemBuilder: (context, i) {
                  final user = filtered[i];
                  final status = resolveAttendanceStatus(
                    email: user.email,
                    date: dayOnly,
                    attendanceOnDate: records,
                    approvedLeaveRequests: approvedLeave,
                  );
                  final existing = records.where((a) => a.email == user.email && _sameDay(a.date, dayOnly));
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: AppColors.surface,
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                        ),
                        builder: (_) => AttendanceMarkSheet(
                          email: user.email,
                          name: user.name,
                          date: dayOnly,
                          existing: existing.isNotEmpty ? existing.first : null,
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Avatar(name: user.name, email: user.email, size: 38),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    user.name.isNotEmpty ? user.name : user.email,
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                  Text(user.email, style: TextStyle(color: AppColors.ink500, fontSize: 12)),
                                ],
                              ),
                            ),
                            StatusChip(label: status.label, foreground: status.foreground, background: status.background),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _dateNavigator(BuildContext context, WidgetRef ref, DateTime day) {
    void setDay(DateTime d) => ref.read(selectedDayProvider.notifier).state = DateTime(d.year, d.month, d.day);

    return Row(
      children: [
        _navButton(icon: Icons.chevron_left_rounded, onTap: () => setDay(day.subtract(const Duration(days: 1)))),
        Expanded(
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: day,
                firstDate: DateTime(2020),
                lastDate: DateTime(day.year + 2),
              );
              if (picked != null) setDay(picked);
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                children: [
                  Text(
                    _sameDay(day, DateTime.now()) ? 'Today' : _dateFmt.format(day),
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(color: AppColors.brandPrimaryDark, fontWeight: FontWeight.w800),
                  ),
                  if (_sameDay(day, DateTime.now()))
                    Text(_dateFmt.format(day), style: TextStyle(color: AppColors.ink500, fontSize: 12)),
                ],
              ),
            ),
          ),
        ),
        _navButton(icon: Icons.chevron_right_rounded, onTap: () => setDay(day.add(const Duration(days: 1)))),
      ],
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
}
