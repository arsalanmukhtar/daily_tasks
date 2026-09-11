import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/leave_request.dart';
import '../../../data/providers.dart';
import '../manager_providers.dart';
import '../period_selector.dart';
import 'widgets/request_filter_bar.dart';
import 'widgets/request_list_view.dart';

/// Archived requests - the complement of Requests (see LeaveRequest.isArchived),
/// plus a Year/Quarter/Month/Week drill-down grouped by the request's own
/// start date (falling back to requestedAt) - "when the leave actually
/// happened," not when it was decided. Mirrors the Kotlin app's
/// ArchivedRequestsScreen.
class ArchivedScreen extends ConsumerStatefulWidget {
  const ArchivedScreen({super.key});

  @override
  ConsumerState<ArchivedScreen> createState() => _ArchivedScreenState();
}

class _ArchivedScreenState extends ConsumerState<ArchivedScreen> {
  late Period _period = Period.yearOf(DateTime.now().year);

  DateTime _groupDate(LeaveRequest r) => r.startDate ?? r.requestedAt ?? DateTime(1970);

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(allLeaveRequestsProvider);
    final roster = ref.watch(rosterProvider).valueOrNull ?? const [];
    final filter = ref.watch(requestFilterProvider);
    final query = ref.watch(globalSearchQueryProvider);
    final leaveRepository = ref.watch(leaveRepositoryProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: Column(
            children: [
              PeriodSelector(period: _period, onChanged: (p) => setState(() => _period = p)),
              const SizedBox(height: 8),
              RequestFilterBar(roster: [for (final u in roster) (u.email, u.name)]),
            ],
          ),
        ),
        Expanded(
          child: requestsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(child: Text('Could not load requests: $err')),
            data: (all) {
              final archived = all
                  .where((r) =>
                      r.isArchived && filter.matches(r) && r.matchesQuery(query) && _period.contains(_groupDate(r)))
                  .toList()
                ..sort((a, b) => _groupDate(b).compareTo(_groupDate(a)));
              return RequestListView(
                requests: archived,
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
            Icon(isSearching ? Icons.search_off_rounded : Icons.archive_outlined, size: 48, color: AppColors.ink400),
            const SizedBox(height: 12),
            Text(
              isSearching ? 'No archived requests match your search' : 'No archived requests in this period',
              style: TextStyle(color: AppColors.ink500),
            ),
          ],
        ),
      ),
    );
  }
}
