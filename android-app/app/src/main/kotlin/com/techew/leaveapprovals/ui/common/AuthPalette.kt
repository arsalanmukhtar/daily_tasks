package com.techew.leaveapprovals.ui.common

import androidx.compose.ui.graphics.Color
import com.techew.leaveapprovals.ui.theme.SignInBgDark
import com.techew.leaveapprovals.ui.theme.SignInBrandOnDark
import com.techew.leaveapprovals.ui.theme.SignInBrandTintDark
import com.techew.leaveapprovals.ui.theme.SignInBrandTintStrongDark
import com.techew.leaveapprovals.ui.theme.SignInInk400Dark
import com.techew.leaveapprovals.ui.theme.SignInInk500Dark
import com.techew.leaveapprovals.ui.theme.SignInInk700Dark
import com.techew.leaveapprovals.ui.theme.SignInInk900Dark
import com.techew.leaveapprovals.ui.theme.SignInLineDark
import com.techew.leaveapprovals.ui.theme.SignInLineStrongDark
import com.techew.leaveapprovals.ui.theme.SignInSecureDark
import com.techew.leaveapprovals.ui.theme.SignInSecureTintDark
import com.techew.leaveapprovals.ui.theme.SignInSurface2Dark
import com.techew.leaveapprovals.ui.theme.SignInSurfaceDark

/**
 * The shared warm-neutral identity for the pre-sign-in "gate" screens
 * (Sign In, Restricted) - distinct from the rest of the app's plain
 * Material scheme. Matches screens/mobile/sign-in.html and
 * screens/mobile/Restricted.png, the design references both screens were
 * built from. `internal` (not per-screen `private`) so both screens share
 * one definition instead of drifting apart.
 *
 * Dark-only, matching the rest of the app's now permanently-dark theme
 * (see LeaveApprovalsTheme) - there's no light variant to switch to.
 */
internal data class AuthPalette(
    val bg: Color,
    val surface: Color,
    val surface2: Color,
    val ink900: Color,
    val ink700: Color,
    val ink500: Color,
    val ink400: Color,
    val line: Color,
    val lineStrong: Color,
    val brand: Color,
    val brandTint: Color,
    val brandTintStrong: Color,
    val secure: Color,
    val secureTint: Color
)

internal val DarkAuthPalette = AuthPalette(
    bg = SignInBgDark, surface = SignInSurfaceDark, surface2 = SignInSurface2Dark,
    ink900 = SignInInk900Dark, ink700 = SignInInk700Dark, ink500 = SignInInk500Dark, ink400 = SignInInk400Dark,
    line = SignInLineDark, lineStrong = SignInLineStrongDark, brand = SignInBrandOnDark,
    brandTint = SignInBrandTintDark, brandTintStrong = SignInBrandTintStrongDark,
    secure = SignInSecureDark, secureTint = SignInSecureTintDark
)

internal fun authPalette(): AuthPalette = DarkAuthPalette
