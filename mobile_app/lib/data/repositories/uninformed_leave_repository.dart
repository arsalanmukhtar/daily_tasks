import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/uninformed_leave.dart';

/// Developer-facing subset of uninformedLeaves operations - mirrors app.js's
/// fetchOpenUninformedReports_/submitUninformedResolution_ The developer's
/// only write is the `reported -> explained` transition; accept/reject is
/// the manager's Android app.
class UninformedLeaveRepository {
  UninformedLeaveRepository({FirebaseFirestore? firestore}) : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _col => _firestore.collection('uninformedLeaves');

  /// Live list of this developer's own open reports (awaiting their
  /// explanation, or already explained and awaiting the manager) - same
  /// `status in ['reported','explained']` scoping as app.js's
  /// fetchOpenUninformedReports_.
  Stream<List<UninformedLeave>> watchMyOpenReports(String email) {
    return _col
        .where('email', isEqualTo: email)
        .where('status', whereIn: ['reported', 'explained'])
        .snapshots()
        .map((snap) {
      final list = snap.docs.map(UninformedLeave.fromDoc).toList()
        ..sort((a, b) => (b.reportedAt ?? DateTime(0)).compareTo(a.reportedAt ?? DateTime(0)));
      return list;
    });
  }

  Future<UninformedLeave?> fetchById(String reportId) async {
    final doc = await _col.doc(reportId).get();
    return doc.exists ? UninformedLeave.fromDoc(doc) : null;
  }

  /// Submits the developer's explanation - status moves reported -> explained.
  /// firestore.rules only allows this exact field set.
  Future<void> submitExplanation(String reportId, String explanationHtml) {
    return _col.doc(reportId).update({
      'status': 'explained',
      'explanationHtml': explanationHtml,
      'explainedAt': FieldValue.serverTimestamp(),
    });
  }
}
