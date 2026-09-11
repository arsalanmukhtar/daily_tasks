import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/leave_type.dart';
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
              child: _FilterPill<String?>(
                value: filter.status,
                items: const [null, 'requested', 'approved', 'rejected', 'withdrawn'],
                labelOf: (v) => v == null ? 'All statuses' : v[0].toUpperCase() + v.substring(1),
                onChanged: (v) => notifier.state = filter.copyWith(status: () => v),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _FilterPill<LeaveType?>(
                value: filter.type,
                items: [null, ...LeaveType.values],
                labelOf: (v) => v?.label ?? 'All types',
                onChanged: (v) => notifier.state = filter.copyWith(type: () => v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _FilterPill<String?>(
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

/// One rounded, full-width filter dropdown - filled + tinted brand color
/// while a non-default value is picked, a plain hairline pill otherwise, so
/// an active filter is visible at a glance without opening the menu.
class _FilterPill<T> extends StatelessWidget {
  const _FilterPill({
    required this.value,
    required this.items,
    required this.labelOf,
    required this.onChanged,
    super.key,
  });

  final T value;
  final List<T> items;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final isActive = value != null;
    return Container(
      height: 42,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: isActive ? AppColors.brandTint.withValues(alpha: 0.45) : AppColors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: isActive ? AppColors.brandPrimary : AppColors.line, width: 1.2),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          isDense: true,
          icon: Icon(Icons.keyboard_arrow_down_rounded, size: 20, color: isActive ? AppColors.brandPrimaryDark : AppColors.ink500),
          borderRadius: BorderRadius.circular(14),
          dropdownColor: AppColors.surface,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isActive ? AppColors.brandPrimaryDark : AppColors.ink900,
          ),
          selectedItemBuilder: (context) => items
              .map(
                (v) => Align(
                  alignment: Alignment.centerLeft,
                  child: Text(labelOf(v), overflow: TextOverflow.ellipsis, maxLines: 1),
                ),
              )
              .toList(),
          items: items
              .map(
                (v) => DropdownMenuItem<T>(
                  value: v,
                  child: Text(
                    labelOf(v),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    style: const TextStyle(fontSize: 14, color: AppColors.ink900, fontWeight: FontWeight.w500),
                  ),
                ),
              )
              .toList(),
          // T is always instantiated as a nullable type at every call site
          // here (String?/LeaveType?), so DropdownButton's ValueChanged<T?>
          // callback already hands back exactly a T - this cast is a no-op
          // at runtime, just satisfying the type checker.
          onChanged: (v) => onChanged(v as T),
        ),
      ),
    );
  }
}
