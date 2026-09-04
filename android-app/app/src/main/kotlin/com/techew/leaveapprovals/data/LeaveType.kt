package com.techew.leaveapprovals.data

/**
 * Five real leave types. 'casualShort'/'casualFull' are surfaced as the two
 * sub-choices of "Casual" in the web app's apply-for-leave form; the other
 * three stand alone. Legacy docs from before this taxonomy existed store
 * 'short'/'full' directly in the same `type` field - normalize() aliases
 * those forward so every consumer only ever sees the five canonical keys
 * below, with zero data migration.
 */
object LeaveType {
    const val FOREIGN_TRIP = "foreignTrip"
    const val UMRAH = "umrah"
    const val MEDICAL = "medical"
    const val CASUAL_SHORT = "casualShort"
    const val CASUAL_FULL = "casualFull"
    // Written only by push-daemon (Admin SDK) once a manager's uninformed-
    // absence report is resolved - never created directly by a client.
    const val UNINFORMED_ABSENCE = "uninformedAbsence"

    val ALL = listOf(FOREIGN_TRIP, UMRAH, MEDICAL, CASUAL_SHORT, CASUAL_FULL, UNINFORMED_ABSENCE)

    private val ALIASES = mapOf("short" to CASUAL_SHORT, "full" to CASUAL_FULL)
    private val LABELS = mapOf(
        FOREIGN_TRIP to "Foreign Trip",
        UMRAH to "Umrah",
        MEDICAL to "Medical",
        CASUAL_SHORT to "Short Leave",
        CASUAL_FULL to "Full Leave",
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
        UNINFORMED_ABSENCE to "Uninformed"
    )

    fun normalize(type: String): String = ALIASES[type] ?: type.ifBlank { CASUAL_SHORT }

    fun label(type: String): String = LABELS[normalize(type)] ?: "Leave"

    fun shortLabel(type: String): String = SHORT_LABELS[normalize(type)] ?: "Leave"

    // Collapses casualShort/casualFull into one "Casual" family label, for
    // UI that shows the leave-type chip and the short/full duration chip
    // separately (mirrors screens/mobile-redesign.html's card chips).
    fun familyLabel(type: String): String =
        if (normalize(type) == CASUAL_SHORT || normalize(type) == CASUAL_FULL) "Casual" else label(type)

    fun isShort(type: String): Boolean = normalize(type) == CASUAL_SHORT

    fun durationLabel(type: String): String = if (isShort(type)) "Short Leave" else "Full Leave"
}
