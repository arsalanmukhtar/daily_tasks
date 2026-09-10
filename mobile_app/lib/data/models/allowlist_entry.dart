/// The signed-in user's own profile - mirrors GET /api/auth/me's response
/// (and GET /api/users' entries), the single source of truth for who can
/// sign in and what they're allowed to do (was `allowlist/{email}` in
/// Firestore - see the old firestore.rules and README.md's "Adding or
/// removing a team member").
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

  factory AllowlistEntry.fromJson(Map<String, dynamic> json) {
    return AllowlistEntry(
      email: json['email'] as String? ?? '',
      name: json['name'] as String? ?? '',
      designation: json['designation'] as String? ?? '',
      reportedTo: json['reportedTo'] as String? ?? '',
      domain: json['domain'] as String? ?? 'GIS Developer',
      isOwner: json['isOwner'] as bool? ?? false,
      active: json['active'] as bool? ?? true,
    );
  }
}
