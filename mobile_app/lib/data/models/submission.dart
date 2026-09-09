import 'package:cloud_firestore/cloud_firestore.dart';

/// One row of the weekly task grid. The web app's table has 5 fixed
/// columns - Mon/Tue/Wed/Thu/Fri - and a row is one line-item repeated
/// across those days; `taskRows` on a `submissions` doc is a plain array of
/// `{Mon: html, Tue: html, ...}` maps, exactly what app.js's
/// serializeTaskTable() produces (app.js:371-385). A day's cell is rich
/// text (HTML), same `<br>` == empty convention as reasonHtml elsewhere.
class TaskRow {
  const TaskRow(this.byDay);

  static const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  final Map<String, String> byDay;

  factory TaskRow.empty() => const TaskRow({'Mon': '', 'Tue': '', 'Wed': '', 'Thu': '', 'Fri': ''});

  factory TaskRow.fromMap(Map<String, dynamic> map) =>
      TaskRow({for (final d in days) d: map[d] as String? ?? ''});

  Map<String, dynamic> toMap() => byDay;

  String forDay(String day) => byDay[day] ?? '';

  TaskRow withDay(String day, String html) => TaskRow({...byDay, day: html});

  bool get hasContent => byDay.values.any((html) => html.isNotEmpty && html != '<br>');
}

/// Mirrors the `submissions/{email}_{sanitizedWeekLabel}` doc shape written
/// by app.js's submitWeek_() (see app.js:3471-3490).
class Submission {
  const Submission({
    required this.docId,
    this.email = '',
    this.weekLabel = '',
    this.weekRange = '',
    this.designation = '',
    this.taskRows = const [],
    this.updatedAt,
  });

  final String docId;
  final String email;
  final String weekLabel;
  final String weekRange;
  final String designation;
  final List<TaskRow> taskRows;
  final DateTime? updatedAt;

  factory Submission.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Submission(
      docId: doc.id,
      email: data['email'] as String? ?? '',
      weekLabel: data['weekLabel'] as String? ?? '',
      weekRange: data['weekRange'] as String? ?? '',
      designation: data['designation'] as String? ?? '',
      taskRows: (data['taskRows'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(TaskRow.fromMap)
              .toList() ??
          const [],
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
    );
  }

  /// `{email}_{sanitizedWeekLabel}` - must match app.js's
  /// sanitizeWeekLabel_()/submissionDocId_() exactly so the same week's
  /// submission from either client lands on the same document.
  static String docIdFor(String email, String weekLabel) {
    final sanitized = weekLabel.replaceAll(RegExp(r'[^a-zA-Z0-9]+'), '-').replaceAll(RegExp(r'^-+|-+$'), '');
    return '${email}_$sanitized';
  }
}
