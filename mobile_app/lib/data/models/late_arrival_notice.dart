/// A developer's self-filed "I'll be late" notice - GET/PATCH
/// /api/late-arrival-notices' client shape (see
/// server/src/routes/lateArrivalNotices.js's toClientShape). Purely
/// informational - submitted/acknowledged only, no accept/reject workflow.
class LateArrivalNotice {
  const LateArrivalNotice({
    required this.id,
    required this.email,
    this.name = '',
    required this.date,
    this.expectedArrivalTime,
    this.reasonHtml = '',
    this.attachments = const [],
    this.status = 'submitted',
    this.createdAt,
    this.acknowledgedAt,
    this.acknowledgedBy = '',
  });

  final String id;
  final String email;
  final String name;
  final DateTime date;
  final String? expectedArrivalTime; // 'HH:MM'
  final String reasonHtml;
  final List<Map<String, dynamic>> attachments; // [{name,url,fileId}]
  final String status; // submitted | acknowledged
  final DateTime? createdAt;
  final DateTime? acknowledgedAt;
  final String acknowledgedBy;

  factory LateArrivalNotice.fromJson(Map<String, dynamic> json) {
    DateTime? dt(String key) {
      final value = json[key] as String?;
      return value == null ? null : DateTime.tryParse(value);
    }

    return LateArrivalNotice(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      name: json['name'] as String? ?? '',
      date: DateTime.parse(json['date'] as String),
      expectedArrivalTime: json['expectedArrivalTime'] as String?,
      reasonHtml: json['reasonHtml'] as String? ?? '',
      attachments: (json['attachments'] as List<dynamic>?)?.whereType<Map<String, dynamic>>().toList() ?? const [],
      status: json['status'] as String? ?? 'submitted',
      createdAt: dt('createdAt'),
      acknowledgedAt: dt('acknowledgedAt'),
      acknowledgedBy: json['acknowledgedBy'] as String? ?? '',
    );
  }
}
