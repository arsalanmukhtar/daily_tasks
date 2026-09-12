import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../../widgets/sign_out_button.dart';
import '../leave/my_leaves/my_leaves_screen.dart';
import '../submissions/submissions_screen.dart';

/// Two tabs, mirroring the two nav-cards on the web dashboard: My
/// Submissions and My Leaves (which also surfaces the Uninformed Leave
/// banner, same as the web app's My Leaves drawer does).
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _tabIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Realtime updates (WebSocket) - replaces Firestore's onSnapshot.
      ref.read(realtimeClientProvider).start();
      // Register this device's push token once signed in - see
      // PushRepository's doc comment for why this doesn't wait for a
      // dedicated "enable notifications" screen.
      final entry = ref.read(authStateProvider).value;
      if (entry != null) {
        ref.read(pushRepositoryProvider).requestPermissionAndRegister(entry.email).catchError((_) {});
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final entry = ref.watch(authStateProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: Text(_tabIndex == 0 ? 'My Submissions' : 'My Leaves'),
        actions: [
          const SignOutButton(),
        ],
      ),
      body: entry == null
          ? const SizedBox.shrink()
          : IndexedStack(
              index: _tabIndex,
              children: [
                SubmissionsScreen(entry: entry),
                MyLeavesScreen(email: entry.email, name: entry.name),
              ],
            ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.assignment_outlined), label: 'Tasks'),
          NavigationDestination(icon: Icon(Icons.event_note_outlined), label: 'Leave'),
        ],
      ),
    );
  }
}
