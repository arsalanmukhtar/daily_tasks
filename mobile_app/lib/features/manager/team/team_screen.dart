import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import 'attendance/attendance_roster_screen.dart';
import 'directory/team_directory_screen.dart';
import 'stats/attendance_stats_screen.dart';

/// The Team tab's own 3-way split - Directory (view/edit any profile) /
/// Attendance (mark present/absent/late for a day) / Stats (trend +
/// percentages). Nested entirely inside this one outer manager tab, so
/// ManagerHomeScreen's own IndexedStack shell only ever sees one more
/// child - it doesn't need to know Team has sub-tabs at all.
class TeamScreen extends StatefulWidget {
  const TeamScreen({super.key});

  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> with SingleTickerProviderStateMixin {
  late final _tabController = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
          child: TabBar(
            controller: _tabController,
            labelColor: AppColors.brandPrimaryDark,
            unselectedLabelColor: AppColors.ink500,
            indicatorColor: AppColors.brandPrimary,
            tabs: const [Tab(text: 'Directory'), Tab(text: 'Attendance'), Tab(text: 'Stats')],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: const [TeamDirectoryScreen(), AttendanceRosterScreen(), AttendanceStatsScreen()],
          ),
        ),
      ],
    );
  }
}
