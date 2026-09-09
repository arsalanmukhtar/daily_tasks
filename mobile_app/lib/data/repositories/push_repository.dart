import 'dart:io' show Platform;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

/// Registers this device's FCM token the same way android-app's
/// LeaveApiClient.registerPushToken() does (data/LeaveApiClient.kt:44-53) -
/// same `pushTokens/{token}` shape, so push-daemon's existing lookups don't
/// need to change to find this app's tokens too.
///
/// v1 note: push-daemon currently only sends FCM to *owners* (managers) -
/// see PROJECT.md's "Future work". Registering the token now means nothing
/// has to change here later when the daemon starts sending to developers too.
class PushRepository {
  PushRepository({FirebaseMessaging? messaging, FirebaseFirestore? firestore})
      : _messaging = messaging ?? FirebaseMessaging.instance,
        _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseMessaging _messaging;
  final FirebaseFirestore _firestore;

  Future<void> requestPermissionAndRegister(String email) async {
    await _messaging.requestPermission(alert: true, badge: true, sound: true);
    final token = await _messaging.getToken();
    if (token != null) await _register(email, token);
    _messaging.onTokenRefresh.listen((newToken) => _register(email, newToken));
  }

  Future<void> _register(String email, String token) {
    return _firestore.collection('pushTokens').doc(token).set({
      'email': email,
      'platform': Platform.isIOS ? 'ios' : 'android',
      'registeredAt': FieldValue.serverTimestamp(),
    });
  }
}
