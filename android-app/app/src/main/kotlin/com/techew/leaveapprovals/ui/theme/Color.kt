package com.techew.leaveapprovals.ui.theme

import androidx.compose.ui.graphics.Color

val TechEwOrange = Color(0xFFEA580C)
val TechEwOrangeDark = Color(0xFFC2410C)
val StatusRequested = Color(0xFF92400E)
val StatusRequestedBg = Color(0xFFFEF3C7)
val StatusApproved = Color(0xFF166534)
val StatusApprovedBg = Color(0xFFDCFCE7)
val StatusRejected = Color(0xFF991B1B)
val StatusRejectedBg = Color(0xFFFEE2E2)

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
