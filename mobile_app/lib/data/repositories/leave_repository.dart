import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/attachment.dart';
import '../models/leave_request.dart';
import '../models/leave_type.dart';

/// Developer-facing subset of leaveRequests operations - mirrors app.js's
/// leaveSendBtn click handler (app.js:2659-2730) and the withdraw/dismiss
/// flows. Approve/reject/resolve are the manager's own app, not this one -
/// firestore.rules doesn't grant a non-owner those transitions anyway.
class LeaveRepository {
  LeaveRepository({FirebaseFirestore? firestore}) : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _col => _firestore.collection('leaveRequests');

  /// Live list of the signed-in developer's own requests, newest first -
  /// same `where('email','==',email)` scoping as app.js's fetchLeaveStatus_.
  Stream<List<LeaveRequest>> watchMyRequests(String email) {
    return _col
        .where('email', isEqualTo: email)
        .orderBy('requestedAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map(LeaveRequest.fromDoc).toList());
  }

  /// Creates a new leave request. `customDates` should only be passed for a
  /// non-contiguous multi-date pick (see LeaveRequest.customDates doc).
  Future<String> createLeaveRequest({
    required String email,
    required String name,
    required LeaveType type,
    required String weekLabel,
    required DateTime startDate,
    required DateTime endDate,
    required String reasonHtml,
    List<DateTime>? customDates,
    String halfDayPeriod = '',
    String shortLeaveTime = '',
    String checkOutTime = '',
    String checkInTime = '',
  }) async {
    final payload = <String, dynamic>{
      'email': email,
      'name': name,
      'weekLabel': weekLabel,
      'type': type.value,
      'startDate': Timestamp.fromDate(startDate),
      'endDate': Timestamp.fromDate(endDate),
      'reasonHtml': reasonHtml == '<br>' ? '' : reasonHtml,
      'status': 'requested',
      'requestedAt': FieldValue.serverTimestamp(),
      'resolvedAt': null,
      'resolvedBy': null,
      'attachments': const [],
      'dismissed': false,
    };
    if (customDates != null && customDates.length > 1) {
      payload['customDates'] = customDates.map(Timestamp.fromDate).toList();
    }
    if (type == LeaveType.casualShort) {
      payload['halfDayPeriod'] = halfDayPeriod;
      payload['shortLeaveTime'] = shortLeaveTime;
    } else if (type == LeaveType.casualOutPass) {
      payload['checkOutTime'] = checkOutTime;
      payload['checkInTime'] = checkInTime;
    }
    final ref = await _col.add(payload);
    return ref.id;
  }

  /// Attaches uploaded Drive file metadata right after create - a separate
  /// update because the upload itself only starts once the doc (and thus
  /// requestId) already exists. Matches firestore.rules' fourth update
  /// disjunct, which only allows touching the `attachments` field.
  Future<void> attachFiles(String requestId, List<Attachment> attachments) {
    return _col.doc(requestId).update({'attachments': attachments.map((a) => a.toMap()).toList()});
  }

  /// Only legal while status is still "requested" - firestore.rules rejects
  /// this transition once a manager has already decided.
  Future<void> withdraw(String requestId) {
    return _col.doc(requestId).update({
      'status': 'withdrawn',
      'withdrawnAt': FieldValue.serverTimestamp(),
    });
  }

  /// Acknowledges an already-decided request so it stops showing as "new" -
  /// does not affect status/history, purely a per-viewer flag.
  Future<void> dismiss(String requestId) {
    return _col.doc(requestId).update({'dismissed': true});
  }
}
