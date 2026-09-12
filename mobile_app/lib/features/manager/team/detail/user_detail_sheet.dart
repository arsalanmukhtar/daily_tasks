import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/allowlist_entry.dart';
import '../../../../data/providers.dart';
import '../../../../widgets/avatar.dart';
import '../../../../widgets/note_field_decoration.dart';
import '../../../../widgets/status_chip.dart';

/// View/edit panel for one profile - opened from TeamDirectoryScreen for
/// any user, including the manager's own row. Mirrors
/// RequestDetailSheet's shape: a DraggableScrollableSheet with read-only
/// `_fact` rows that an Edit button flips into a form, then a Cancel/Save
/// footer with the same isSubmitting/try-catch/SnackBar convention.
class UserDetailSheet extends ConsumerStatefulWidget {
  const UserDetailSheet({required this.user, super.key});

  final AllowlistEntry user;

  @override
  ConsumerState<UserDetailSheet> createState() => _UserDetailSheetState();
}

class _UserDetailSheetState extends ConsumerState<UserDetailSheet> {
  bool _editing = false;
  bool _isSubmitting = false;

  late final _nameController = TextEditingController(text: widget.user.name);
  late final _designationController = TextEditingController(text: widget.user.designation);
  late final _domainController = TextEditingController(text: widget.user.domain);
  late final _reportedToController = TextEditingController(text: widget.user.reportedTo);
  late bool _isOwner = widget.user.isOwner;
  late bool _active = widget.user.active;

  @override
  void dispose() {
    _nameController.dispose();
    _designationController.dispose();
    _domainController.dispose();
    _reportedToController.dispose();
    super.dispose();
  }

  bool get _isSelf => widget.user.email == ref.read(authStateProvider).valueOrNull?.email;

  Future<void> _save() async {
    setState(() => _isSubmitting = true);
    try {
      await ref.read(usersRepositoryProvider).updateUser(
            widget.user.email,
            name: _nameController.text.trim(),
            designation: _designationController.text.trim(),
            domain: _domainController.text.trim(),
            reportedTo: _reportedToController.text.trim(),
            isOwner: _isOwner,
            active: _active,
          );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = widget.user;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Avatar(name: u.name, email: u.email, size: 44),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(u.name.isNotEmpty ? u.name : u.email, style: Theme.of(context).textTheme.titleMedium),
                        Text(u.email, style: TextStyle(color: AppColors.ink500, fontSize: 12)),
                      ],
                    ),
                  ),
                  if (!_editing)
                    TextButton.icon(
                      onPressed: () => setState(() => _editing = true),
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      label: const Text('Edit'),
                    ),
                ],
              ),
              const Divider(height: 28),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  children: _editing ? _editForm() : _viewFacts(),
                ),
              ),
              if (_editing) _editFooter(),
            ],
          ),
        );
      },
    );
  }

  List<Widget> _viewFacts() {
    final u = widget.user;
    return [
      _fact('Designation', u.designation.isEmpty ? '-' : u.designation),
      _fact('Domain', u.domain.isEmpty ? '-' : u.domain),
      _fact('Reports to', u.reportedTo.isEmpty ? '-' : u.reportedTo),
      const SizedBox(height: 4),
      Row(
        children: [
          Text('Role', style: TextStyle(color: AppColors.ink500, fontSize: 13)),
          const Spacer(),
          StatusChip(
            label: u.isOwner ? 'MANAGER' : 'DEVELOPER',
            foreground: u.isOwner ? AppColors.brandPrimaryDark : AppColors.meta,
            background: u.isOwner ? AppColors.brandTint : AppColors.metaBg,
          ),
        ],
      ),
      const SizedBox(height: 14),
      Row(
        children: [
          Text('Status', style: TextStyle(color: AppColors.ink500, fontSize: 13)),
          const Spacer(),
          StatusChip(
            label: u.active ? 'ACTIVE' : 'INACTIVE',
            foreground: u.active ? AppColors.statusApproved : AppColors.statusWithdrawn,
            background: u.active ? AppColors.statusApprovedBg : AppColors.statusWithdrawnBg,
          ),
        ],
      ),
    ];
  }

  List<Widget> _editForm() {
    return [
      _editField('Name', _nameController),
      const SizedBox(height: 12),
      _editField('Designation', _designationController),
      const SizedBox(height: 12),
      _editField('Domain', _domainController),
      const SizedBox(height: 12),
      _editField('Reports to (email)', _reportedToController),
      const SizedBox(height: 16),
      _roleAndActiveSwitches(),
    ];
  }

  Widget _editField(String label, TextEditingController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: AppColors.ink500, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(controller: controller, decoration: noteFieldDecoration(label)),
      ],
    );
  }

  /// Disabled (not hidden) when editing your own row - mirrors the
  /// server's PATCH /:email self-lockout guard, so the UI never even
  /// attempts a request the server would reject, and the caption explains
  /// why the switches are dimmed instead of leaving it a mystery.
  Widget _roleAndActiveSwitches() {
    final lockedForSelf = _isSelf;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Manager access'),
          value: _isOwner,
          onChanged: lockedForSelf ? null : (v) => setState(() => _isOwner = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Active'),
          value: _active,
          onChanged: lockedForSelf ? null : (v) => setState(() => _active = v),
        ),
        if (lockedForSelf) ...[
          const SizedBox(height: 4),
          Text(
            "You can't remove your own manager access or deactivate your own account.",
            style: TextStyle(color: AppColors.ink500, fontSize: 12),
          ),
        ],
      ],
    );
  }

  Widget _fact(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          SizedBox(width: 110, child: Text(label, style: TextStyle(color: AppColors.ink500, fontSize: 13))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }

  Widget _editFooter() {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _isSubmitting ? null : () => setState(() => _editing = false),
              child: const Text('Cancel'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _save,
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
    );
  }
}
