import '../../core/api/api_client.dart';

/// Registers this device for push notifications - currently a documented
/// no-op. FCM (`firebase_messaging`) was removed along with the rest of
/// Firebase, so there's no token to generate here any more, and nothing on
/// the new server (`server/src/routes/pushTokens.js` exists but nothing
/// sends FCM pushes yet) consumes one either. See PROJECT.md's
/// Flutter-unification notes: background push delivery (notifying a
/// manager with the app fully closed) is a known, deliberately deferred
/// gap - realtime while the app is open/connected is covered by
/// RealtimeClient's WebSocket instead. Kept as a real class (not deleted)
/// so home_screen.dart's call site needs no change when this gets built
/// for real in a follow-up phase.
class PushRepository {
  PushRepository({required ApiClient apiClient}) : _api = apiClient;

  // ignore: unused_field
  final ApiClient _api;

  Future<void> requestPermissionAndRegister(String email) async {}
}
