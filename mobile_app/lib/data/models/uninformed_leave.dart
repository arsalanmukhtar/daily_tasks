/// Mirrors the server's uninformedLeaves client shape (GET/POST/PATCH
/// /api/uninformed-leaves - see server/src/routes/uninformedLeaves.js's
/// toClientShape). A manager
/// files one of these when a developer was absent without ever applying for
/// leave; the developer explains themselves (reported -> explained), the
/// manager then accepts (-> resolved, converted into an approved
/// leaveRequests doc by push-daemon) or rejects (-> reported, with a note).
class UninformedLeave {
  const UninformedLeave({
    required this.reportId,
    this.email = '',
    this.name = '',
    this.date,
    this.reasonHtml = '',
    this.reportedBy = '',
    this.reportedAt,
    this.status = 'reported',
    this.explanationHtml = '',
    this.explainedAt,
    this.rejectionNote = '',
    this.rejectionNoteAt,
    this.resolvedAt,
    this.resolvedBy = '',
    this.resolutionHtml = '',
    this.linkedRequestId = '',
  });

  final String reportId;
  final String email;
  final String name;
  final DateTime? date;
  final String reasonHtml;
  final String reportedBy;
  final DateTime? reportedAt;
  final String status; // reported | explained | resolved
  final String explanationHtml;
  final DateTime? explainedAt;
  final String rejectionNote;
  final DateTime? rejectionNoteAt;
  final DateTime? resolvedAt;
  final String resolvedBy;
  final String resolutionHtml;
  final String linkedRequestId;

  factory UninformedLeave.fromJson(Map<String, dynamic> json) {
    DateTime? dt(String key) {
      final value = json[key] as String?;
      return value == null ? null : DateTime.tryParse(value);
    }

    return UninformedLeave(
      reportId: json['reportId'] as String? ?? '',
      email: json['email'] as String? ?? '',
      name: json['name'] as String? ?? '',
      date: dt('date'),
      reasonHtml: json['reasonHtml'] as String? ?? '',
      reportedBy: json['reportedBy'] as String? ?? '',
      reportedAt: dt('reportedAt'),
      status: json['status'] as String? ?? 'reported',
      explanationHtml: json['explanationHtml'] as String? ?? '',
      explainedAt: dt('explainedAt'),
      rejectionNote: json['rejectionNote'] as String? ?? '',
      rejectionNoteAt: dt('rejectionNoteAt'),
      resolvedAt: dt('resolvedAt'),
      resolvedBy: json['resolvedBy'] as String? ?? '',
      resolutionHtml: json['resolutionHtml'] as String? ?? '',
      linkedRequestId: json['linkedRequestId'] as String? ?? '',
    );
  }
}
