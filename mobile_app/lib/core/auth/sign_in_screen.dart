import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../theme/app_colors.dart';

enum _AuthMode { signIn, forgot, checkEmail, reset }

/// Email + password auth: sign in / forgot-password, against
/// AuthRepository. No self-service registration - accounts (and every
/// account's very first password) are provisioned by a manager; "Forgot
/// password" is the only path that ever sets a password. A reset arrives as
/// an emailed techewapp://reset?token=... deep link, caught by
/// DeepLinkListener, which sets pendingResetTokenProvider - this screen
/// watches that and switches straight to the "set a new password" form.
/// Mirrors app.js's #authGate states on the web app.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({this.errorMessage, super.key});

  final String? errorMessage;

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  _AuthMode _mode = _AuthMode.signIn;
  String? _checkEmailAddress;

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _resetPasswordController = TextEditingController();
  final _resetConfirmController = TextEditingController();

  bool _isBusy = false;
  String? _localError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (ref.read(pendingResetTokenProvider) != null) setState(() => _mode = _AuthMode.reset);
    });
  }

  void _setMode(_AuthMode mode) {
    setState(() {
      _mode = mode;
      _localError = null;
    });
    ref.read(deepLinkErrorProvider.notifier).state = null;
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _isBusy = true;
      _localError = null;
    });
    ref.read(deepLinkErrorProvider.notifier).state = null;
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => _localError = e.toString());
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _signIn() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) return;
    await _run(() => ref.read(authRepositoryProvider).login(email, password));
  }

  Future<void> _sendResetLink() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;
    await _run(() async {
      await ref.read(authRepositoryProvider).requestPasswordReset(email);
      if (mounted) setState(() => _checkEmailAddress = email);
    });
    if (_localError == null && mounted) setState(() => _mode = _AuthMode.checkEmail);
  }

  Future<void> _submitReset() async {
    final token = ref.read(pendingResetTokenProvider);
    final password = _resetPasswordController.text;
    final confirm = _resetConfirmController.text;
    if (token == null || password.isEmpty) return;
    if (password != confirm) {
      setState(() => _localError = 'Passwords do not match.');
      return;
    }
    await _run(() async {
      await ref.read(authRepositoryProvider).resetPassword(token, password);
      ref.read(pendingResetTokenProvider.notifier).state = null;
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _resetPasswordController.dispose();
    _resetConfirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<String?>(pendingResetTokenProvider, (previous, next) {
      if (next != null) setState(() => _mode = _AuthMode.reset);
    });
    // A deep-link error (malformed reset link) surfaces here too, alongside
    // AuthGate's own errorMessage and this screen's own submit errors -
    // whichever fired most recently wins.
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
                  child: const Icon(Icons.event_available_rounded, color: AppColors.brandPrimaryDark, size: 32),
                ),
                const SizedBox(height: 20),
                Text('Daily Tasks', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 6),
                Text(
                  _subtitle(),
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
                ..._body(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _subtitle() {
    switch (_mode) {
      case _AuthMode.signIn:
        return 'Weekly tasks and leave, in one place.';
      case _AuthMode.forgot:
        return "Enter your email and we'll send you a reset link.";
      case _AuthMode.checkEmail:
        return 'Check your email';
      case _AuthMode.reset:
        return 'Choose a new password for your account.';
    }
  }

  List<Widget> _body() {
    switch (_mode) {
      case _AuthMode.signIn:
        return _signInBody();
      case _AuthMode.forgot:
        return _forgotBody();
      case _AuthMode.checkEmail:
        return _checkEmailBody();
      case _AuthMode.reset:
        return _resetBody();
    }
  }

  List<Widget> _signInBody() {
    return [
      TextField(
        controller: _emailController,
        keyboardType: TextInputType.emailAddress,
        autocorrect: false,
        decoration: const InputDecoration(hintText: 'you@example.com', border: OutlineInputBorder()),
      ),
      const SizedBox(height: 10),
      TextField(
        controller: _passwordController,
        obscureText: true,
        decoration: const InputDecoration(hintText: 'Password', border: OutlineInputBorder()),
        onSubmitted: (_) => _isBusy ? null : _signIn(),
      ),
      const SizedBox(height: 16),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _isBusy ? null : _signIn,
          child: _isBusy
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Sign in'),
        ),
      ),
      const SizedBox(height: 16),
      TextButton(onPressed: () => _setMode(_AuthMode.forgot), child: const Text('Forgot password?')),
    ];
  }

  List<Widget> _forgotBody() {
    return [
      TextField(
        controller: _emailController,
        keyboardType: TextInputType.emailAddress,
        autocorrect: false,
        decoration: const InputDecoration(hintText: 'you@example.com', border: OutlineInputBorder()),
        onSubmitted: (_) => _isBusy ? null : _sendResetLink(),
      ),
      const SizedBox(height: 16),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _isBusy ? null : _sendResetLink,
          icon: _isBusy
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.mail_outline),
          label: Text(_isBusy ? 'Sending...' : 'Send reset link'),
        ),
      ),
      const SizedBox(height: 16),
      TextButton(onPressed: () => _setMode(_AuthMode.signIn), child: const Text('Back to sign in')),
    ];
  }

  List<Widget> _checkEmailBody() {
    return [
      Text(
        'We sent a password reset link to ${_checkEmailAddress ?? _emailController.text.trim()}. '
        'It expires in 15 minutes and can only be used once.',
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.ink700),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 16),
      TextButton(
        onPressed: () => _setMode(_AuthMode.forgot),
        child: const Text('Use a different email'),
      ),
    ];
  }

  List<Widget> _resetBody() {
    return [
      TextField(
        controller: _resetPasswordController,
        obscureText: true,
        decoration: const InputDecoration(hintText: 'New password (min. 8 characters)', border: OutlineInputBorder()),
      ),
      const SizedBox(height: 10),
      TextField(
        controller: _resetConfirmController,
        obscureText: true,
        decoration: const InputDecoration(hintText: 'Confirm new password', border: OutlineInputBorder()),
        onSubmitted: (_) => _isBusy ? null : _submitReset(),
      ),
      const SizedBox(height: 16),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _isBusy ? null : _submitReset,
          child: _isBusy
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Set new password'),
        ),
      ),
    ];
  }
}
