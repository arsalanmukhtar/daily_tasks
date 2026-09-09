import 'package:cloud_firestore/cloud_firestore.dart';

/// Mirrors android-app's data/UninformedLeave.kt field-for-field. A manager
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

  factory UninformedLeave.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    DateTime? ts(String key) => (data[key] as Timestamp?)?.toDate();
    return UninformedLeave(
      reportId: doc.id,
      email: data['email'] as String? ?? '',
      name: data['name'] as String? ?? '',
      date: ts('date'),
      reasonHtml: data['reasonHtml'] as String? ?? '',
      reportedBy: data['reportedBy'] as String? ?? '',
      reportedAt: ts('reportedAt'),
      status: data['status'] as String? ?? 'reported',
      explanationHtml: data['explanationHtml'] as String? ?? '',
      explainedAt: ts('explainedAt'),
      rejectionNote: data['rejectionNote'] as String? ?? '',
      rejectionNoteAt: ts('rejectionNoteAt'),
      resolvedAt: ts('resolvedAt'),
      resolvedBy: data['resolvedBy'] as String? ?? '',
      resolutionHtml: data['resolutionHtml'] as String? ?? '',
      linkedRequestId: data['linkedRequestId'] as String? ?? '',
    );
  }
}
