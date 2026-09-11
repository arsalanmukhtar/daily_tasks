import 'package:flutter/material.dart';

/// Originally a direct translation of the retired Kotlin app's Color.kt;
/// the brand hues below have since moved off that orange to a blue ("sky")
/// palette (see the mobile UI refactor notes in PROJECT.md) while every
/// other role - status/type/duration chips, neutrals - is unchanged, so
/// those still trace back to android-app's Theme.kt where it once existed.
class AppColors {
  AppColors._();

  // Brand - Tailwind's "sky" scale.
  static const brandPrimary = Color(0xFF0284C7); // sky-600
  static const brandPrimaryDark = Color(0xFF075985); // sky-800

  // Status
  static const statusRequested = Color(0xFF92400E);
  static const statusRequestedBg = Color(0xFFFEF3C7);
  static const statusApproved = Color(0xFF166534);
  static const statusApprovedBg = Color(0xFFDCFCE7);
  static const statusRejected = Color(0xFFB91C1C);
  static const statusRejectedBg = Color(0xFFFFE2E3);
  static const statusWithdrawn = Color(0xFF49454F);
  static const statusWithdrawnBg = Color(0xFFE7E0EB);

  // Leave-type family colors
  static const typeForeignTrip = Color(0xFF3B5BDB);
  static const typeForeignTripBg = Color(0xFFE8EDFC);
  static const typeUmrah = Color(0xFF0E8A7D);
  static const typeUmrahBg = Color(0xFFDFF2EF);
  static const typeMedical = Color(0xFF0B7FA8);
  static const typeMedicalBg = Color(0xFFDFF0F8);
  static const typeCasual = Color(0xFF6C4CC4);
  static const typeCasualBg = Color(0xFFEDE7FA);

  // Duration colors
  static const durationShort = Color(0xFF0369A1);
  static const durationShortBg = Color(0xFFE3EFF8);
  static const durationFull = Color(0xFF3730A3);
  static const durationFullBg = Color(0xFFE9E8F8);
  static const durationOutPass = Color(0xFF0F766E);
  static const durationOutPassBg = Color(0xFFE3F4F2);

  // Meta (neutral informational chips - week label, submitted timestamp)
  static const meta = Color(0xFF54607A);
  static const metaBg = Color(0xFFECEEF4);

  // Neutral scale (SignIn*Light in Color.kt) - background/surface/text/borders.
  // True neutral gray (zero chroma), sampled from the same screens/mobile/*.png
  // references the Kotlin app's light theme was built from.
  static const bg = Color(0xFFF6F6F4);
  static const surface = Color(0xFFFFFFFF);
  static const surface2 = Color(0xFFECEBE8); // filled chip/tile background
  static const surface3 = Color(0xFFE0DEDA);
  static const ink900 = Color(0xFF131316); // headings, primary text
  static const ink700 = Color(0xFF75757A); // muted captions/secondary text
  static const ink500 = Color(0xFF9C9C9F);
  static const ink400 = Color(0xFFC2C2C4);
  static const line = Color(0xFFE6E4DF); // hairline card border
  static const lineStrong = Color(0xFFD1CFC9);
  static const brandTint = Color(0xFFBAE6FD); // primaryContainer, e.g. "Q1-Q4" badge - sky-200
  static const brandTintStrong = Color(0xFF7DD3FC); // sky-300

  /// (foreground, background) pair for a leave status - mirrors
  /// RequestCard.kt's typeColors()-adjacent status lookup.
  static (Color, Color) forStatus(String status) => switch (status) {
        'approved' => (statusApproved, statusApprovedBg),
        'rejected' => (statusRejected, statusRejectedBg),
        'withdrawn' => (statusWithdrawn, statusWithdrawnBg),
        _ => (statusRequested, statusRequestedBg), // 'requested'
      };

  /// (foreground, background) pair for a leave type family - mirrors
  /// RequestCard.kt's typeColors().
  static (Color, Color) forType(String type) => switch (type) {
        'foreignTrip' => (typeForeignTrip, typeForeignTripBg),
        'umrah' => (typeUmrah, typeUmrahBg),
        'medical' => (typeMedical, typeMedicalBg),
        'uninformedAbsence' => (statusRequested, statusRequestedBg),
        _ => (typeCasual, typeCasualBg), // casualShort / casualFull / casualOutPass family label
      };

  /// (foreground, background) pair for a duration chip - mirrors
  /// RequestCard.kt's durationColors().
  static (Color, Color) forDuration(String type) => switch (type) {
        'casualShort' => (durationShort, durationShortBg),
        'casualOutPass' => (durationOutPass, durationOutPassBg),
        _ => (durationFull, durationFullBg),
      };
}
