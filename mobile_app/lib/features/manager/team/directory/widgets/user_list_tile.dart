import 'package:flutter/material.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../data/models/allowlist_entry.dart';
import '../../../../../widgets/avatar.dart';
import '../../../../../widgets/status_chip.dart';

/// One row in the Team tab's Directory list - mirrors RequestCard's overall
/// shape (avatar + name/email + a chip row) so the whole manager app's
/// list-tile language stays consistent.
class UserListTile extends StatelessWidget {
  const UserListTile({required this.user, required this.onTap, super.key});

  final AllowlistEntry user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Avatar(name: user.name, email: user.email, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name.isNotEmpty ? user.name : user.email,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    Text(user.email, style: TextStyle(color: AppColors.ink500, fontSize: 12)),
                    if (user.designation.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(user.designation, style: TextStyle(color: AppColors.ink700, fontSize: 12.5)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (user.isOwner)
                    const StatusChip(
                      label: 'MANAGER',
                      foreground: AppColors.brandPrimaryDark,
                      background: AppColors.brandTint,
                    ),
                  if (!user.active) ...[
                    const SizedBox(height: 6),
                    StatusChip(
                      label: 'INACTIVE',
                      foreground: AppColors.statusWithdrawn,
                      background: AppColors.statusWithdrawnBg,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
