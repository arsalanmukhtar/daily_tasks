package com.techew.leaveapprovals.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// The app's whole "main colors" - background/surface/text/borders - are a
// true-neutral near-white/near-black scale sampled directly from the
// screens/mobile/*.png references (see the SignIn*Light constants in
// Color.kt): a barely-off-white page, pure white cards, near-black text,
// and a thin hairline border doing the work of separating elements instead
// of background-color contrast or shadow. Deliberately NOT the same as the
// semantic accent colors elsewhere (StatusApproved/Rejected, TypeCasual/
// Foreign/Umrah/Medical, DurationShort/Full/OutPass, chart bar colors, etc.
// in Color.kt) - those stay exactly as they were, since they're plain
// literal Color(...) values that never read from this colorScheme.
private val LightColors = lightColorScheme(
    background = SignInBgLight,
    onBackground = SignInInk900Light,
    surface = SignInSurfaceLight,
    onSurface = SignInInk900Light,
    surfaceVariant = SignInSurface2Light,
    onSurfaceVariant = SignInInk700Light,
    // Material3's Card/Sheet/NavigationBar defaults read from these
    // surfaceContainer* roles, NOT from `surface` above - left unset, they
    // fall back to Material's own default tonal palette instead of this
    // one. Overriding them here fixes every Card/sheet/nav bar app-wide in
    // one place.
    surfaceContainerLowest = SignInBgLight,
    surfaceContainerLow = SignInSurfaceLight,
    surfaceContainer = SignInSurfaceLight,
    surfaceContainerHigh = SignInSurface2Light,
    surfaceContainerHighest = SignInSurface3Light,
    primary = TechEwOrange,
    onPrimary = Color.White,
    primaryContainer = SignInBrandTintLight,
    onPrimaryContainer = TechEwOrangeDark,
    secondaryContainer = SignInBrandTintLight,
    outline = SignInLineStrongLight,
    outlineVariant = SignInLineLight,
    inverseSurface = SignInInk900Light,
    inverseOnSurface = SignInSurfaceLight,
    // Matches StatusRejected - every "this went wrong" red in the app
    // (form validation here, request status elsewhere) is the same hue.
    error = StatusRejected
)

@Composable
fun LeaveApprovalsTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = LightColors, content = content)
}

// The bottom nav's active tab shares the same peach/orange treatment as the
// "Q1-Q4"-style badges in the reference (primaryContainer fill, primary
// icon/text) - Material3's own NavigationBarItem default already does
// almost exactly this (indicatorColor = secondaryContainer, selected icon =
// onSecondaryContainer), so this just points it at the primary pairing
// instead for an exact match against the mockups.
@Composable
fun themedNavigationBarItemColors() = NavigationBarItemDefaults.colors(
    indicatorColor = MaterialTheme.colorScheme.primaryContainer,
    selectedIconColor = MaterialTheme.colorScheme.primary,
    selectedTextColor = MaterialTheme.colorScheme.primary
)
