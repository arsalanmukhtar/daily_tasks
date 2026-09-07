package com.techew.leaveapprovals.ui.theme

import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.SelectableChipColors
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

// Material3's own FilterChip/NavigationBarItem selected-state defaults read
// from secondaryContainer, which here is the orange brand tint (deliberately
// kept muddy/dark so it doesn't compete with the real orange accent) - fine
// for a tinted badge, but illegible/ugly as a "this is selected" fill. Every
// selected toggle in the app instead uses this near-white/dark-text pairing
// (same inverseSurface/inverseOnSurface tokens already used for solid CTAs).
@Composable
fun themedFilterChipColors(): SelectableChipColors = FilterChipDefaults.filterChipColors(
    selectedContainerColor = MaterialTheme.colorScheme.inverseSurface,
    selectedLabelColor = MaterialTheme.colorScheme.inverseOnSurface,
    selectedLeadingIconColor = MaterialTheme.colorScheme.inverseOnSurface
)

@Composable
fun themedNavigationBarItemColors() = NavigationBarItemDefaults.colors(
    indicatorColor = MaterialTheme.colorScheme.inverseSurface,
    selectedIconColor = MaterialTheme.colorScheme.inverseOnSurface
)
