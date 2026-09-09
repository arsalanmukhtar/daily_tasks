import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../theme/app_colors.dart';

/// Mirrors screens/mobile/SignIn.png / AuthPalette.kt's sign-in screen -
/// same neutral identity, same single "Sign in with Google" action.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({this.errorMessage, super.key});

  final String? errorMessage;

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  bool _isSigningIn = false;
  String? _localError;

  Future<void> _signIn() async {
    setState(() {
      _isSigningIn = true;
      _localError = null;
    });
    try {
      final result = await ref.read(authRepositoryProvider).signIn();
      if (result.deniedReason != null && mounted) {
        setState(() => _localError = result.deniedReason);
      }
    } catch (e) {
      if (mounted) setState(() => _localError = 'Sign-in failed: $e');
    } finally {
      if (mounted) setState(() => _isSigningIn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = _localError ?? widget.errorMessage;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.brandTint,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.event_available_rounded, color: AppColors.techEwOrangeDark, size: 32),
                ),
                const SizedBox(height: 20),
                Text('Tech EW', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 6),
                Text(
                  'Weekly tasks and leave, in one place.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.ink700),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                if (error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.statusRejectedBg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      error,
                      style: const TextStyle(color: AppColors.statusRejected, fontSize: 13),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isSigningIn ? null : _signIn,
                    icon: _isSigningIn
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.login),
                    label: Text(_isSigningIn ? 'Signing in...' : 'Sign in with Google'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
