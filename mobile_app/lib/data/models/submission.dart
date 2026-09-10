/// One row of the weekly task grid. The web app's table has 5 fixed
/// columns - Mon/Tue/Wed/Thu/Fri - and a row is one line-item repeated
/// across those days; `taskRows` on a submission is a plain array of
/// `{Mon: html, Tue: html, ...}` maps, exactly what app.js's
/// serializeTaskTable() produces. A day's cell is rich text (HTML), same
/// `<br>` == empty convention as reasonHtml elsewhere.
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

/// Mirrors the server's submissions client shape (GET /api/submissions[/mine],
/// PUT /api/submissions/:weekLabel - see server/src/routes/submissions.js).
class Submission {
  const Submission({
    required this.id,
    this.email = '',
    this.weekLabel = '',
    this.weekRange = '',
    this.designation = '',
    this.taskRows = const [],
    this.updatedAt,
  });

  final String id;
  final String email;
  final String weekLabel;
  final String weekRange;
  final String designation;
  final List<TaskRow> taskRows;
  final DateTime? updatedAt;

  factory Submission.fromJson(Map<String, dynamic> json) {
    return Submission(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      weekLabel: json['weekLabel'] as String? ?? '',
      weekRange: json['weekRange'] as String? ?? '',
      designation: json['designation'] as String? ?? '',
      taskRows: (json['taskRows'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(TaskRow.fromMap)
              .toList() ??
          const [],
      updatedAt: (json['updatedAt'] as String?) != null ? DateTime.tryParse(json['updatedAt'] as String) : null,
    );
  }
}
