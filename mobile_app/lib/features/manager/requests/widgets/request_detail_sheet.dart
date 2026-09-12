import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/leave_request.dart';
import '../../../../utils/rich_text.dart';
import '../../../../widgets/attachment_chip.dart';
import '../../../../widgets/avatar.dart';
import '../../../../widgets/note_field_decoration.dart';
import '../../../../widgets/status_chip.dart';
import 'leave_dates_calendar_sheet.dart';

final _fullDateFmt = DateFormat('EEEE, d MMMM yyyy');
final _timeFmt = DateFormat('d MMM yyyy, h:mm a');

/// Bottom sheet opened from a RequestCard - full details, and (only while
/// still `requested`) an Approve/Reject flow that reveals an inline
/// optional decision-note field before confirming. Mirrors the Kotlin
/// app's RequestDetailSheet.kt.
class RequestDetailSheet extends StatefulWidget {
  const RequestDetailSheet({required this.request, required this.onDecide, super.key});

  final LeaveRequest request;
  final Future<void> Function({required bool approve, String? note}) onDecide;

  @override
  State<RequestDetailSheet> createState() => _RequestDetailSheetState();
}

class _RequestDetailSheetState extends State<RequestDetailSheet> {
  final _noteController = TextEditingController();
  bool? _decidingApprove; // null = not deciding, true/false = which action's note is showing
  bool _isSubmitting = false;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    setState(() => _isSubmitting = true);
    try {
      await widget.onDecide(approve: _decidingApprove!, note: _noteController.text);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    final (statusFg, statusBg) = AppColors.forStatus(r.status);

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
                        Text(r.name, style: Theme.of(context).textTheme.titleMedium),
                        Text(r.email, style: TextStyle(color: AppColors.ink500, fontSize: 12)),
                      ],
                    ),
                  ),
                  StatusChip(label: r.status.toUpperCase(), foreground: statusFg, background: statusBg),
                ],
              ),
              const Divider(height: 28),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  children: [
                    _fact('Leave type', r.type.label),
                    _dateFact(context, r),
                    if (r.weekLabel.isNotEmpty) _fact('Week', r.weekLabel),
                    if (r.requestedAt != null) _fact('Applied', _timeFmt.format(r.requestedAt!)),
                    if (r.attachments.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text('Attachments', style: Theme.of(context).textTheme.labelLarge),
                      const SizedBox(height: 6),
                      for (final a in r.attachments) AttachmentChip(attachment: a),
                    ],
                    const SizedBox(height: 12),
                    Text('Reason', style: Theme.of(context).textTheme.labelLarge),
                    const SizedBox(height: 6),
                    _noteBox(
                      child: r.reasonHtml.isNotEmpty && r.reasonHtml != '<br>'
                          ? HtmlWidget(normalizeStoredRichText(r.reasonHtml))
                          : const Text('No reason provided.', style: TextStyle(fontStyle: FontStyle.italic)),
                    ),
                    if (r.status != 'requested' && r.decisionNote.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text('Decision note', style: Theme.of(context).textTheme.labelLarge),
                      const SizedBox(height: 6),
                      _noteBox(child: Text(r.decisionNote)),
                    ],
                  ],
                ),
              ),
              if (r.status == 'requested') _buildFooter(context),
            ],
          ),
        );
      },
    );
  }

  /// Bordered, tinted block around the Reason/Decision note bodies - plain
  /// text sitting directly under a label read as one continuous paragraph
  /// with the row of facts above it; this gives each its own visible
  /// boundary instead.
  Widget _noteBox({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.line),
      ),
      child: DefaultTextStyle.merge(
        style: const TextStyle(fontSize: 13.5, height: 1.4),
        child: child,
      ),
    );
  }

  Widget _fact(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(width: 100, child: Text(label, style: TextStyle(color: AppColors.ink500, fontSize: 13))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }

  /// The "Date" row specifically - r.leaveDateSummary already correctly
  /// summarizes a non-contiguous "N days (custom)" pick (matching what
  /// RequestCard shows in the list), and this row is tappable - with a
  /// calendar icon signaling that - to open the actual marked days behind
  /// that summary in LeaveDatesCalendarSheet.
  Widget _dateFact(BuildContext context, LeaveRequest r) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: AppColors.surface,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
          builder: (_) => LeaveDatesCalendarSheet(request: r),
        ),
        child: Row(
          children: [
            SizedBox(width: 100, child: Text('Date', style: TextStyle(color: AppColors.ink500, fontSize: 13))),
            Expanded(
              child: Text(r.leaveDateSummary(_fullDateFmt), style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            Icon(Icons.calendar_month_outlined, size: 18, color: AppColors.brandPrimary),
          ],
        ),
      ),
    );
  }

  Widget _buildFooter(BuildContext context) {
    if (_decidingApprove == null) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => setState(() => _decidingApprove = false),
              icon: const Icon(Icons.close),
              label: const Text('Reject'),
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.statusRejected),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () => setState(() => _decidingApprove = true),
              icon: const Icon(Icons.check),
              label: const Text('Approve'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.statusApproved,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      );
    }
    final approving = _decidingApprove!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _noteController,
          maxLines: 2,
          decoration: noteFieldDecoration(
            approving ? 'Add a note with this approval (optional)' : 'Reason for rejecting (optional)',
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _isSubmitting ? null : () => setState(() => _decidingApprove = null),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _confirm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: approving ? AppColors.statusApproved : AppColors.statusRejected,
                  foregroundColor: Colors.white,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(approving ? 'Confirm approval' : 'Confirm rejection'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
