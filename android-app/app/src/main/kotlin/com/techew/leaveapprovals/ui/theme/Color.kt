package com.techew.leaveapprovals.ui.theme

import androidx.compose.ui.graphics.Color

val TechEwOrange = Color(0xFFEA580C)
val TechEwOrangeDark = Color(0xFFC2410C)
val StatusRequested = Color(0xFF92400E)
val StatusRequestedBg = Color(0xFFFEF3C7)
// Success/positive. The original oklch(69.6% 0.17 162.48) bright emerald on
// its own pastel tint measured a ~2.1:1 contrast ratio - well under WCAG
// AA's 4.5:1 for normal text - so a "good" green on light gray-green paper
// still read as illegible. This pairing (Tailwind's green-800 on green-100)
// hits ~6.5:1 while staying clearly green, not just dark.
val StatusApproved = Color(0xFF166534)
val StatusApprovedBg = Color(0xFFDCFCE7)
// Warning/alert. The original oklch(64.5% 0.246 16.439) read as pink/
// raspberry rather than red (its blue channel sits almost as high as
// green) and only hit ~3.1:1 contrast on its own badge background - under
// WCAG AA's 4.5:1. Tailwind's red-700 is a true red with no pink cast, at
// ~5.3:1 on the same background.
val StatusRejected = Color(0xFFB91C1C)
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
// identity, matching screens/mobile/sign-in.html) but these values are now
// the whole app's main neutral colors (background/surface/text/borders) -
// see Theme.kt's colorScheme and AuthPalette.kt. True neutral gray (zero
// chroma/no hue), sampled directly from the screens/mobile/*.png
// references (Summary.png's page background, card fill, hairline card
// border, heading text, and muted caption text) rather than guessed -
// white cards on a barely-off-white page, near-black text, with a thin
// outline doing the work of separating elements instead of shadows or
// background-color contrast.
val SignInBgLight = Color(0xFFF6F6F4)
val SignInSurfaceLight = Color(0xFFFFFFFF)
val SignInSurface2Light = Color(0xFFECEBE8) // filled chip/tile background
val SignInSurface3Light = Color(0xFFE0DEDA)
val SignInInk900Light = Color(0xFF131316) // headings, primary text
val SignInInk700Light = Color(0xFF75757A) // muted captions/secondary text
val SignInInk500Light = Color(0xFF9C9C9F)
val SignInInk400Light = Color(0xFFC2C2C4)
val SignInLineLight = Color(0xFFE6E4DF) // hairline card border
val SignInLineStrongLight = Color(0xFFD1CFC9)
// TechEwOrange itself is the sampled accent (#E4571D in the mockups, a hair
// off #EA580C) - reused directly rather than duplicated under a new name.
val SignInBrandTintLight = Color(0xFFFFE9DA) // primaryContainer, e.g. the "Q1-Q4" badge
val SignInBrandTintStrongLight = Color(0xFFFFD2AD)
// Reuses the app-wide success green (see StatusApproved/StatusApprovedBg)
// rather than a separate tinted green, so every "positive" badge in the
// app - this SECURE tag included - shares one visual language.
val SignInSecureLight = StatusApproved
val SignInSecureTintLight = StatusApprovedBg
