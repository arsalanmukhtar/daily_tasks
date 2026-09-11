import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/providers.dart';
import '../manager_providers.dart';
import 'widgets/request_filter_bar.dart';
import 'widgets/request_list_view.dart';

/// Pending/active requests - everything not yet archived (see
/// LeaveRequest.isArchived), regardless of decision status (an undecided
/// request past its dates still shows here, actionable). Mirrors the
/// Kotlin app's RequestListScreen.
class RequestsScreen extends ConsumerWidget {
  const RequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestsAsync = ref.watch(allLeaveRequestsProvider);
    final roster = ref.watch(rosterProvider).valueOrNull ?? const [];
    final filter = ref.watch(requestFilterProvider);
    final query = ref.watch(globalSearchQueryProvider);
    final leaveRepository = ref.watch(leaveRepositoryProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: RequestFilterBar(roster: [for (final u in roster) (u.email, u.name)]),
        ),
        Expanded(
          child: requestsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(child: Text('Could not load requests: $err')),
            data: (all) {
              final pending = all.where((r) => !r.isArchived && filter.matches(r) && r.matchesQuery(query)).toList()
                ..sort((a, b) => (b.requestedAt ?? DateTime(0)).compareTo(a.requestedAt ?? DateTime(0)));
              return RequestListView(
                requests: pending,
                leaveRepository: leaveRepository,
                emptyState: _EmptyState(isSearching: query.trim().isNotEmpty),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.isSearching});

  final bool isSearching;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(isSearching ? Icons.search_off_rounded : Icons.inbox_outlined, size: 48, color: AppColors.ink400),
            const SizedBox(height: 12),
            Text(
              isSearching ? 'No requests match your search' : 'No open requests',
              style: TextStyle(color: AppColors.ink500),
            ),
          ],
        ),
      ),
    );
  }
}
