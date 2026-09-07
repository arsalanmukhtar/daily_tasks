package com.techew.leaveapprovals.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

// The app's whole "main colors" - background/surface/text/borders - are
// committed to a dark, true-neutral gray palette (see the SignIn*Dark
// constants in Color.kt), applied app-wide. Deliberately NOT the same as
// the semantic accent colors elsewhere (StatusApproved/Rejected,
// TypeCasual/Foreign/Umrah/Medical, DurationShort/Full/OutPass, chart bar
// colors, etc. in Color.kt) - those stay exactly as they were, since
// they're plain literal Color(...) values that never read from this
// colorScheme.
private val DarkColors = darkColorScheme(
    background = SignInBgDark,
    onBackground = SignInInk900Dark,
    surface = SignInSurfaceDark,
    onSurface = SignInInk900Dark,
    surfaceVariant = SignInSurface2Dark,
    onSurfaceVariant = SignInInk700Dark,
    // Material3's Card/Sheet/NavigationBar defaults read from these
    // surfaceContainer* roles, NOT from `surface` above - left unset, they
    // fall back to Material's own neutral-grey baseline tonal palette
    // regardless of the `surface`/`background` overrides, which is exactly
    // why cards were rendering a flat generic grey instead of this warm
    // dark palette. Overriding them here fixes every Card/sheet/nav bar
    // app-wide in one place.
    surfaceContainerLowest = SignInBgDark,
    surfaceContainerLow = SignInSurfaceDark,
    surfaceContainer = SignInSurfaceDark,
    surfaceContainerHigh = SignInSurface2Dark,
    surfaceContainerHighest = SignInSurface3Dark,
    primary = SignInBrandOnDark,
    onPrimary = SignInInk900Light,
    primaryContainer = SignInBrandTintDark,
    onPrimaryContainer = SignInBrandOnDark,
    secondaryContainer = SignInBrandTintDark,
    outline = SignInLineStrongDark,
    outlineVariant = SignInLineDark,
    inverseSurface = SignInInk900Dark,
    inverseOnSurface = SignInBgDark,
    // Matches StatusRejected - every "this went wrong" red in the app
    // (form validation here, request status elsewhere) is the same hue.
    error = StatusRejected
)

@Composable
fun LeaveApprovalsTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, content = content)
}
