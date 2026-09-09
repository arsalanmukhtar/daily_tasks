import 'package:cloud_firestore/cloud_firestore.dart';

/// Mirrors `allowlist/{email}` - the single source of truth for who can
/// sign in and what they're allowed to do (see firestore.rules and
/// README.md's "Adding or removing a team member").
class AllowlistEntry {
  const AllowlistEntry({
    required this.email,
    this.name = '',
    this.designation = '',
    this.reportedTo = '',
    this.domain = 'GIS Developer',
    this.isOwner = false,
    this.active = true,
  });

  final String email;
  final String name;
  final String designation;
  final String reportedTo;
  final String domain;
  final bool isOwner;
  final bool active;

  factory AllowlistEntry.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return AllowlistEntry(
      email: doc.id,
      name: data['name'] as String? ?? '',
      designation: data['designation'] as String? ?? '',
      reportedTo: data['reportedTo'] as String? ?? '',
      domain: data['domain'] as String? ?? 'GIS Developer',
      isOwner: data['isOwner'] as bool? ?? false,
      active: data['active'] as bool? ?? true,
    );
  }
}
