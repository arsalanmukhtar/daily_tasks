import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/leave_request.dart';
import '../../../../data/providers.dart';
import '../../../../utils/rich_text.dart';
import '../../../../widgets/attachment_chip.dart';
import '../../../../widgets/avatar.dart';
import '../../../../widgets/note_field_decoration.dart';
import '../../../../widgets/status_chip.dart';
import 'leave_dates_calendar_sheet.dart';
import 'replacement_section.dart';

final _fullDateFmt = DateFormat('EEEE, d MMMM yyyy');
final _timeFmt = DateFormat('d MMM yyyy, h:mm a');

/// Bottom sheet opened from a RequestCard - full details, and (only while
/// still `requested`) an Approve/Reject flow that reveals an inline
/// optional decision-note field before confirming. Mirrors the Kotlin
/// app's RequestDetailSheet.kt.
class RequestDetailSheet extends ConsumerStatefulWidget {
  const RequestDetailSheet({required this.request, required this.onDecide, super.key});

  final LeaveRequest request;
  final Future<void> Function({required bool approve, String? note, bool allowReschedule}) onDecide;

  @override
  ConsumerState<RequestDetailSheet> createState() => _RequestDetailSheetState();
}

class _RequestDetailSheetState extends ConsumerState<RequestDetailSheet> {
  final _noteController = TextEditingController();
  bool? _decidingApprove; // null = not deciding, true/false = which action's note is showing
  bool _isSubmitting = false;
  bool _isSendingReminder = false;
  // Only ever meaningful (and only ever shown) alongside a rejection - see
  // LeaveRequest.allowReschedule's doc comment.
  bool _allowReschedule = false;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    setState(() => _isSubmitting = true);
    try {
      await widget.onDecide(
        approve: _decidingApprove!,
        note: _noteController.text,
        allowReschedule: !_decidingApprove! && _allowReschedule,
      );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _sendReminder() async {
    setState(() => _isSendingReminder = true);
    try {
      await ref.read(leaveRepositoryProvider).remindDocs(widget.request.requestId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reminder sent.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not send reminder: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSendingReminder = false);
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
                  StatusChip(label: AppColors.labelForStatus(r.status), foreground: statusFg, background: statusBg),
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
                    if (r.status == 'pending_documentation' && r.docsDueAt != null)
                      _fact('Docs due', _fullDateFmt.format(r.docsDueAt!)),
                    ReplacementSection(leaveRequestId: r.requestId),
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
              if (r.status == 'requested') ...[
                const SizedBox(height: 16),
                _buildFooter(context),
              ],
              if (r.status == 'pending_documentation') ...[
                const SizedBox(height: 16),
                _buildDocsReminderBanner(context),
              ],
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

  /// Shown only while `pending_documentation` - there's nothing to decide
  /// yet, just a heads-up that this developer still owes a reason/document,
  /// and a one-tap way to email them a nudge (see LeaveRepository.remindDocs).
  Widget _buildDocsReminderBanner(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.statusRequestedBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.statusRequested.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.hourglass_top_rounded, size: 18, color: AppColors.statusRequested),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              "Still waiting on their reason/document - they can't be decided until that's in.",
              style: TextStyle(fontSize: 12.5),
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: _isSendingReminder ? null : _sendReminder,
            child: _isSendingReminder
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Send reminder'),
          ),
        ],
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
        // Only offered on a rejection - e.g. "you can only take 2 of the 3
        // days" - lets the requester pick new dates on this same request
        // (via the web app) instead of filing a brand new one. See
        // LeaveRequest.allowReschedule's doc comment.
        if (!approving)
          CheckboxListTile(
            value: _allowReschedule,
            onChanged: (v) => setState(() => _allowReschedule = v ?? false),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            dense: true,
            title: const Text(
              'Allow them to reschedule instead of submitting a new request',
              style: TextStyle(fontSize: 13),
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
