import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/uninformed_leave.dart';
import '../../../../widgets/avatar.dart';
import '../../../../widgets/status_chip.dart';

final _dateFmt = DateFormat('EEEE, d MMMM yyyy');
final _timeFmt = DateFormat('d MMM yyyy, h:mm a');

/// Full, read-only view of one uninformed-leave report - opened by tapping
/// any Open/Explained/Resolved card on the Report tab. Every card already
/// shows its own content inline (nothing is truncated there), so this
/// isn't "the only place to see the reason" the way RequestDetailSheet is -
/// it exists so a report reads the same focused, single-column way every
/// other detail view in this app does, and so a long
/// reason/explanation/resolution has room to breathe outside the busy
/// scrolling list. Deciding (accept/reject/resolve) stays on the card
/// itself; this sheet is view-only.
void showUninformedLeaveDetail(BuildContext context, UninformedLeave report) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => UninformedLeaveDetailSheet(report: report),
  );
}

(Color, Color) _statusStyle(String status) => switch (status) {
  'resolved' => (AppColors.statusApproved, AppColors.statusApprovedBg),
  'explained' => (AppColors.meta, AppColors.metaBg),
  _ => (AppColors.statusRequested, AppColors.statusRequestedBg), // 'reported'
};

String _statusLabel(String status) => switch (status) {
  'resolved' => 'RESOLVED',
  'explained' => 'EXPLAINED',
  _ => 'OPEN',
};

class UninformedLeaveDetailSheet extends StatelessWidget {
  const UninformedLeaveDetailSheet({required this.report, super.key});

  final UninformedLeave report;

  @override
  Widget build(BuildContext context) {
    final r = report;
    final (statusFg, statusBg) = _statusStyle(r.status);

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Avatar(name: r.name, email: r.email, size: 44),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.name,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(
                          r.email,
                          style: TextStyle(
                            color: AppColors.ink500,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  StatusChip(
                    label: _statusLabel(r.status),
                    foreground: statusFg,
                    background: statusBg,
                  ),
                ],
              ),
              const Divider(height: 28),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  children: [
                    if (r.date != null) _fact('Date', _dateFmt.format(r.date!)),
                    if (r.reportedBy.isNotEmpty)
                      _fact('Reported by', r.reportedBy),
                    if (r.reportedAt != null)
                      _fact('Reported', _timeFmt.format(r.reportedAt!)),
                    if (r.explainedAt != null)
                      _fact('Explained', _timeFmt.format(r.explainedAt!)),
                    if (r.resolvedBy.isNotEmpty)
                      _fact('Resolved by', r.resolvedBy),
                    if (r.resolvedAt != null)
                      _fact('Resolved', _timeFmt.format(r.resolvedAt!)),
                    const SizedBox(height: 8),
                    Text(
                      'Reported reason',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: 6),
                    _noteBox(
                      child: r.reasonHtml.isNotEmpty
                          ? HtmlWidget(r.reasonHtml)
                          : const Text(
                              'No reason provided.',
                              style: TextStyle(fontStyle: FontStyle.italic),
                            ),
                    ),
                    if (r.explanationHtml.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        "Developer's explanation",
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 6),
                      _noteBox(child: HtmlWidget(r.explanationHtml)),
                    ],
                    if (r.rejectionNote.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Sent back with',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 6),
                      _noteBox(
                        tone: AppColors.statusRejectedBg,
                        child: Text(r.rejectionNote),
                      ),
                    ],
                    if (r.resolutionHtml.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Resolution',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 6),
                      _noteBox(
                        tone: AppColors.statusApprovedBg,
                        child: HtmlWidget(r.resolutionHtml),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _fact(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: TextStyle(color: AppColors.ink500, fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _noteBox({required Widget child, Color? tone}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tone ?? AppColors.surface2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.line),
      ),
      child: DefaultTextStyle.merge(
        style: const TextStyle(fontSize: 13.5, height: 1.4),
        child: child,
      ),
    );
  }
}
