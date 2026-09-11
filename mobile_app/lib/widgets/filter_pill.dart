import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// One rounded, full-width filter dropdown - filled + tinted brand color
/// while a non-default value is picked, a plain hairline pill otherwise, so
/// an active filter is visible at a glance without opening the menu.
/// Shared by every manager screen with a status/type/developer filter
/// (Requests/Archived's RequestFilterBar, Summary's/Report's developer
/// picker) so they all read as one consistent control instead of some
/// being this pill and others a bare Material DropdownButtonFormField.
class FilterPill<T> extends StatelessWidget {
  const FilterPill({
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
