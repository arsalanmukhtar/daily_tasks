import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

// Urbanist everywhere - same family the web app pulls from Google Fonts
// (see index.html). Built once here rather than inline per TextStyle below.
final _urbanistTextTheme = GoogleFonts.urbanistTextTheme();

/// Same light theme as every other surface in this product: white cards on
/// a barely-off-white page, near-black text, a thin hairline outline doing
/// the work of separating elements instead of shadows - mirrors
/// android-app's Theme.kt (LightColorScheme) and index.html/styles.css.
final appTheme = ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: AppColors.bg,
  fontFamily: GoogleFonts.urbanist().fontFamily,
  colorScheme: const ColorScheme.light(
    primary: AppColors.brandPrimary,
    onPrimary: Colors.white,
    primaryContainer: AppColors.brandTint,
    onPrimaryContainer: AppColors.brandPrimaryDark,
    secondaryContainer: AppColors.brandTint,
    surface: AppColors.surface,
    onSurface: AppColors.ink900,
    surfaceContainerHighest: AppColors.surface3,
    surfaceContainerHigh: AppColors.surface2,
    surfaceContainerLow: AppColors.surface,
    surfaceContainerLowest: AppColors.bg,
    outline: AppColors.lineStrong,
    outlineVariant: AppColors.line,
    inverseSurface: AppColors.ink900,
    onInverseSurface: AppColors.surface,
    error: AppColors.statusRejected,
    onError: Colors.white,
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: AppColors.surface,
    foregroundColor: AppColors.ink900,
    elevation: 0,
    scrolledUnderElevation: 0.5,
    centerTitle: false,
  ),
  cardTheme: CardThemeData(
    color: AppColors.surface,
    elevation: 0,
    margin: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: const BorderSide(color: AppColors.line),
    ),
  ),
  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: AppColors.surface,
    indicatorColor: AppColors.brandTint,
    labelTextStyle: WidgetStateProperty.resolveWith(
      (states) => TextStyle(
        fontSize: 12,
        fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
        color: states.contains(WidgetState.selected) ? AppColors.brandPrimaryDark : AppColors.ink700,
      ),
    ),
    iconTheme: WidgetStateProperty.resolveWith(
      (states) => IconThemeData(
        color: states.contains(WidgetState.selected) ? AppColors.brandPrimaryDark : AppColors.ink700,
      ),
    ),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: AppColors.brandPrimary,
      foregroundColor: Colors.white,
      elevation: 0,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(50)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: AppColors.ink900,
      side: const BorderSide(color: AppColors.lineStrong),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(50)),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: AppColors.surface2,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide.none,
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
  ),
  dividerTheme: const DividerThemeData(color: AppColors.line, thickness: 1, space: 1),
  textTheme: _urbanistTextTheme.copyWith(
    headlineSmall: _urbanistTextTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: AppColors.ink900),
    titleLarge: _urbanistTextTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: AppColors.ink900),
    titleMedium: _urbanistTextTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.ink900),
    bodyMedium: _urbanistTextTheme.bodyMedium?.copyWith(color: AppColors.ink900),
    bodySmall: _urbanistTextTheme.bodySmall?.copyWith(color: AppColors.ink700),
    labelLarge: _urbanistTextTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
  ),
);
