package com.techew.leaveapprovals.data

/**
 * Six real leave types. 'casualShort'/'casualFull'/'casualOutPass' are
 * surfaced as the three sub-choices of "Casual" in the web app's
 * apply-for-leave form; the other three stand alone. Legacy docs from
 * before this taxonomy existed store 'short'/'full' directly in the same
 * `type` field - normalize() aliases those forward so every consumer only
 * ever sees the canonical keys below, with zero data migration.
 */
object LeaveType {
    const val FOREIGN_TRIP = "foreignTrip"
    const val UMRAH = "umrah"
    const val MEDICAL = "medical"
    const val CASUAL_SHORT = "casualShort"
    const val CASUAL_FULL = "casualFull"
    const val CASUAL_OUT_PASS = "casualOutPass"
    // Written only by push-daemon (Admin SDK) once a manager's uninformed-
    // absence report is resolved - never created directly by a client.
    const val UNINFORMED_ABSENCE = "uninformedAbsence"

    val ALL = listOf(FOREIGN_TRIP, UMRAH, MEDICAL, CASUAL_SHORT, CASUAL_FULL, CASUAL_OUT_PASS, UNINFORMED_ABSENCE)

    private val ALIASES = mapOf("short" to CASUAL_SHORT, "full" to CASUAL_FULL)
    private val LABELS = mapOf(
        FOREIGN_TRIP to "Foreign Trip",
        UMRAH to "Umrah",
        MEDICAL to "Medical",
        CASUAL_SHORT to "Short Leave",
        CASUAL_FULL to "Full Leave",
        CASUAL_OUT_PASS to "Out Pass",
        UNINFORMED_ABSENCE to "Uninformed Leave"
    )

    // Short forms for tight spaces (the Summary screen's "By leave type" bar
    // labels) - the full LABELS above stay unabbreviated everywhere else.
    private val SHORT_LABELS = mapOf(
        FOREIGN_TRIP to "Foreign",
        UMRAH to "Umrah",
        MEDICAL to "Medical",
        CASUAL_SHORT to "Short",
        CASUAL_FULL to "Full",
        CASUAL_OUT_PASS to "Out Pass",
        UNINFORMED_ABSENCE to "Uninformed"
    )

    fun normalize(type: String): String = ALIASES[type] ?: type.ifBlank { CASUAL_SHORT }

    fun label(type: String): String = LABELS[normalize(type)] ?: "Leave"

    fun shortLabel(type: String): String = SHORT_LABELS[normalize(type)] ?: "Leave"

    // Collapses the three casual sub-types into one "Casual" family label,
    // for UI that shows the leave-type chip and the duration chip
    // separately (mirrors screens/mobile-redesign.html's card chips).
    fun familyLabel(type: String): String =
        if (isCasual(type)) "Casual" else label(type)

    private fun isCasual(type: String): Boolean =
        normalize(type) == CASUAL_SHORT || normalize(type) == CASUAL_FULL || normalize(type) == CASUAL_OUT_PASS

    fun isShort(type: String): Boolean = normalize(type) == CASUAL_SHORT

    fun isOutPass(type: String): Boolean = normalize(type) == CASUAL_OUT_PASS

    // Only Full Leave (and every non-casual, inherently whole-day type) is
    // ever a multi-day span - Short Leave and Out Pass are always a single
    // day (a part of it), so they never carry a real day range.
    fun isSingleDay(type: String): Boolean = isShort(type) || isOutPass(type)

    fun durationLabel(type: String): String = when {
        isShort(type) -> "Short Leave"
        isOutPass(type) -> "Out Pass"
        else -> "Full Leave"
    }
}
