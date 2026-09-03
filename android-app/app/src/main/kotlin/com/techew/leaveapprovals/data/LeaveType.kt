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

    val ALL = listOf(FOREIGN_TRIP, UMRAH, MEDICAL, CASUAL_SHORT, CASUAL_FULL)

    private val ALIASES = mapOf("short" to CASUAL_SHORT, "full" to CASUAL_FULL)
    private val LABELS = mapOf(
        FOREIGN_TRIP to "Foreign Trip",
        UMRAH to "Umrah",
        MEDICAL to "Medical",
        CASUAL_SHORT to "Short Leave",
        CASUAL_FULL to "Full Leave"
    )

    fun normalize(type: String): String = ALIASES[type] ?: type.ifBlank { CASUAL_SHORT }

    fun label(type: String): String = LABELS[normalize(type)] ?: "Leave"
}
