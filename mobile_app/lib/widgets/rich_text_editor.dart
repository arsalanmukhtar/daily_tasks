import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import 'note_field_decoration.dart';

/// A single text replacement: [start, oldEnd) in the old text became
/// [start, newEnd) in the new text - derived from the old/new strings'
/// common prefix/suffix so paste/autocorrect/multi-char replace all remap
/// spans correctly, not just "insert at cursor". Direct port of
/// RichTextEditor.kt's TextEdit/computeTextEdit.
class _TextEdit {
  const _TextEdit(this.start, this.oldEnd, this.newEnd);
  final int start;
  final int oldEnd;
  final int newEnd;
}

_TextEdit _computeTextEdit(String oldText, String newText) {
  final maxCommon = oldText.length < newText.length ? oldText.length : newText.length;
  var start = 0;
  while (start < maxCommon && oldText[start] == newText[start]) {
    start++;
  }
  var oldEnd = oldText.length;
  var newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] == newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return _TextEdit(start, oldEnd, newEnd);
}

/// Ranges below are half-open [start, end) character offsets, always sorted
/// and non-overlapping (see _merge).
List<TextRange> _merge(List<TextRange> ranges) {
  final sorted = ranges.where((r) => r.start < r.end).toList()..sort((a, b) => a.start.compareTo(b.start));
  if (sorted.isEmpty) return const [];
  final merged = <TextRange>[sorted.first];
  for (final r in sorted.skip(1)) {
    final last = merged.last;
    if (r.start <= last.end) {
      merged[merged.length - 1] = TextRange(start: last.start, end: r.end > last.end ? r.end : last.end);
    } else {
      merged.add(r);
    }
  }
  return merged;
}

List<TextRange> _subtract(List<TextRange> ranges, TextRange remove) {
  final result = <TextRange>[];
  for (final r in ranges) {
    if (remove.end <= r.start || remove.start >= r.end) {
      result.add(r);
      continue;
    }
    if (remove.start > r.start) result.add(TextRange(start: r.start, end: remove.start));
    if (remove.end < r.end) result.add(TextRange(start: remove.end, end: r.end));
  }
  return result.where((r) => r.start < r.end).toList();
}

bool _isFullyCovered(List<TextRange> ranges, TextRange target) {
  if (target.start >= target.end) return false;
  var pos = target.start;
  final sorted = [...ranges]..sort((a, b) => a.start.compareTo(b.start));
  for (final r in sorted) {
    if (r.end <= pos) continue;
    if (r.start > pos) return false;
    pos = r.end;
    if (pos >= target.end) return true;
  }
  return pos >= target.end;
}

List<TextRange> _toggle(List<TextRange> ranges, TextRange selection) =>
    _isFullyCovered(ranges, selection) ? _subtract(ranges, selection) : _merge([...ranges, selection]);

List<TextRange> _remap(List<TextRange> ranges, _TextEdit edit) {
  final delta = (edit.newEnd - edit.start) - (edit.oldEnd - edit.start);
  final result = <TextRange>[];
  for (final r in ranges) {
    if (r.end <= edit.start) {
      result.add(r);
    } else if (r.start >= edit.oldEnd) {
      result.add(TextRange(start: r.start + delta, end: r.end + delta));
    } else {
      if (r.start < edit.start) result.add(TextRange(start: r.start, end: edit.start));
      if (r.end > edit.oldEnd) result.add(TextRange(start: edit.newEnd, end: r.end + delta));
    }
  }
  return _merge(result);
}

