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

  /// Local-state helper for the Team tab's edit sheet - the actual write
  /// still goes through UsersRepository.updateUser (PATCH), this is just
  /// for building the form's working copy / optimistic display.
  AllowlistEntry copyWith({
    String? name,
    String? designation,
    String? reportedTo,
    String? domain,
    bool? isOwner,
    bool? active,
  }) {
    return AllowlistEntry(
      email: email,
      name: name ?? this.name,
      designation: designation ?? this.designation,
      reportedTo: reportedTo ?? this.reportedTo,
      domain: domain ?? this.domain,
      isOwner: isOwner ?? this.isOwner,
      active: active ?? this.active,
    );
  }

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
