import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';

/// Catches the `techewapp://verify?token=...` deep link emailed by the
/// magic-link sign-in flow (see server/src/auth.js's `platform: 'mobile'`
/// branch) - both a cold-start link and one received while already
/// running, on Android and iOS. A custom scheme is used instead of
/// Android App Links / iOS Universal Links since those need a real HTTPS
/// domain with a signed verification file, which this bare-IP, no-TLS
/// deployment doesn't have.
class DeepLinkListener extends ConsumerStatefulWidget {
  const DeepLinkListener({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<DeepLinkListener> createState() => _DeepLinkListenerState();
}

class _DeepLinkListenerState extends ConsumerState<DeepLinkListener> {
  final _appLinks = AppLinks();
  StreamSubscription<Uri>? _subscription;

  @override
  void initState() {
    super.initState();
    _subscription = _appLinks.uriLinkStream.listen(_handleUri);
    _appLinks.getInitialLink().then((uri) {
      if (uri != null) _handleUri(uri);
    });
  }

  Future<void> _handleUri(Uri uri) async {
    if (uri.scheme != 'techewapp' || uri.host != 'verify') return;
    final token = uri.queryParameters['token'];
    if (token == null) return;
    try {
      await ref.read(authRepositoryProvider).verifyToken(token);
    } catch (error) {
      ref.read(deepLinkErrorProvider.notifier).state = error.toString();
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
