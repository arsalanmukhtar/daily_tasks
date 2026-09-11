import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/week_utils.dart';
import '../../data/models/allowlist_entry.dart';
import '../../data/models/submission.dart';
import '../../data/providers.dart';
import 'weekly_grid_screen.dart';

final _rangeFormat = DateFormat('d MMM');

/// Mirrors the web app's My Submissions list/edit flow (app.js's
/// fetchUserSubmissions_/enterEditMode) - one row per past week, tap to
/// open that week's grid in WeeklyGridScreen.
class SubmissionsScreen extends ConsumerWidget {
  const SubmissionsScreen({required this.entry, super.key});

  final AllowlistEntry entry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentWeek = isoWeekOf(DateTime.now());
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => WeeklyGridScreen(entry: entry, weekStart: DateTime.now())),
        ),
        icon: const Icon(Icons.edit_calendar_outlined),
        label: Text('This week (${currentWeek.label})'),
      ),
      body: StreamBuilder<List<Submission>>(
        stream: ref.watch(submissionRepositoryProvider).watchMySubmissions(entry.email),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator(color: AppColors.brandPrimary));
          }
          final submissions = [...snapshot.data!]
            ..sort((a, b) => (b.updatedAt ?? DateTime(0)).compareTo(a.updatedAt ?? DateTime(0)));
          if (submissions.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('No submissions yet - use the button below to log this week.',
                    textAlign: TextAlign.center, style: TextStyle(color: AppColors.ink700)),
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: submissions.length,
            itemBuilder: (context, i) {
              final s = submissions[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  title: Text(s.weekLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(_prettyRange(s.weekRange)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    final weekStart = _mondayFromWeekLabel(s.weekLabel) ?? DateTime.now();
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => WeeklyGridScreen(entry: entry, weekStart: weekStart, existing: s)),
                    );
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }

  String _prettyRange(String weekRange) {
    final parts = weekRange.split(' to ');
    if (parts.length != 2) return weekRange;
    try {
      final start = DateTime.parse(parts[0]);
      final end = DateTime.parse(parts[1]);
      return '${_rangeFormat.format(start)} - ${_rangeFormat.format(end)}';
    } catch (_) {
      return weekRange;
    }
  }

  DateTime? _mondayFromWeekLabel(String weekLabel) {
    final match = RegExp(r'^Week\s+(\d+),\s*(\d+)').firstMatch(weekLabel);
    if (match == null) return null;
    final week = int.parse(match.group(1)!);
    final year = int.parse(match.group(2)!);
    // Jan 4th is always in ISO week 1 - walk to that week's Monday, then
    // add whole weeks to reach the target week number.
    final jan4 = DateTime.utc(year, 1, 4);
    final week1Monday = jan4.subtract(Duration(days: jan4.weekday - 1));
    return week1Monday.add(Duration(days: (week - 1) * 7));
  }
}
