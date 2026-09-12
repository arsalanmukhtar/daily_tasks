import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/providers.dart';
import '../../manager_providers.dart';
import '../detail/user_detail_sheet.dart';
import '../team_providers.dart';
import 'widgets/user_list_tile.dart';

/// The whole team roster, searchable via the shared GlobalSearchBar shown
/// above every manager tab - tap a row to view/edit that person's profile
/// (including your own, via the same sheet).
class TeamDirectoryScreen extends ConsumerWidget {
  const TeamDirectoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rosterAsync = ref.watch(rosterProvider);
    final query = ref.watch(globalSearchQueryProvider);

    return rosterAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Could not load the team: $err')),
      data: (roster) {
        final sorted = [...roster]..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
        final filtered = sorted.where((u) => u.matchesQuery(query)).toList();

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '${roster.length} ${roster.length == 1 ? 'person' : 'people'} on the team',
                  style: TextStyle(color: AppColors.ink500, fontSize: 12.5, fontWeight: FontWeight.w600),
                ),
              ),
            ),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text(
                        query.trim().isEmpty ? 'No team members yet.' : 'No one matches your search',
                        style: TextStyle(color: AppColors.ink500),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final user = filtered[i];
                        return UserListTile(
                          user: user,
                          onTap: () => showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            backgroundColor: AppColors.surface,
                            shape: const RoundedRectangleBorder(
                              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                            ),
                            builder: (_) => UserDetailSheet(user: user),
                          ),
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }
}
