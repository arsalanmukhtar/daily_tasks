import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/leave_request.dart';
import '../../../data/models/uninformed_leave.dart';
import '../../../data/providers.dart';
import '../../../widgets/kpi_tile.dart';
import '../../../widgets/status_chip.dart';
import '../../uninformed_leave/explain_screen.dart';
import '../apply/apply_leave_screen.dart';

final _dateFormat = DateFormat('d MMM yyyy');

/// Mirrors the web app's My Leaves drawer: KPI tiles, the uninformed-leave
/// banner (app.js's renderUninformedBanner_), and the full request history
/// with a withdraw action on anything still pending.
class MyLeavesScreen extends ConsumerWidget {
  const MyLeavesScreen({required this.email, required this.name, super.key});

  final String email;
  final String name;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (email.isEmpty) return const SizedBox.shrink();

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => ApplyLeaveScreen(email: email, name: name)),
        ),
        icon: const Icon(Icons.add),
        label: const Text('Apply for Leave'),
      ),
      body: StreamBuilder<List<LeaveRequest>>(
        stream: ref.watch(leaveRepositoryProvider).watchMyRequests(email),
        builder: (context, snapshot) {
          final records = snapshot.data ?? const <LeaveRequest>[];
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator(color: AppColors.techEwOrange));
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            children: [
              _UninformedBanner(email: email),
              _KpiRow(records: records),
              const SizedBox(height: 20),
              Text('History', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              if (records.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Text(
                    'No leave requests yet.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.ink700),
                  ),
                )
              else
                ...records.map((r) => _LeaveRequestCard(request: r)),
            ],
          );
        },
      ),
    );
  }
}

class _KpiRow extends StatelessWidget {
  const _KpiRow({required this.records});
  final List<LeaveRequest> records;

  @override
  Widget build(BuildContext context) {
    int count(String status) => records.where((r) => r.status == status).length;
    final tiles = [
      ('Total', records.length.toString(), AppColors.ink900, AppColors.surface2),
      ('Approved', count('approved').toString(), AppColors.statusApproved, AppColors.statusApprovedBg),
      ('Rejected', count('rejected').toString(), AppColors.statusRejected, AppColors.statusRejectedBg),
      ('Pending', count('requested').toString(), AppColors.statusRequested, AppColors.statusRequestedBg),
    ];
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 8,
      mainAxisSpacing: 8,
      childAspectRatio: 0.85,
      children: [
        for (final (label, value, fg, bg) in tiles) KpiTile(label: label, value: value, foreground: fg, background: bg),
      ],
    );
  }
}

class _UninformedBanner extends ConsumerWidget {
  const _UninformedBanner({required this.email});
  final String email;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return StreamBuilder<List<UninformedLeave>>(
      stream: ref.watch(uninformedLeaveRepositoryProvider).watchMyOpenReports(email),
      builder: (context, snapshot) {
        final reports = snapshot.data ?? const <UninformedLeave>[];
        if (reports.isEmpty) return const SizedBox.shrink();
        final report = reports.first;
        final explained = report.status == 'explained';
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.statusRequestedBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.statusRequested.withValues(alpha: 0.25)),
          ),
          child: Row(
            children: [
              const Icon(Icons.flag_rounded, color: AppColors.statusRequested),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      explained ? 'Explanation submitted' : 'Uninformed absence flagged',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.statusRequested),
                    ),
                    Text(
                      explained
                          ? "Awaiting your manager's review"
                          : (report.rejectionNote.isNotEmpty
                              ? 'Sent back by ${report.reportedBy} - please re-explain'
                              : 'Reported by ${report.reportedBy}'),
                      style: const TextStyle(color: AppColors.statusRequested, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (!explained)
                TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => UninformedExplainScreen(report: report)),
                  ),
                  child: const Text('Resolve'),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _LeaveRequestCard extends StatelessWidget {
  const _LeaveRequestCard({required this.request});
  final LeaveRequest request;

  @override
  Widget build(BuildContext context) {
    final (statusFg, statusBg) = AppColors.forStatus(request.status);
    final (typeFg, typeBg) = AppColors.forType(request.type.value);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    request.startDate != null ? _dateFormat.format(request.startDate!) : request.weekLabel,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                StatusChip(label: request.status.toUpperCase(), foreground: statusFg, background: statusBg),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                StatusChip(label: request.type.familyLabel, foreground: typeFg, background: typeBg),
                if (request.type.hasDurationChip)
                  StatusChip(
                    label: request.type.isShort ? 'Short' : 'Full',
                    foreground: AppColors.durationShort,
                    background: AppColors.durationShortBg,
                  ),
              ],
            ),
            if (request.status == 'requested') ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => _confirmWithdraw(context, request.requestId),
                  style: TextButton.styleFrom(foregroundColor: AppColors.statusRejected),
                  child: const Text('Withdraw'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _confirmWithdraw(BuildContext context, String requestId) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Consumer(
        builder: (dialogContext, ref, _) => AlertDialog(
          title: const Text('Withdraw this request?'),
          content: const Text('This cannot be undone.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
            TextButton(
              onPressed: () {
                ref.read(leaveRepositoryProvider).withdraw(requestId);
                Navigator.pop(dialogContext);
              },
              style: TextButton.styleFrom(foregroundColor: AppColors.statusRejected),
              child: const Text('Withdraw'),
            ),
          ],
        ),
      ),
    );
  }
}
