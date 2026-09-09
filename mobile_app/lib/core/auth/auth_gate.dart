import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../theme/app_colors.dart';
import 'sign_in_screen.dart';

/// Same gate as app.js's onAuthStateChanged: not signed in -> SignInScreen;
/// signed in but not on the allowlist (or inactive) -> SignInScreen with a
/// denial message; signed in and allowlisted -> [child].
class AuthGate extends ConsumerWidget {
  const AuthGate({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    return authState.when(
      loading: () => const _SplashScreen(),
      error: (err, _) => SignInScreen(errorMessage: err.toString()),
      data: (user) {
        if (user == null) return const SignInScreen();

        final allowlistState = ref.watch(currentAllowlistEntryProvider);
        return allowlistState.when(
          loading: () => const _SplashScreen(),
          error: (err, _) => SignInScreen(
            errorMessage: err is AllowlistDeniedException ? err.message : 'Something went wrong. Please try again.',
          ),
          data: (entry) => entry == null ? const SignInScreen() : child,
        );
      },
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.bg,
      body: Center(child: CircularProgressIndicator(color: AppColors.techEwOrange)),
    );
  }
}
