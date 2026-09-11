import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/allowlist_entry.dart';
import '../../../../data/models/uninformed_leave.dart';
import '../../../../utils/rich_text.dart';
import '../../../../widgets/avatar.dart';
import '../../../../widgets/filter_pill.dart';
import '../../../../widgets/rich_text_editor.dart';
import 'uninformed_leave_detail_sheet.dart';

final _dateFmt = DateFormat('EEE, d MMM yyyy');
final _timeFmt = DateFormat('d MMM, h:mm a');

/// Manager files a new report against a developer - developer picker, a
/// backdatable date field, and a rich-text reason. Mirrors the Kotlin
/// app's NewReportCard.
class NewReportCard extends StatefulWidget {
  const NewReportCard({
    required this.roster,
    required this.onSubmit,
    required this.onCancel,
    super.key,
  });

  final List<AllowlistEntry> roster;
  final Future<void> Function({
    required String email,
    required String name,
    required DateTime date,
    required String reasonHtml,
  })
  onSubmit;
  final VoidCallback onCancel;

  @override
  State<NewReportCard> createState() => _NewReportCardState();
}

class _NewReportCardState extends State<NewReportCard> {
  String? _email;
  DateTime _date = DateTime.now();
  final _reasonController = RichTextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _email != null && !_reasonController.isBlank && !_isSubmitting;

