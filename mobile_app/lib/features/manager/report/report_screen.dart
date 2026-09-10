import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/providers.dart';
import '../manager_providers.dart';
import 'widgets/report_cards.dart';

/// Three stacked sections - Needs your decision (explained) / Open reports
/// (reported) / Resolutions (resolved, read-only audit log) - plus a "New
/// report" form. Mirrors the Kotlin app's ReportScreen/ReportViewModel.
class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  bool _showNewReport = false;
  String? _developerFilter;

  @override
  Widget build(BuildContext context) {
    final reportsAsync = ref.watch(allUninformedLeavesProvider);
    final roster = ref.watch(rosterProvider).valueOrNull ?? const [];
    final uninformedRepo = ref.watch(uninformedLeaveRepositoryProvider);

    return reportsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Could not load reports: $err')),
      data: (all) {
        final filtered = _developerFilter == null ? all : all.where((r) => r.email == _developerFilter).toList();
        final explained = filtered.where((r) => r.status == 'explained').toList()
          ..sort((a, b) => (a.explainedAt ?? DateTime(0)).compareTo(b.explainedAt ?? DateTime(0)));
        final open = filtered.where((r) => r.status == 'reported').toList()
          ..sort((a, b) => (a.reportedAt ?? DateTime(0)).compareTo(b.reportedAt ?? DateTime(0)));
        final resolved = filtered.where((r) => r.status == 'resolved').toList()
          ..sort((a, b) => (b.resolvedAt ?? DateTime(0)).compareTo(a.resolvedAt ?? DateTime(0)));

        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    initialValue: _developerFilter,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Developer', border: OutlineInputBorder()),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('All developers')),
                      for (final u in roster) DropdownMenuItem(value: u.email, child: Text(u.name)),
                    ],
                    onChanged: (v) => setState(() => _developerFilter = v),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton.icon(
                  onPressed: () => setState(() => _showNewReport = !_showNewReport),
                  icon: Icon(_showNewReport ? Icons.close : Icons.add),
                  label: Text(_showNewReport ? 'Cancel' : 'New report'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_showNewReport)
              NewReportCard(
                roster: roster,
                onCancel: () => setState(() => _showNewReport = false),
                onSubmit: ({required email, required name, required date, required reasonHtml}) async {
                  await uninformedRepo.report(email: email, name: name, date: date, reasonHtml: reasonHtml);
                  if (mounted) setState(() => _showNewReport = false);
                },
              ),
            if (explained.isNotEmpty) ...[
              _sectionHeader(context, 'Needs your decision', explained.length),
              for (final r in explained)
                ExplainedReportCard(
                  report: r,
                  onAccept: (html) => uninformedRepo.resolve(r.reportId, html),
                  onReject: (note) => uninformedRepo.reject(r.reportId, note),
                ),
              const SizedBox(height: 12),
            ],
            if (open.isNotEmpty) ...[
              _sectionHeader(context, 'Open reports', open.length),
              for (final r in open)
                OpenReportCard(report: r, onResolve: (html) => uninformedRepo.resolve(r.reportId, html)),
              const SizedBox(height: 12),
            ],
            if (resolved.isNotEmpty) ...[
              _sectionHeader(context, 'Resolutions', resolved.length, subtitle: 'Audit log'),
              for (final r in resolved) ResolvedReportCard(report: r),
            ],
            if (explained.isEmpty && open.isEmpty && resolved.isEmpty && !_showNewReport)
              Padding(
                padding: const EdgeInsets.all(32),
                child: Center(
                  child: Text('No uninformed-absence reports.', style: TextStyle(color: AppColors.ink500)),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _sectionHeader(BuildContext context, String title, int count, {String? subtitle}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text('$title · $count', style: Theme.of(context).textTheme.titleMedium),
          if (subtitle != null) ...[
            const SizedBox(width: 8),
            Text(subtitle, style: TextStyle(color: AppColors.ink500, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}
