/// Same 7-type taxonomy as the web app's LEAVE_TYPES/LEAVE_TYPE_ALIASES,
/// the Kotlin app's LeaveType.kt, and push-daemon/leaveType.js - kept in
/// the same `type` Firestore field. Aliased forward from the old binary
/// 'short'/'full' values so this app describes old and new requests the
/// same way every other client already does.
enum LeaveType {
  casualShort('casualShort', 'Short Leave', 'Casual'),
  casualFull('casualFull', 'Full Leave', 'Casual'),
  casualOutPass('casualOutPass', 'Out Pass', 'Casual'),
  medical('medical', 'Medical', 'Medical'),
  foreignTrip('foreignTrip', 'Foreign Trip', 'Foreign Trip'),
  umrah('umrah', 'Umrah', 'Umrah'),
  // Read-only: created server-side by push-daemon when a manager's
  // uninformed-leave report is accepted. Never selectable when applying.
  uninformedAbsence('uninformedAbsence', 'Uninformed Leave', 'Uninformed Leave');

  const LeaveType(this.value, this.label, this.familyLabel);

  final String value;
  final String label;
  final String familyLabel;

  /// Types a developer can actually pick when applying for leave -
  /// uninformedAbsence is excluded (server-created only).
  static const selectable = [casualShort, casualFull, casualOutPass, medical, foreignTrip, umrah];

  static LeaveType normalize(String? raw) {
    switch (raw) {
      case 'short':
        return casualShort;
      case 'full':
        return casualFull;
      default:
        return LeaveType.values.firstWhere(
          (t) => t.value == raw,
          orElse: () => casualShort,
        );
    }
  }

  bool get isShort => this == casualShort;
  bool get hasDurationChip => this == casualShort || this == casualFull;
}
