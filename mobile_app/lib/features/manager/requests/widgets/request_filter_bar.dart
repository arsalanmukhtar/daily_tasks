import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/models/leave_type.dart';
import '../../manager_providers.dart';

/// Status/type/person filter row shared by Requests and Archived - one
/// provider (requestFilterProvider) holds the selection so switching tabs
/// doesn't reset it, mirroring the Kotlin app's LeaveFilterBar.
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

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          _dropdown<String?>(
            label: 'Status',
            value: filter.status,
            items: const [null, 'requested', 'approved', 'rejected', 'withdrawn'],
            labelOf: (v) => v == null ? 'All statuses' : v[0].toUpperCase() + v.substring(1),
            onChanged: (v) => notifier.state = filter.copyWith(status: () => v),
          ),
          const SizedBox(width: 8),
          _dropdown<LeaveType?>(
            label: 'Type',
            value: filter.type,
            items: [null, ...LeaveType.values],
            labelOf: (v) => v?.label ?? 'All types',
            onChanged: (v) => notifier.state = filter.copyWith(type: () => v),
          ),
          const SizedBox(width: 8),
          _dropdown<String?>(
            label: 'Person',
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
      ),
    );
  }

  Widget _dropdown<T>({
    required String label,
    required T value,
    required List<T> items,
    required String Function(T) labelOf,
    required ValueChanged<T> onChanged,
  }) {
    return DropdownButtonHideUnderline(
      child: DropdownButton<T>(
        value: value,
        items: items.map((v) => DropdownMenuItem(value: v, child: Text(labelOf(v)))).toList(),
        // T is always instantiated as a nullable type at every call site
        // here (String?/LeaveType?), so DropdownButton's ValueChanged<T?>
        // callback already hands back exactly a T - this cast is a no-op
        // at runtime, just satisfying the type checker.
        onChanged: (v) => onChanged(v as T),
        hint: Text(label),
        borderRadius: BorderRadius.circular(10),
      ),
    );
  }
}
