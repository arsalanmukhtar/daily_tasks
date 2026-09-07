package com.techew.leaveapprovals.ui.common

import androidx.compose.ui.graphics.Color
import com.techew.leaveapprovals.ui.theme.SignInBgLight
import com.techew.leaveapprovals.ui.theme.SignInBrandTintLight
import com.techew.leaveapprovals.ui.theme.SignInBrandTintStrongLight
import com.techew.leaveapprovals.ui.theme.SignInInk400Light
import com.techew.leaveapprovals.ui.theme.SignInInk500Light
import com.techew.leaveapprovals.ui.theme.SignInInk700Light
import com.techew.leaveapprovals.ui.theme.SignInInk900Light
import com.techew.leaveapprovals.ui.theme.SignInLineLight
import com.techew.leaveapprovals.ui.theme.SignInLineStrongLight
import com.techew.leaveapprovals.ui.theme.SignInSecureLight
import com.techew.leaveapprovals.ui.theme.SignInSecureTintLight
import com.techew.leaveapprovals.ui.theme.SignInSurface2Light
import com.techew.leaveapprovals.ui.theme.SignInSurfaceLight
import com.techew.leaveapprovals.ui.theme.TechEwOrange

/**
 * The shared neutral identity for the pre-sign-in "gate" screens (Sign In,
 * Restricted) - distinct from the rest of the app's plain Material scheme.
 * Matches screens/mobile/SignIn.png and screens/mobile/Restricted.png, the
 * design references both screens were built from. `internal` (not
 * per-screen `private`) so both screens share one definition instead of
 * drifting apart.
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

internal val LightAuthPalette = AuthPalette(
    bg = SignInBgLight, surface = SignInSurfaceLight, surface2 = SignInSurface2Light,
    ink900 = SignInInk900Light, ink700 = SignInInk700Light, ink500 = SignInInk500Light, ink400 = SignInInk400Light,
    line = SignInLineLight, lineStrong = SignInLineStrongLight, brand = TechEwOrange,
    brandTint = SignInBrandTintLight, brandTintStrong = SignInBrandTintStrongLight,
    secure = SignInSecureLight, secureTint = SignInSecureTintLight
)

internal fun authPalette(): AuthPalette = LightAuthPalette
