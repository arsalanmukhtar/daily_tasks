import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import 'manager_providers.dart';
import 'report/report_screen.dart';
import 'requests/archived_screen.dart';
import 'requests/requests_screen.dart';
import 'summary/summary_screen.dart';
import 'widgets/global_search_bar.dart';

/// Manager's 4-tab shell (Requests/Archived/Summary/Report) - replaces the
/// Kotlin app's ManagerHomeScreen entirely. Shown instead of the developer
/// HomeScreen when the signed-in user's profile has isOwner==true (see
/// AuthGate's caller in main.dart... actually the role branch itself lives
/// wherever AuthGate's `child` is chosen - see RoleBasedHome).
class ManagerHomeScreen extends ConsumerStatefulWidget {
  const ManagerHomeScreen({super.key});

  @override
  ConsumerState<ManagerHomeScreen> createState() => _ManagerHomeScreenState();
}

class _ManagerHomeScreenState extends ConsumerState<ManagerHomeScreen> {
  int _tabIndex = 0;

  static const _titles = ['Requests', 'Archived', 'Summary', 'Report'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(realtimeClientProvider).start();
    });
  }

  @override
  Widget build(BuildContext context) {
    final requests = ref.watch(allLeaveRequestsProvider).valueOrNull ?? const [];
    final reports = ref.watch(allUninformedLeavesProvider).valueOrNull ?? const [];
    final pendingCount = requests.where((r) => r.status == 'requested' && !r.isArchived).length;
    final actionableCount = reports.where((r) => r.status == 'reported' || r.status == 'explained').length;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tabIndex]),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () => ref.read(authRepositoryProvider).signOut(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Above every tab's own content (filters, lists, charts) rather
          // than inside any one of them, and built once here rather than
          // per-tab, so the typed query and the search itself both persist
          // across tab switches.
          const Padding(
            padding: EdgeInsets.fromLTRB(12, 12, 12, 0),
            child: GlobalSearchBar(),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: IndexedStack(
              index: _tabIndex,
              children: const [RequestsScreen(), ArchivedScreen(), SummaryScreen(), ReportScreen()],
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: [
          NavigationDestination(
            icon: _badge(const Icon(Icons.inbox_outlined), pendingCount),
            label: 'Requests',
          ),
          const NavigationDestination(icon: Icon(Icons.archive_outlined), label: 'Archived'),
          const NavigationDestination(icon: Icon(Icons.bar_chart_outlined), label: 'Summary'),
          NavigationDestination(
            icon: _badge(const Icon(Icons.flag_outlined), actionableCount),
            label: 'Report',
          ),
        ],
      ),
    );
  }

  Widget _badge(Widget icon, int count) {
    if (count == 0) return icon;
    return Badge(label: Text('$count'), child: icon);
  }
}
