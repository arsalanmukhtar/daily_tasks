import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_gate.dart';
import 'core/firebase/firebase_options.dart';
import 'core/theme/app_theme.dart';
import 'features/home/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const ProviderScope(child: TechEwApp()));
}

class TechEwApp extends StatelessWidget {
  const TechEwApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tech EW',
      debugShowCheckedModeBanner: false,
      theme: appTheme,
      home: const AuthGate(child: HomeScreen()),
    );
  }
}
