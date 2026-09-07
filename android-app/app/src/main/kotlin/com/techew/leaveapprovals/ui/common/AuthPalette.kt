package com.techew.leaveapprovals.ui.common

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.techew.leaveapprovals.ui.theme.SignInBgDark
import com.techew.leaveapprovals.ui.theme.SignInBgDotDark
import com.techew.leaveapprovals.ui.theme.SignInBgDotLight
import com.techew.leaveapprovals.ui.theme.SignInBgLight
import com.techew.leaveapprovals.ui.theme.SignInBrandOnDark
import com.techew.leaveapprovals.ui.theme.SignInBrandTintDark
import com.techew.leaveapprovals.ui.theme.SignInBrandTintLight
import com.techew.leaveapprovals.ui.theme.SignInBrandTintStrongDark
import com.techew.leaveapprovals.ui.theme.SignInBrandTintStrongLight
import com.techew.leaveapprovals.ui.theme.SignInInk400Dark
import com.techew.leaveapprovals.ui.theme.SignInInk400Light
import com.techew.leaveapprovals.ui.theme.SignInInk500Dark
import com.techew.leaveapprovals.ui.theme.SignInInk500Light
import com.techew.leaveapprovals.ui.theme.SignInInk700Dark
import com.techew.leaveapprovals.ui.theme.SignInInk700Light
import com.techew.leaveapprovals.ui.theme.SignInInk900Dark
import com.techew.leaveapprovals.ui.theme.SignInInk900Light
import com.techew.leaveapprovals.ui.theme.SignInLineDark
import com.techew.leaveapprovals.ui.theme.SignInLineLight
import com.techew.leaveapprovals.ui.theme.SignInLineStrongDark
import com.techew.leaveapprovals.ui.theme.SignInLineStrongLight
import com.techew.leaveapprovals.ui.theme.SignInSecureDark
import com.techew.leaveapprovals.ui.theme.SignInSecureLight
import com.techew.leaveapprovals.ui.theme.SignInSecureTintDark
import com.techew.leaveapprovals.ui.theme.SignInSecureTintLight
import com.techew.leaveapprovals.ui.theme.SignInSurface2Dark
import com.techew.leaveapprovals.ui.theme.SignInSurface2Light
import com.techew.leaveapprovals.ui.theme.SignInSurfaceDark
import com.techew.leaveapprovals.ui.theme.SignInSurfaceLight
import com.techew.leaveapprovals.ui.theme.TechEwOrange

/**
 * The shared warm-neutral identity for the pre-sign-in "gate" screens
 * (Sign In, Restricted) - distinct from the rest of the app's plain
 * Material scheme. Matches screens/mobile/sign-in.html and
 * screens/mobile/Restricted.png, the design references both screens were
 * built from. `internal` (not per-screen `private`) so both screens share
 * one definition instead of drifting apart.
 */
internal data class AuthPalette(
    val bg: Color,
    val bgDot: Color,
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
    bg = SignInBgLight, bgDot = SignInBgDotLight, surface = SignInSurfaceLight, surface2 = SignInSurface2Light,
    ink900 = SignInInk900Light, ink700 = SignInInk700Light, ink500 = SignInInk500Light, ink400 = SignInInk400Light,
    line = SignInLineLight, lineStrong = SignInLineStrongLight, brand = TechEwOrange,
    brandTint = SignInBrandTintLight, brandTintStrong = SignInBrandTintStrongLight,
    secure = SignInSecureLight, secureTint = SignInSecureTintLight
)

internal val DarkAuthPalette = AuthPalette(
    bg = SignInBgDark, bgDot = SignInBgDotDark, surface = SignInSurfaceDark, surface2 = SignInSurface2Dark,
    ink900 = SignInInk900Dark, ink700 = SignInInk700Dark, ink500 = SignInInk500Dark, ink400 = SignInInk400Dark,
    line = SignInLineDark, lineStrong = SignInLineStrongDark, brand = SignInBrandOnDark,
    brandTint = SignInBrandTintDark, brandTintStrong = SignInBrandTintStrongDark,
    secure = SignInSecureDark, secureTint = SignInSecureTintDark
)

@Composable
internal fun authPalette(): AuthPalette = if (isSystemInDarkTheme()) DarkAuthPalette else LightAuthPalette

/** Faint repeating dot grid, matching the reference designs' textured background. */
internal fun Modifier.dotGrid(color: Color, spacing: Dp = 20.dp, radius: Dp = 1.1.dp): Modifier =
    this.drawBehind {
        val spacingPx = spacing.toPx()
        val radiusPx = radius.toPx()
        var y = spacingPx / 2
        while (y < size.height) {
            var x = spacingPx / 2
            while (x < size.width) {
                drawCircle(color = color, radius = radiusPx, center = Offset(x, y))
                x += spacingPx
            }
            y += spacingPx
        }
    }
