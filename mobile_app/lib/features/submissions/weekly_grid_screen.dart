import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/week_utils.dart';
import '../../data/models/allowlist_entry.dart';
import '../../data/models/submission.dart';
import '../../data/providers.dart';
import '../../widgets/rich_text_editor.dart' show buildRichTextHtml;

final _dateFormat = DateFormat('d MMM');

/// One line-item's Mon-Fri text, backed by 5 plain TextEditingControllers.
/// v1 scope note: grid cells are plain text, not full B/I/U rich text (see
/// ApplyLeaveScreen's note on scope) - still saved through
/// buildRichTextHtml() so the stored shape matches what the web app and
/// push-daemon already expect (a `<p>...</p>` wrapper, `<br/>` for
/// newlines), just with no bold/italic/underline ranges applied.
class _RowControllers {
  _RowControllers() : controllers = {for (final d in TaskRow.days) d: TextEditingController()};

  final Map<String, TextEditingController> controllers;

  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
  }

  TaskRow toTaskRow() => TaskRow({for (final d in TaskRow.days) d: buildRichTextHtml(controllers[d]!.text, [], [], [])});
}

class WeeklyGridScreen extends ConsumerStatefulWidget {
  const WeeklyGridScreen({required this.entry, required this.weekStart, this.existing, super.key});

  final AllowlistEntry entry;
  final DateTime weekStart;
  final Submission? existing;

  @override
  ConsumerState<WeeklyGridScreen> createState() => _WeeklyGridScreenState();
}

class _WeeklyGridScreenState extends ConsumerState<WeeklyGridScreen> {
  final List<_RowControllers> _rows = [];
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null && existing.taskRows.isNotEmpty) {
      for (final row in existing.taskRows) {
        final rc = _RowControllers();
        for (final d in TaskRow.days) {
          rc.controllers[d]!.text = _stripHtml(row.forDay(d));
        }
        _rows.add(rc);
      }
    } else {
      _rows.add(_RowControllers());
    }
  }

  @override
  void dispose() {
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  /// Best-effort plain-text extraction for re-editing a row that may have
  /// been created (or last edited) on the web with real formatting - strips
  /// tags rather than trying to round-trip B/I/U into this simplified grid.
  String _stripHtml(String html) {
    return html
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'<[^>]+>'), '')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .trim();
  }

  Future<void> _submit() async {
    final weekLabel = weekLabelFromDate(widget.weekStart);
    final days = weekdaysOf(widget.weekStart);
    final weekRange = '${DateFormat('yyyy-MM-dd').format(days.first)} to ${DateFormat('yyyy-MM-dd').format(days.last)}';
    final taskRows = _rows.map((r) => r.toTaskRow()).where((r) => r.hasContent).toList();
    if (taskRows.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter your tasks.')));
      return;
    }
    setState(() => _isSubmitting = true);
    try {
      await ref.read(submissionRepositoryProvider).submitWeek(
            email: widget.entry.email,
            name: widget.entry.name,
            designation: widget.entry.designation,
            reportedTo: widget.entry.reportedTo,
            domain: widget.entry.domain,
            weekLabel: weekLabel,
            weekRange: weekRange,
            taskRows: taskRows,
          );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not submit - please try again.')));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final days = weekdaysOf(widget.weekStart);
    final week = isoWeekOf(widget.weekStart);
    return Scaffold(
      appBar: AppBar(title: Text(week.label)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              '${_dateFormat.format(days.first)} - ${_dateFormat.format(days.last)}',
              style: const TextStyle(color: AppColors.ink700),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _rows.length,
              itemBuilder: (context, rowIndex) {
                final row = _rows[rowIndex];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text('Task ${rowIndex + 1}', style: const TextStyle(fontWeight: FontWeight.w700)),
                            const Spacer(),
                            if (_rows.length > 1)
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 20),
                                onPressed: () => setState(() {
                                  _rows.removeAt(rowIndex).dispose();
                                }),
                              ),
                          ],
                        ),
                        for (final day in TaskRow.days) ...[
                          const SizedBox(height: 8),
                          TextField(
                            controller: row.controllers[day],
                            minLines: 1,
                            maxLines: 3,
                            decoration: InputDecoration(
                              labelText: '$day, ${_dateFormat.format(days[TaskRow.days.indexOf(day)])}',
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => setState(() => _rows.add(_RowControllers())),
                    icon: const Icon(Icons.add),
                    label: const Text('Add task'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
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
          ),
        ],
      ),
    );
  }
}
