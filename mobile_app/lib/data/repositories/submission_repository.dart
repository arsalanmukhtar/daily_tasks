import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/submission.dart';

const _taskFormatVersion = 'rows-v1'; // matches app.js's TASK_FORMAT_VERSION

/// Mirrors app.js's submitWeek_()/fetchUserSubmissions_() (app.js:3448-3494).
class SubmissionRepository {
  SubmissionRepository({FirebaseFirestore? firestore}) : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _col => _firestore.collection('submissions');

  Stream<List<Submission>> watchMySubmissions(String email) {
    return _col
        .where('email', isEqualTo: email)
        .snapshots()
        .map((snap) => snap.docs.map(Submission.fromDoc).toList());
  }

  Future<Submission?> fetchByWeekLabel(String email, String weekLabel) async {
    final doc = await _col.doc(Submission.docIdFor(email, weekLabel)).get();
    return doc.exists ? Submission.fromDoc(doc) : null;
  }

  /// Upserts by `{email}_{weekLabel}` doc ID - resubmitting the same week
  /// overwrites it in place, same as the web app.
  Future<void> submitWeek({
    required String email,
    required String name,
    required String designation,
    required String reportedTo,
    required String domain,
    required String weekLabel,
    required String weekRange,
    required List<TaskRow> taskRows,
  }) {
    return _col.doc(Submission.docIdFor(email, weekLabel)).set({
      'email': email,
      'name': name,
      'designation': designation,
      'reportedTo': reportedTo,
      'domain': domain,
      'weekLabel': weekLabel,
      'weekRange': weekRange,
      'taskFormat': _taskFormatVersion,
      'taskRows': taskRows.map((r) => r.toMap()).toList(),
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }
}
