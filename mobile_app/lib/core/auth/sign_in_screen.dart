import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../theme/app_colors.dart';

/// Magic-link sign-in: email -> POST /auth/request-link -> "check your
/// email" -> the emailed techewapp://verify?token=... link is caught by
/// DeepLinkListener (main.dart) -> AuthRepository.verifyToken() -> the
/// stored session flows through authStateProvider, which is what actually
/// dismisses this screen (see AuthGate). Mirrors app.js's #authGate states
/// on the web app.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({this.errorMessage, super.key});

  final String? errorMessage;

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _emailController = TextEditingController();
  bool _isSending = false;
  bool _checkEmail = false;
  String? _localError;

  Future<void> _sendLink() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;
    setState(() {
      _isSending = true;
      _localError = null;
    });
    ref.read(deepLinkErrorProvider.notifier).state = null;
    try {
      await ref.read(authRepositoryProvider).requestMagicLink(email);
      if (mounted) setState(() => _checkEmail = true);
    } catch (e) {
      if (mounted) setState(() => _localError = 'Could not send the sign-in link: $e');
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // A deep-link verify failure (invalid/expired token) surfaces here too,
    // alongside AuthGate's own errorMessage and this screen's own send-link
    // errors - whichever fired most recently wins.
    final deepLinkError = ref.watch(deepLinkErrorProvider);
    final error = deepLinkError ?? _localError ?? widget.errorMessage;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
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
                  _checkEmail ? 'Check your email' : 'Weekly tasks and leave, in one place.',
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
                if (_checkEmail) ...[
                  Text(
                    'We sent a sign-in link to ${_emailController.text.trim()}. '
                    'It expires in 15 minutes and can only be used once.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.ink700),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => setState(() {
                      _checkEmail = false;
                      _localError = null;
                      ref.read(deepLinkErrorProvider.notifier).state = null;
                    }),
                    child: const Text('Use a different email'),
                  ),
                ] else ...[
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(
                      hintText: 'you@example.com',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _isSending ? null : _sendLink(),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isSending ? null : _sendLink,
                      icon: _isSending
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.mail_outline),
                      label: Text(_isSending ? 'Sending...' : 'Send sign-in link'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
