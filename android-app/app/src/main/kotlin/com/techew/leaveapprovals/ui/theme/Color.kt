package com.techew.leaveapprovals.ui.theme

import androidx.compose.ui.graphics.Color

val TechEwOrange = Color(0xFFEA580C)
val TechEwOrangeDark = Color(0xFFC2410C)
val StatusRequested = Color(0xFF92400E)
val StatusRequestedBg = Color(0xFFFEF3C7)
// Success/positive - oklch(69.6% 0.17 162.48), a bright emerald, plus a
// light pastel tint of the same hue for its badge background.
val StatusApproved = Color(0xFF00BC7D)
val StatusApprovedBg = Color(0xFFD7F3E4)
// Warning/alert - oklch(64.5% 0.246 16.439), a lighter red than the old
// dark maroon, plus a light pastel tint of the same hue for its badge
// background.
val StatusRejected = Color(0xFFFF2056)
val StatusRejectedBg = Color(0xFFFFE2E3)

// A withdrawn request is only ever created by the web app (the requester
// cancelling their own still-pending request) - Android never writes this
// status, only displays it if one shows up in a list. Neutral/grey rather
// than red or green since it isn't a manager decision either way.
val StatusWithdrawn = Color(0xFF49454F)
val StatusWithdrawnBg = Color(0xFFE7E0EB)

// Leave-type family colors, matching screens/mobile-redesign.html's
// --t-foreign/--t-umrah/--t-medical/--t-casual tokens. CASUAL_SHORT and
// CASUAL_FULL both render as "Casual" for this chip - the short/full split
// is what the separate Duration* colors below are for.
val TypeForeignTrip = Color(0xFF3B5BDB)
val TypeForeignTripBg = Color(0xFFE8EDFC)
val TypeUmrah = Color(0xFF0E8A7D)
val TypeUmrahBg = Color(0xFFDFF2EF)
val TypeMedical = Color(0xFF0B7FA8)
val TypeMedicalBg = Color(0xFFDFF0F8)
val TypeCasual = Color(0xFF6C4CC4)
val TypeCasualBg = Color(0xFFEDE7FA)

// Duration colors, matching the mockup's --d-short/--d-full tokens. Every
// leave type has an inherent duration (only casualShort is ever "short" -
// casualFull/foreignTrip/umrah/medical are all "full"), so every card can
// carry both a type chip and a duration chip.
val DurationShort = Color(0xFF0369A1)
val DurationShortBg = Color(0xFFE3EFF8)
val DurationFull = Color(0xFF3730A3)
val DurationFullBg = Color(0xFFE9E8F8)
val DurationOutPass = Color(0xFF0F766E)
val DurationOutPassBg = Color(0xFFE3F4F2)

// Neutral "meta" color for informational chips that aren't tied to a type or
// status - week label, submitted timestamp - matching the mockup's --meta.
val Meta = Color(0xFF54607A)
val MetaBg = Color(0xFFECEEF4)

// ---------- App neutral palette ----------
// The "Sign in" prefix is legacy (this started as a sign-in-screen-only
// identity, matching screens/mobile/sign-in.html) but these Dark values are
// now the whole app's main neutral colors (background/surface/text/borders)
// - see Theme.kt's colorScheme and AuthPalette.kt. Dark values are Tailwind
// Slate (50/100/200/300/400/500/600/700/800/900/950); the Light values below
// are unused dead code (the app is dark-only) and were never migrated off
// the original warm palette.
val SignInBgLight = Color(0xFFF5F0E7)
val SignInBgDotLight = Color(0xFFE2DACB)
val SignInSurfaceLight = Color(0xFFFFFFFF)
val SignInSurface2Light = Color(0xFFFAF6EF)
val SignInInk900Light = Color(0xFF1C1712)
val SignInInk700Light = Color(0xFF4C4437)
val SignInInk500Light = Color(0xFF8C8072)
val SignInInk400Light = Color(0xFFABA090)
val SignInLineLight = Color(0xFFE9E1D2)
val SignInLineStrongLight = Color(0xFFDCD2BC)
val SignInBrandTintLight = Color(0xFFFFF0E2)
val SignInBrandTintStrongLight = Color(0xFFFBD3AC)
val SignInSecureLight = Color(0xFF157F45)
val SignInSecureTintLight = Color(0xFFE4F5EA)

// Tailwind Slate - slate-950/900/800/700 (surfaces) and slate-50/300/400/500
// (text), replacing the original warm-brown dark palette.
val SignInBgDark = Color(0xFF020617) // slate-950
val SignInBgDotDark = Color(0xFF0F172A) // slate-900 (unused - dot grid removed)
val SignInSurfaceDark = Color(0xFF0F172A) // slate-900
val SignInSurface2Dark = Color(0xFF1E293B) // slate-800
val SignInSurface3Dark = Color(0xFF334155) // slate-700
val SignInInk900Dark = Color(0xFFF8FAFC) // slate-50
val SignInInk700Dark = Color(0xFFCBD5E1) // slate-300
val SignInInk500Dark = Color(0xFF94A3B8) // slate-400
val SignInInk400Dark = Color(0xFF64748B) // slate-500
val SignInLineDark = Color(0xFF1E293B) // slate-800
val SignInLineStrongDark = Color(0xFF334155) // slate-700
// Brighter than TechEwOrange for legibility against the dark slate ground.
val SignInBrandOnDark = Color(0xFFFB8A3C)
val SignInBrandTintDark = Color(0xFF3C2716)
val SignInBrandTintStrongDark = Color(0xFF55341A)
// Reuses the app-wide success green (see StatusApproved/StatusApprovedBg)
// rather than a separate dark-tinted green, so every "positive" badge in
// the app - this SECURE tag included - shares one visual language.
val SignInSecureDark = StatusApproved
val SignInSecureTintDark = StatusApprovedBg
