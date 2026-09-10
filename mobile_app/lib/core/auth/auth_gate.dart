import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../theme/app_colors.dart';
import 'sign_in_screen.dart';

/// Not signed in (or the session is invalid/expired) -> SignInScreen;
/// signed in -> [developerChild] or [managerChild] depending on the
/// profile's `isOwner` flag. GET /api/auth/me (behind authStateProvider)
/// already re-verifies `active` server-side on every restore, replacing
/// the old two-step "Firebase auth state -> allowlist lookup" chain.
class AuthGate extends ConsumerWidget {
  const AuthGate({required this.developerChild, required this.managerChild, super.key});

  final Widget developerChild;
  final Widget managerChild;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    return authState.when(
      loading: () => const _SplashScreen(),
      error: (err, _) => SignInScreen(errorMessage: err.toString()),
      data: (entry) {
        if (entry == null) return const SignInScreen();
        return entry.isOwner ? managerChild : developerChild;
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
