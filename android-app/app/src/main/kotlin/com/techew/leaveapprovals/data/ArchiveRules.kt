package com.techew.leaveapprovals.data

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.WeekFields

private val WEEK_LABEL_REGEX = Regex("""Week\s+(\d+),\s*(\d+)""")

/**
 * The last calendar day this request covers, used to decide when it should
 * age out of "Requests" into "Archived". New requests always have an
 * explicit endDate; old ones (pre-dating the calendar picker) fall back to
 * the Friday of their weekLabel's ISO week - matching the old implicit
 * whole-week semantics, so historical data archives sensibly with no
 * backfill needed.
 */
fun LeaveRequest.effectiveEndDate(): LocalDate? {
    if (endDate.isNotBlank()) {
        return runCatching { Instant.parse(endDate).atZone(ZoneId.systemDefault()).toLocalDate() }.getOrNull()
    }
    val match = WEEK_LABEL_REGEX.find(weekLabel) ?: return null
    val week = match.groupValues[1].toIntOrNull() ?: return null
    val year = match.groupValues[2].toIntOrNull() ?: return null
    return runCatching {
        LocalDate.now()
            .with(WeekFields.ISO.weekBasedYear(), year.toLong())
            .with(WeekFields.ISO.weekOfWeekBasedYear(), week.toLong())
            .with(DayOfWeek.FRIDAY)
    }.getOrNull()
}

// A request stays in "Requests" through the full day of its last leave date,
// moving to "Archived" starting the next day - independent of status, so an
// undecided-but-stale request still ages out (and stays fully actionable
// there; RequestDetailSheet only hides Approve/Reject once status != "requested").
fun LeaveRequest.isArchived(today: LocalDate = LocalDate.now()): Boolean {
    val end = effectiveEndDate() ?: return false
    return end.isBefore(today)
}
