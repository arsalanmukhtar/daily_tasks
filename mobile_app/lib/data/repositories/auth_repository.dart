import 'dart:async';

import '../../core/api/api_client.dart';
import '../../core/api/auth_token_store.dart';
import '../models/allowlist_entry.dart';

/// Magic-link auth against the self-hosted API that replaced Firebase Auth
/// (see server/src/auth.js, and PROJECT.md's web-cutover/Flutter-unification
/// notes). Exposes [authStateChanges] the same way the old Firebase-backed
/// repository did, so AuthGate/providers.dart need no structural change -
/// only how that stream gets its values changes.
class AuthRepository {
  AuthRepository({required ApiClient apiClient, required this._tokenStore})
    : _api = apiClient;

  final ApiClient _api;
  final AuthTokenStore _tokenStore;

  final _authState = StreamController<AllowlistEntry?>.broadcast();
  Stream<AllowlistEntry?> get authStateChanges => _authState.stream;

  AllowlistEntry? _current;
  AllowlistEntry? get currentUser => _current;
  String currentEmail() => _current?.email.toLowerCase() ?? '';

  /// Emails a sign-in link for [email] (always resolves the same way,
  /// whether or not the email is allowlisted - see the server's doc comment
  /// on anti-enumeration). `platform: 'mobile'` gets a techewapp:// deep
  /// link instead of the web's #verify= hash URL.
  Future<void> requestMagicLink(String email) async {
    await _api.post('/auth/request-link', {
      'email': email,
      'platform': 'mobile',
    });
  }

  /// Redeems a magic-link token (from the techewapp://verify?token=...
  /// deep link), stores the JWT, and fetches the full profile. Throws
  /// ApiException with a human-readable message on failure.
  Future<AllowlistEntry> verifyToken(String token) async {
    final result = await _api.post('/auth/verify', {
      'token': token,
    }) as Map<String, dynamic>;
    await _tokenStore.write(result['token'] as String);
    return _refreshProfile();
  }

  /// Re-checks the stored session on app startup - equivalent to
  /// onAuthStateChanged's restore-session role plus a fresh
  /// getDoc(allowlist/email) check, now GET /api/auth/me re-verifying
  /// `active` server-side on every call. Returns null (and clears the
  /// stored token) if there's no session or it's no longer valid.
  Future<AllowlistEntry?> restoreSession() async {
    final token = await _tokenStore.read();
    if (token == null) {
      _current = null;
      _authState.add(null);
      return null;
    }
    try {
      return await _refreshProfile();
    } on ApiException {
      await signOut();
      return null;
    }
  }

  Future<AllowlistEntry> _refreshProfile() async {
    final json = await _api.get('/auth/me') as Map<String, dynamic>;
    final entry = AllowlistEntry.fromJson(json);
    _current = entry;
    _authState.add(entry);
    return entry;
  }

  Future<void> signOut() async {
    await _tokenStore.clear();
    _current = null;
    _authState.add(null);
  }

  void dispose() {
    _authState.close();
  }
}
