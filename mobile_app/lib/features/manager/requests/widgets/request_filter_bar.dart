import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/models/leave_type.dart';
import '../../../../widgets/filter_pill.dart';
import '../../manager_providers.dart';

/// Status/type/person filter row shared by Requests and Archived - one
/// provider (requestFilterProvider) holds the selection so switching tabs
/// doesn't reset it, mirroring the Kotlin app's LeaveFilterBar.
///
/// Laid out as two rows so every pill fits inside the viewport at once with
/// no horizontal scrolling: Status and Type share the first row, Person
/// (the widest label - a full name) gets the second row to itself.
class RequestFilterBar extends ConsumerWidget {
  const RequestFilterBar({required this.roster, super.key});

  /// (email, name) pairs for the person filter - passed in rather than
  /// fetched here so both Requests and Archived share one GET /api/users
  /// call via their parent screen's provider watch.
  final List<(String email, String name)> roster;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(requestFilterProvider);
    final notifier = ref.read(requestFilterProvider.notifier);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Expanded(
              child: FilterPill<String?>(
                value: filter.status,
                items: const [null, 'requested', 'approved', 'rejected', 'withdrawn'],
                labelOf: (v) => v == null ? 'All statuses' : v[0].toUpperCase() + v.substring(1),
                onChanged: (v) => notifier.state = filter.copyWith(status: () => v),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilterPill<LeaveType?>(
                value: filter.type,
                items: [null, ...LeaveType.values],
                labelOf: (v) => v?.label ?? 'All types',
                onChanged: (v) => notifier.state = filter.copyWith(type: () => v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        FilterPill<String?>(
          value: filter.email,
          items: [null, ...roster.map((r) => r.$1)],
          labelOf: (v) {
            if (v == null) return 'All developers';
            final match = roster.where((r) => r.$1 == v);
            return match.isNotEmpty ? match.first.$2 : v;
          },
          onChanged: (v) => notifier.state = filter.copyWith(email: () => v),
        ),
      ],
    );
  }
}
