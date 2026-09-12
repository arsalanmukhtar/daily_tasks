import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Shared look for every "type a note/reason" field that sits next to a
/// read-only rich-text display box (a request's Reason, an uninformed
/// report's reasonHtml/explanationHtml) - request_detail_sheet.dart's
/// approve/reject note and rich_text_editor.dart's editable body both use
/// this. Two things it deliberately does NOT do:
/// - fill with AppColors.surface2: that's the color of the box it sits
///   next to, and the two need to read as different things (one you read,
///   one you type into), not the same gray twice in a row.
/// - fall back to a bare OutlineInputBorder(): that draws Flutter's default
///   ~2px border, which read as a heavy box against everything else in this
///   app's deliberately borderless/hairline styling.
const _kNoteFieldRadius = 10.0;

InputDecoration noteFieldDecoration(String hint) {
  const border = OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(_kNoteFieldRadius)),
    borderSide: BorderSide(color: AppColors.lineStrong),
  );
  return InputDecoration(
    hintText: hint,
    filled: true,
    fillColor: AppColors.surface,
    border: border,
    enabledBorder: border,
    focusedBorder: const OutlineInputBorder(
      borderRadius: BorderRadius.all(Radius.circular(_kNoteFieldRadius)),
      borderSide: BorderSide(color: AppColors.brandPrimary),
    ),
  );
}