String _escapeHtml(String text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/// Direct port of RichTextEditor.kt's buildRichTextHtml() - same `<p>` /
/// `<b>`/`<i>`/`<u>` / `<br/>` shape every other client (web's
/// HtmlCompat-equivalent rendering, push-daemon's emails) already expects.
String buildRichTextHtml(String text, List<TextRange> bold, List<TextRange> italic, List<TextRange> underline) {
  if (text.trim().isEmpty) return '';
  final boundaries = <int>{0, text.length};
  for (final r in [...bold, ...italic, ...underline]) {
    boundaries.add(r.start.clamp(0, text.length));
    boundaries.add(r.end.clamp(0, text.length));
  }
  final points = boundaries.toList()..sort();
  final sb = StringBuffer('<p>');
  for (var i = 0; i < points.length - 1; i++) {
    final start = points[i];
    final end = points[i + 1];
    if (start >= end) continue;
    var segment = _escapeHtml(text.substring(start, end)).replaceAll('\n', '<br/>');
    if (underline.any((r) => start >= r.start && end <= r.end)) segment = '<u>$segment</u>';
    if (italic.any((r) => start >= r.start && end <= r.end)) segment = '<i>$segment</i>';
    if (bold.any((r) => start >= r.start && end <= r.end)) segment = '<b>$segment</b>';
    sb.write(segment);
  }
  sb.write('</p>');
  return sb.toString();
}

/// Tracks bold/italic/underline as three independent lists of disjoint
/// ranges (see RichTextEditor.kt's RichTextState for why: toggling one
/// style never has to know about the other two).
class RichTextEditingController extends TextEditingController {
  List<TextRange> boldRanges = const [];
  List<TextRange> italicRanges = const [];
  List<TextRange> underlineRanges = const [];
  String _previousText = '';

  bool get isBlank => text.trim().isEmpty;
  String get html => buildRichTextHtml(text, boldRanges, italicRanges, underlineRanges);

  TextRange? get _selectionRange {
    final sel = selection;
    if (!sel.isValid || sel.start >= sel.end) return null;
    return TextRange(start: sel.start, end: sel.end);
  }

  bool get boldActive => _selectionRange != null && _isFullyCovered(boldRanges, _selectionRange!);
  bool get italicActive => _selectionRange != null && _isFullyCovered(italicRanges, _selectionRange!);
  bool get underlineActive => _selectionRange != null && _isFullyCovered(underlineRanges, _selectionRange!);
  bool get hasSelection => _selectionRange != null;

  void _remapForCurrentText() {
    if (text == _previousText) return;
    final edit = _computeTextEdit(_previousText, text);
    boldRanges = _remap(boldRanges, edit);
    italicRanges = _remap(italicRanges, edit);
    underlineRanges = _remap(underlineRanges, edit);
    _previousText = text;
  }

  void toggleBold() {
    final sel = _selectionRange;
    if (sel == null) return;
    boldRanges = _toggle(boldRanges, sel);
    notifyListeners();
  }

  void toggleItalic() {
    final sel = _selectionRange;
    if (sel == null) return;
    italicRanges = _toggle(italicRanges, sel);
    notifyListeners();
  }

  void toggleUnderline() {
    final sel = _selectionRange;
    if (sel == null) return;
    underlineRanges = _toggle(underlineRanges, sel);
    notifyListeners();
  }

  @override
  set value(TextEditingValue newValue) {
    super.value = newValue;
    _remapForCurrentText();
  }

  @override
  TextSpan buildTextSpan({required BuildContext context, TextStyle? style, required bool withComposing}) {
    _remapForCurrentText();
    final children = <TextSpan>[];
    final boundaries = <int>{0, text.length};
    for (final r in [...boldRanges, ...italicRanges, ...underlineRanges]) {
      boundaries.add(r.start.clamp(0, text.length));
      boundaries.add(r.end.clamp(0, text.length));
    }
    final points = boundaries.toList()..sort();
    for (var i = 0; i < points.length - 1; i++) {
      final start = points[i];
      final end = points[i + 1];
      if (start >= end) continue;
      final isBold = boldRanges.any((r) => start >= r.start && end <= r.end);
      final isItalic = italicRanges.any((r) => start >= r.start && end <= r.end);
      final isUnderline = underlineRanges.any((r) => start >= r.start && end <= r.end);
      children.add(TextSpan(
        text: text.substring(start, end),
        style: style?.copyWith(
          fontWeight: isBold ? FontWeight.bold : null,
          fontStyle: isItalic ? FontStyle.italic : null,
          decoration: isUnderline ? TextDecoration.underline : null,
        ),
      ));
    }
    return TextSpan(style: style, children: children);
  }
}

/// Bold/Italic/Underline editor producing the same HTML shape used
/// everywhere else in this product (reasonHtml/resolutionHtml/
/// explanationHtml/rejectionNote) - see RichTextEditor.kt, the Kotlin
/// original this is a direct port of.
class RichTextEditor extends StatelessWidget {
  const RichTextEditor({
    required this.controller,
    this.placeholder = '',
    this.minLines = 4,
    super.key,
  });

  final RichTextEditingController controller;
  final String placeholder;
  final int minLines;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  _FormatToggleButton(
                    icon: Icons.format_bold,
                    active: controller.boldActive,
                    enabled: controller.hasSelection,
                    onPressed: controller.toggleBold,
                  ),
                  _FormatToggleButton(
                    icon: Icons.format_italic,
                    active: controller.italicActive,
                    enabled: controller.hasSelection,
                    onPressed: controller.toggleItalic,
                  ),
                  _FormatToggleButton(
                    icon: Icons.format_underlined,
                    active: controller.underlineActive,
                    enabled: controller.hasSelection,
                    onPressed: controller.toggleUnderline,
                  ),
                  const Spacer(),
                  Text('Rich text', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.ink700)),
                ],
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: controller,
              minLines: minLines,
              maxLines: null,
              decoration: noteFieldDecoration(placeholder),
            ),
          ],
        );
      },
    );
  }
}

class _FormatToggleButton extends StatelessWidget {
  const _FormatToggleButton({required this.icon, required this.active, required this.enabled, required this.onPressed});

  final IconData icon;
  final bool active;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final color = !enabled
        ? AppColors.ink400
        : active
            ? AppColors.brandPrimary
            : AppColors.ink700;
    return IconButton(icon: Icon(icon, color: color), onPressed: enabled ? onPressed : null);
  }
}
