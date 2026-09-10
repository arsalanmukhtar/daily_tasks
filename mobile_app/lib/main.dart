import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_gate.dart';
import 'core/auth/deep_link_listener.dart';
import 'core/theme/app_theme.dart';
import 'features/home/home_screen.dart';
import 'features/manager/manager_home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: DailyTasksApp()));
}

class DailyTasksApp extends StatelessWidget {
  const DailyTasksApp({super.key});

  @override
  Widget build(BuildContext context) {
    return DeepLinkListener(
      child: MaterialApp(
        title: 'Daily Tasks',
        debugShowCheckedModeBanner: false,
        theme: appTheme,
        home: const AuthGate(developerChild: HomeScreen(), managerChild: ManagerHomeScreen()),
      ),
    );
  }
}
