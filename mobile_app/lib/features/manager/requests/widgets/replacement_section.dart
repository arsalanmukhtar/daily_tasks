import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/providers.dart';
import '../../../../widgets/note_field_decoration.dart';
import '../../../../widgets/status_chip.dart';
import '../../manager_providers.dart';

/// Shows who (if anyone) is covering this leave request while the requester
/// is away, and lets a manager reassign it while it hasn't been accepted yet
/// (see server/src/routes/leaveReplacements.js's PATCH /:id guard). Reading
/// this is manager-only in mobile by design - accepting/declining the
/// invite itself is the replacement's own action and lives on the web app
/// instead (see PROJECT.md's manager-in-mobile/normal-user-on-web split).
/// Renders nothing at all if no replacement was ever named - most requests.
class ReplacementSection extends ConsumerWidget {
  const ReplacementSection({required this.leaveRequestId, super.key});

  final String leaveRequestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final all = ref.watch(allLeaveReplacementsProvider).valueOrNull ?? const [];
    final matches = all.where((r) => r.leaveRequestId == leaveRequestId);
    if (matches.isEmpty) return const SizedBox.shrink();
    final rep = matches.first;

    final (fg, bg) = switch (rep.status) {
      'accepted' => (AppColors.statusApproved, AppColors.statusApprovedBg),
      'rejected' => (AppColors.statusRejected, AppColors.statusRejectedBg),
      _ => (AppColors.statusRequested, AppColors.statusRequestedBg), // pending
    };
    final canReassign = rep.status == 'pending' || rep.status == 'rejected';

    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Replacement', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(
                  rep.replacementName.isNotEmpty ? rep.replacementName : rep.replacementEmail,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              StatusChip(label: rep.status.toUpperCase(), foreground: fg, background: bg),
            ],
          ),
          if (canReassign) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => _showReassignSheet(context, ref, rep.id, rep.replacementEmail),
                icon: const Icon(Icons.swap_horiz_rounded, size: 18),
                label: const Text('Reassign'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showReassignSheet(BuildContext context, WidgetRef ref, String replacementId, String currentEmail) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _ReassignSheet(replacementId: replacementId, currentEmail: currentEmail),
    );
  }
}

class _ReassignSheet extends ConsumerStatefulWidget {
  const _ReassignSheet({required this.replacementId, required this.currentEmail});

  final String replacementId;
  final String currentEmail;

  @override
  ConsumerState<_ReassignSheet> createState() => _ReassignSheetState();
}

class _ReassignSheetState extends ConsumerState<_ReassignSheet> {
  String? _selected;
  bool _isSubmitting = false;
  String? _error;

  Future<void> _confirm() async {
    final email = _selected;
    if (email == null) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref.read(leaveReplacementsRepositoryProvider).reassign(widget.replacementId, email);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not reassign: $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Eligible replacements: active, non-manager users other than whoever's
    // already assigned - matches the same pool the web app's leave-apply
    // picker draws from (see server's users route - `isOwner: false`).
    final roster = ref.watch(rosterProvider).valueOrNull ?? const [];
    final eligible = roster.where((u) => u.active && !u.isOwner && u.email != widget.currentEmail).toList()
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Reassign replacement', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            if (eligible.isEmpty)
              Text('No other eligible team members.', style: TextStyle(color: AppColors.ink500))
            else
              DropdownButtonFormField<String>(
                initialValue: _selected,
                decoration: noteFieldDecoration('Choose a replacement'),
                items: [
                  for (final u in eligible) DropdownMenuItem(value: u.email, child: Text(u.name.isNotEmpty ? u.name : u.email)),
                ],
                onChanged: (v) => setState(() => _selected = v),
              ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: AppColors.statusRejected, fontSize: 12.5)),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSubmitting || _selected == null ? null : _confirm,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Save'),
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