  Future<void> _submit() async {
    final entry = widget.roster.firstWhere((u) => u.email == _email);
    setState(() => _isSubmitting = true);
    try {
      await widget.onSubmit(
        email: entry.email,
        name: entry.name,
        date: _date,
        reasonHtml: _reasonController.html,
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('New report', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            FilterPill<String?>(
              value: _email,
              items: [null, ...widget.roster.map((u) => u.email)],
              labelOf: (v) {
                if (v == null) return 'Select developer';
                final match = widget.roster.where((u) => u.email == v);
                return match.isNotEmpty ? match.first.name : v;
              },
              onChanged: (v) => setState(() => _email = v),
            ),
            const SizedBox(height: 12),
            InkWell(
              borderRadius: BorderRadius.circular(999),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                );
                if (picked != null) setState(() => _date = picked);
              },
              child: Container(
                height: 42,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.line, width: 1.2),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.calendar_today_rounded,
                      size: 15,
                      color: AppColors.ink500,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _dateFmt.format(_date),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => setState(() => _date = DateTime.now()),
                child: const Text('Today'),
              ),
            ),
            const SizedBox(height: 8),
            RichTextEditor(
              controller: _reasonController,
              placeholder: 'Why is this being flagged?',
              minLines: 3,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isSubmitting ? null : widget.onCancel,
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _canSubmit ? _submit : null,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Submit report'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A fresh report, still awaiting the developer's explanation - "Resolve"
/// lets the manager skip straight to resolving it without waiting.
/// Mirrors the Kotlin app's OpenReportCard.
class OpenReportCard extends StatefulWidget {
  const OpenReportCard({
    required this.report,
    required this.onResolve,
    super.key,
  });

  final UninformedLeave report;
  final Future<void> Function(String resolutionHtml) onResolve;

  @override
  State<OpenReportCard> createState() => _OpenReportCardState();
}

class _OpenReportCardState extends State<OpenReportCard> {
  bool _resolving = false;
  bool _isSubmitting = false;
  final _controller = RichTextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      await widget.onResolve(_controller.html);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.report;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => showUninformedLeaveDetail(context, r),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Avatar(name: r.name, email: r.email, size: 32),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      r.name,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  if (r.date != null)
                    Text(
                      _dateFmt.format(r.date!),
                      style: TextStyle(color: AppColors.ink500),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              if (r.reasonHtml.isNotEmpty)
                HtmlWidget(normalizeStoredRichText(r.reasonHtml))
              else
                const Text('No reason provided.'),
              Text(
                r.reportedBy.isNotEmpty ? 'Reported by ${r.reportedBy}' : '',
                style: TextStyle(color: AppColors.ink500, fontSize: 12),
              ),
              if (r.rejectionNote.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.statusRejectedBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SENT BACK BY YOU',
                        style: TextStyle(
                          color: AppColors.statusRejected,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      HtmlWidget(normalizeStoredRichText(r.rejectionNote)),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 10),
              if (!_resolving)
                Align(
                  alignment: Alignment.centerRight,
                  child: OutlinedButton(
                    onPressed: () => setState(() => _resolving = true),
                    child: const Text('Resolve'),
                  ),
                )
              else ...[
                RichTextEditor(
                  controller: _controller,
                  placeholder: 'Explain what happened...',
                  minLines: 3,
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => setState(() => _resolving = false),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: _isSubmitting ? null : _submit,
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Save resolution'),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The developer has explained themselves - the manager's actual decision
/// queue. Accept converts it into an approved leave request (server-side,
/// same transaction); Reject bounces it back with a note. Mirrors the
/// Kotlin app's ExplainedReportCard.
class ExplainedReportCard extends StatefulWidget {
  const ExplainedReportCard({
    required this.report,
    required this.onAccept,
    required this.onReject,
    super.key,
  });

  final UninformedLeave report;
  final Future<void> Function(String resolutionHtml) onAccept;
  final Future<void> Function(String rejectionNote) onReject;

  @override
  State<ExplainedReportCard> createState() => _ExplainedReportCardState();
}

class _ExplainedReportCardState extends State<ExplainedReportCard> {
  bool? _deciding; // null = not deciding, true = accept, false = reject
  bool _isSubmitting = false;
  final _controller = RichTextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_deciding == false && _controller.isBlank) {
      return; // reject requires a note
    }
    setState(() => _isSubmitting = true);
    try {
      if (_deciding!) {
        await widget.onAccept(_controller.html);
      } else {
        await widget.onReject(_controller.html);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.report;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => showUninformedLeaveDetail(context, r),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Avatar(name: r.name, email: r.email, size: 32),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      r.name,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  if (r.explainedAt != null)
                    Text(
                      'Explained ${_timeFmt.format(r.explainedAt!)}',
                      style: TextStyle(color: AppColors.ink500, fontSize: 11),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'REPORTED REASON',
                style: TextStyle(
                  color: AppColors.ink500,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
              HtmlWidget(
                r.reasonHtml.isNotEmpty
                    ? normalizeStoredRichText(r.reasonHtml)
                    : '<i>No reason provided.</i>',
              ),
              const SizedBox(height: 8),
              Text(
                "DEVELOPER'S EXPLANATION",
                style: TextStyle(
                  color: AppColors.ink500,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
              HtmlWidget(normalizeStoredRichText(r.explanationHtml)),
              const SizedBox(height: 10),
              if (_deciding == null)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => setState(() => _deciding = false),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.statusRejected,
                        ),
                        child: const Text('Reject'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => setState(() => _deciding = true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.statusApproved,
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Accept'),
                      ),
                    ),
                  ],
                )
              else ...[
                RichTextEditor(
                  controller: _controller,
                  placeholder: _deciding!
                      ? 'Note (optional)'
                      : 'Reason for sending this back',
                  minLines: 2,
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => setState(() => _deciding = null),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed:
                          _isSubmitting ||
                              (_deciding == false && _controller.isBlank)
                          ? null
                          : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _deciding!
                            ? AppColors.statusApproved
                            : AppColors.statusRejected,
                        foregroundColor: Colors.white,
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(_deciding! ? 'Accept & approve' : 'Send back'),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Read-only audit-log entry for an already-resolved report.
class ResolvedReportCard extends StatelessWidget {
  const ResolvedReportCard({required this.report, super.key});

  final UninformedLeave report;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => showUninformedLeaveDetail(context, report),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Avatar(name: report.name, email: report.email, size: 32),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      report.name,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  if (report.resolvedAt != null)
                    Text(
                      _timeFmt.format(report.resolvedAt!),
                      style: TextStyle(color: AppColors.ink500, fontSize: 11),
                    ),
                ],
              ),
              if (report.resolutionHtml.isNotEmpty) ...[
                const SizedBox(height: 6),
                HtmlWidget(normalizeStoredRichText(report.resolutionHtml)),
              ],
              if (report.resolvedBy.isNotEmpty)
                Text(
                  'Resolved by ${report.resolvedBy}',
                  style: TextStyle(color: AppColors.ink500, fontSize: 12),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
