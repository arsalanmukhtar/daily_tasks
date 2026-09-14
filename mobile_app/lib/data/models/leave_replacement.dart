/// A cover-person named on a leave request - GET/PATCH
/// /api/leave-replacements' client shape (see
/// server/src/routes/leaveReplacements.js's toClientShape). Denormalized
/// with a few fields off the parent leave_requests row (requester name/
/// email, dates, request status) since every caller that needs this also
/// needs those - avoids a second round trip to look the parent request up.
class LeaveReplacement {
  const LeaveReplacement({
    required this.id,
    required this.leaveRequestId,
    required this.replacementEmail,
    this.replacementName = '',
    this.status = 'pending',
    this.requestedAt,
    this.respondedAt,
    this.requesterEmail = '',
    this.requesterName = '',
    this.requestStatus = 'requested',
  });

  final String id;
  final String leaveRequestId;
  final String replacementEmail;
  final String replacementName;
  final String status; // pending | accepted | rejected | cancelled
  final DateTime? requestedAt;
  final DateTime? respondedAt;
  final String requesterEmail;
  final String requesterName;
  final String requestStatus;

  factory LeaveReplacement.fromJson(Map<String, dynamic> json) {
    DateTime? dt(String key) {
      final value = json[key] as String?;
      return value == null ? null : DateTime.tryParse(value);
    }

    return LeaveReplacement(
      id: json['id'] as String? ?? '',
      leaveRequestId: json['leaveRequestId'] as String? ?? '',
      replacementEmail: json['replacementEmail'] as String? ?? '',
      replacementName: json['replacementName'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      requestedAt: dt('requestedAt'),
      respondedAt: dt('respondedAt'),
      requesterEmail: json['requesterEmail'] as String? ?? '',
      requesterName: json['requesterName'] as String? ?? '',
      requestStatus: json['requestStatus'] as String? ?? 'requested',
    );
  }
}
