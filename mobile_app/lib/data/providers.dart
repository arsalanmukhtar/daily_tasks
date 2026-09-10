import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_client.dart';
import '../core/api/auth_token_store.dart';
import '../core/api/realtime_client.dart';
import 'models/allowlist_entry.dart';
import 'repositories/attachment_repository.dart';
import 'repositories/auth_repository.dart';
import 'repositories/leave_repository.dart';
import 'repositories/push_repository.dart';
import 'repositories/submission_repository.dart';
import 'repositories/uninformed_leave_repository.dart';
import 'repositories/users_repository.dart';

// Bare IP, no TLS by design - see PROJECT.md's web-cutover notes for why
// (small internal team, the IP itself is already reachable from outside
// the VM's network). One place to change if a domain/TLS gets added later.
const _apiBaseUrl = 'http://182.188.28.163:4500/api';
const _wsBaseUrl = 'ws://182.188.28.163:4500/ws';

final authTokenStoreProvider = Provider((ref) => AuthTokenStore());

final apiClientProvider = Provider((ref) {
  return ApiClient(baseUrl: _apiBaseUrl, tokenStore: ref.watch(authTokenStoreProvider));
});

final realtimeClientProvider = Provider((ref) {
  final client = RealtimeClient(wsBaseUrl: _wsBaseUrl, tokenStore: ref.watch(authTokenStoreProvider));
  ref.onDispose(client.dispose);
  return client;
});

final authRepositoryProvider = Provider((ref) {
  final repo = AuthRepository(apiClient: ref.watch(apiClientProvider), tokenStore: ref.watch(authTokenStoreProvider));
  ref.onDispose(repo.dispose);
  return repo;
});
final leaveRepositoryProvider = Provider((ref) {
  return LeaveRepository(apiClient: ref.watch(apiClientProvider), realtime: ref.watch(realtimeClientProvider));
});
final submissionRepositoryProvider = Provider((ref) {
  return SubmissionRepository(apiClient: ref.watch(apiClientProvider), realtime: ref.watch(realtimeClientProvider));
});
final uninformedLeaveRepositoryProvider = Provider((ref) {
  return UninformedLeaveRepository(
    apiClient: ref.watch(apiClientProvider),
    realtime: ref.watch(realtimeClientProvider),
  );
});
final pushRepositoryProvider = Provider((ref) => PushRepository(apiClient: ref.watch(apiClientProvider)));
final attachmentRepositoryProvider = Provider((ref) => AttachmentRepository(apiClient: ref.watch(apiClientProvider)));
final usersRepositoryProvider = Provider((ref) => UsersRepository(apiClient: ref.watch(apiClientProvider)));

/// The full team roster - used by manager screens' developer pickers/filters.
final rosterProvider = FutureProvider<List<AllowlistEntry>>((ref) {
  return ref.watch(usersRepositoryProvider).listAll();
});

/// Set by DeepLinkListener when a techewapp://reset link is malformed
/// (missing its token) - SignInScreen watches this to show the error, since
/// the listener itself has no screen of its own to display one on.
final deepLinkErrorProvider = StateProvider<String?>((ref) => null);

/// Set by DeepLinkListener when a techewapp://reset?token=... link arrives -
/// SignInScreen watches this and switches to the "set a new password" form.
/// The token itself isn't redeemed until that form is submitted (unlike the
/// old magic-link flow, which exchanged its token immediately on catch).
final pendingResetTokenProvider = StateProvider<String?>((ref) => null);

/// The signed-in user's profile - null once signed out. Replaces the old
/// two-step "raw Firebase auth state -> allowlist lookup" chain: the new
/// `/api/auth/me` already re-verifies `active` server-side on every call,
/// so a single stream is enough (see AuthRepository.authStateChanges).
final authStateProvider = StreamProvider<AllowlistEntry?>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  // Kick off session restore once, the first time this provider is read -
  // its result (or lack of one) flows through the same stream AuthGate
  // already watches.
  repo.restoreSession();
  return repo.authStateChanges;
});
