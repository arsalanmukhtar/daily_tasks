import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../data/models/uninformed_leave.dart';
import '../../data/providers.dart';
import '../../utils/rich_text.dart';
import '../../widgets/rich_text_editor.dart';

final _dateFormat = DateFormat('EEEE, d MMM yyyy');

/// Mirrors the web app's Resolve Uninformed Leave drawer
/// (openUninformedResolveDrawer_/submitUninformedResolution_,
/// app.js:1955-2047) - the developer explains what happened; status moves
/// reported -> explained, then it's the manager's Android app that
/// accepts/rejects it.
class UninformedExplainScreen extends ConsumerStatefulWidget {
  const UninformedExplainScreen({required this.report, super.key});

  final UninformedLeave report;

  @override
  ConsumerState<UninformedExplainScreen> createState() => _UninformedExplainScreenState();
}

class _UninformedExplainScreenState extends ConsumerState<UninformedExplainScreen> {
  final _controller = RichTextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_controller.isBlank) {
      setState(() => _error = 'Please explain what happened before submitting.');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref.read(uninformedLeaveRepositoryProvider).submitExplanation(widget.report.reportId, _controller.html);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not submit - please try again.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final report = widget.report;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Explain the Absence'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (report.date != null)
            Text(_dateFormat.format(report.date!), style: const TextStyle(color: AppColors.ink700)),
          const SizedBox(height: 16),
          Text('REPORTED REASON', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.ink700)),
          const SizedBox(height: 6),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.surface2, borderRadius: BorderRadius.circular(10)),
            child: HtmlWidget(
              report.reasonHtml.isEmpty ? '<i>No reason provided.</i>' : normalizeStoredRichText(report.reasonHtml),
            ),
          ),
          if (report.reportedBy.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('Reported by ${report.reportedBy}', style: const TextStyle(color: AppColors.ink700, fontSize: 12)),
          ],
          if (report.rejectionNote.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'SENT BACK BY YOUR MANAGER',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.statusRequested),
            ),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.statusRequestedBg, borderRadius: BorderRadius.circular(10)),
              child: HtmlWidget(normalizeStoredRichText(report.rejectionNote)),
            ),
          ],
          const SizedBox(height: 16),
          Text('YOUR EXPLANATION', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.ink700)),
          const SizedBox(height: 6),
          RichTextEditor(controller: _controller, placeholder: 'Explain what happened...'),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: AppColors.statusRejected, fontSize: 12)),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(
                      width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Submit'),
            ),
          ),
        ],
      ),
    );
  }
}
