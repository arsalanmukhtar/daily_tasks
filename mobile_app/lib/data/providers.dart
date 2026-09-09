import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'models/allowlist_entry.dart';
import 'repositories/attachment_repository.dart';
import 'repositories/auth_repository.dart';
import 'repositories/leave_repository.dart';
import 'repositories/push_repository.dart';
import 'repositories/submission_repository.dart';
import 'repositories/uninformed_leave_repository.dart';

final authRepositoryProvider = Provider((ref) => AuthRepository());
final leaveRepositoryProvider = Provider((ref) => LeaveRepository());
final submissionRepositoryProvider = Provider((ref) => SubmissionRepository());
final uninformedLeaveRepositoryProvider = Provider((ref) => UninformedLeaveRepository());
final pushRepositoryProvider = Provider((ref) => PushRepository());
final attachmentRepositoryProvider = Provider((ref) => AttachmentRepository());

/// Raw Firebase auth state - null once signed out.
final authStateProvider = StreamProvider((ref) {
  return ref.watch(authRepositoryProvider).authStateChanges;
});

/// The signed-in user's allowlist entry, re-checked whenever the Firebase
/// auth state changes - null while signed out or not yet resolved, and
/// `AsyncError` if the account isn't authorized (see AuthGate, which reads
/// this to decide what to show).
final currentAllowlistEntryProvider = FutureProvider<AllowlistEntry?>((ref) async {
  final authState = ref.watch(authStateProvider).value;
  if (authState == null) return null;
  final email = authState.email?.toLowerCase();
  if (email == null) return null;
  final result = await ref.watch(authRepositoryProvider).checkAllowlist(email);
  if (result.entry == null) {
    throw AllowlistDeniedException(result.deniedReason ?? 'Access denied.');
  }
  return result.entry;
});

class AllowlistDeniedException implements Exception {
  AllowlistDeniedException(this.message);
  final String message;
  @override
  String toString() => message;
}
