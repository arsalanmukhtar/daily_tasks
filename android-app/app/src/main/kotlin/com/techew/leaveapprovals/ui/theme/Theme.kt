package com.techew.leaveapprovals.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

// The app's whole "main colors" - background/surface/text/borders - are
// committed to the dark palette from screens/mobile/sign-in.html (the same
// reference the Sign In/Restricted screens are built from), applied
// app-wide rather than only on those two screens. Deliberately NOT the
// same as the semantic accent colors elsewhere (StatusApproved/Rejected,
// TypeCasual/Foreign/Umrah/Medical, DurationShort/Full/OutPass, chart bar
// colors, etc. in Color.kt) - those stay exactly as they were, since they're
// plain literal Color(...) values that never read from this colorScheme.
private val DarkColors = darkColorScheme(
    background = SignInBgDark,
    onBackground = SignInInk900Dark,
    surface = SignInSurfaceDark,
    onSurface = SignInInk900Dark,
    surfaceVariant = SignInSurface2Dark,
    onSurfaceVariant = SignInInk700Dark,
    primary = SignInBrandOnDark,
    onPrimary = SignInInk900Light,
    primaryContainer = SignInBrandTintDark,
    onPrimaryContainer = SignInBrandOnDark,
    secondaryContainer = SignInBrandTintDark,
    outline = SignInLineStrongDark,
    outlineVariant = SignInLineDark,
    inverseSurface = SignInInk900Dark,
    inverseOnSurface = SignInBgDark
)

@Composable
fun LeaveApprovalsTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, content = content)
}
