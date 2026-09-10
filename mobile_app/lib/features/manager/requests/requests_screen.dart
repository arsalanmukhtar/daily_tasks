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
              final pending = all.where((r) => !r.isArchived && filter.matches(r)).toList()
                ..sort((a, b) => (b.requestedAt ?? DateTime(0)).compareTo(a.requestedAt ?? DateTime(0)));
              return RequestListView(
                requests: pending,
                leaveRepository: leaveRepository,
                emptyState: const _EmptyState(),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox_outlined, size: 48, color: AppColors.ink400),
            const SizedBox(height: 12),
            Text('No open requests', style: TextStyle(color: AppColors.ink500)),
          ],
        ),
      ),
    );
  }
}
