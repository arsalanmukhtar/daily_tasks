import 'package:shared_preferences/shared_preferences.dart';

/// Stores the signed-in JWT - the mobile equivalent of app.js's
/// localStorage-backed techew_authToken key.
class AuthTokenStore {
  static const _key = 'techew_authToken';

  Future<String?> read() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_key);
  }

  Future<void> write(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, token);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
