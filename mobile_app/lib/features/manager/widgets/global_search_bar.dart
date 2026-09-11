import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../manager_providers.dart';

/// One search box shared by every manager tab, shown above everything else
/// in ManagerHomeScreen's body (not per-tab) so the query - and the text
/// still typed in the box - survives switching tabs. Requests/Archived/
/// Report each additionally filter their own list by
/// globalSearchQueryProvider (see LeaveRequestSearch/UninformedLeaveSearch
/// in manager_providers.dart); Summary stays a pure aggregate view and
/// isn't affected, since a free-text query has no clean meaning against a
/// chart.
class GlobalSearchBar extends ConsumerStatefulWidget {
  const GlobalSearchBar({super.key});

  @override
  ConsumerState<GlobalSearchBar> createState() => _GlobalSearchBarState();
}

class _GlobalSearchBarState extends ConsumerState<GlobalSearchBar> {
  late final _controller = TextEditingController(text: ref.read(globalSearchQueryProvider));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // This widget is built once in ManagerHomeScreen (outside the tabs'
    // IndexedStack), so _controller lives for the whole manager session -
    // no need to reconcile it against the provider on every build.
    final query = ref.watch(globalSearchQueryProvider);

    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: query.isNotEmpty ? AppColors.brandPrimary : AppColors.line, width: 1.2),
      ),
      child: Row(
        children: [
          Icon(Icons.search_rounded, size: 20, color: query.isNotEmpty ? AppColors.brandPrimaryDark : AppColors.ink500),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _controller,
              onChanged: (v) => ref.read(globalSearchQueryProvider.notifier).state = v,
              textInputAction: TextInputAction.search,
              style: const TextStyle(fontSize: 14, color: AppColors.ink900),
              decoration: const InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: 'Search requests, reports, developers…',
                hintStyle: TextStyle(color: AppColors.ink500, fontSize: 14),
              ),
            ),
          ),
          if (query.isNotEmpty)
            GestureDetector(
              onTap: () {
                _controller.clear();
                ref.read(globalSearchQueryProvider.notifier).state = '';
              },
              child: const Icon(Icons.close_rounded, size: 18, color: AppColors.ink500),
            ),
        ],
      ),
    );
  }
}
