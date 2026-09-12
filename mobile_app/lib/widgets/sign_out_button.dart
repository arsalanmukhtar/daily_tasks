import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/app_colors.dart';
import '../data/providers.dart';

/// AppBar sign-out control, used by both HomeScreen (developer) and
/// ManagerHomeScreen. Two things a bare `IconButton(Icons.logout)` didn't
/// give us:
/// - a filled, circular chip (the same brandTint-circle-with-dark-icon motif
///   as the sign-in screen's logo mark) so it reads as one deliberate,
///   substantial control - not a thin stray glyph floating in the AppBar -
///   while the glyph inside stays a light, single-weight stroke.
/// - a bottom-sheet confirmation before it actually signs out, matching
///   every other panel in this app (LeaveDatesCalendarSheet, request/
///   uninformed detail sheets) rather than a modal AlertDialog - a stray tap
///   here is easy (top-right corner, every screen) and otherwise unrecoverable
///   mid-task, so it gets the same "are you sure" treatment as Withdraw.
class SignOutButton extends ConsumerWidget {
  const SignOutButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: AppColors.brandTint,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: () => _confirmSignOut(context, ref),
          child: const Padding(
            padding: EdgeInsets.all(9),
            child: Icon(Icons.logout_rounded, size: 19, color: AppColors.brandPrimaryDark),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => const _SignOutConfirmSheet(),
    );
    if (confirmed == true) {
      await ref.read(authRepositoryProvider).signOut();
    }
  }
}

class _SignOutConfirmSheet extends StatelessWidget {
  const _SignOutConfirmSheet();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(color: AppColors.line, borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 20),
            Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(color: AppColors.brandTint, shape: BoxShape.circle),
              child: const Icon(Icons.logout_rounded, color: AppColors.brandPrimaryDark, size: 24),
            ),
            const SizedBox(height: 16),
            Text('Sign out?', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              "You'll need to sign in again to continue.",
              style: TextStyle(color: AppColors.ink700, fontSize: 13.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.brandPrimaryDark,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Sign out'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
