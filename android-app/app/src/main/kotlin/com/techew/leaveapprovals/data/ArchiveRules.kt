package com.techew.leaveapprovals.data

import java.time.DayOfWeek
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.WeekFields

// A withdrawn request is kept for a 7-day grace window (see the matching
// firestore.rules delete branch) so it stays visible in Archived with a
// countdown before it's actually removed.
private const val WITHDRAWN_RETENTION_DAYS = 7L

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
// moving to "Archived" starting the next day - independent of status (other
// than withdrawn/uninformedAbsence, see below), so an undecided-but-stale
// request still ages out (and stays fully actionable there; RequestDetailSheet
// only hides Approve/Reject once status != "requested").
//
// A withdrawn request skips that date check entirely and archives right
// away, regardless of whether its leave dates are in the past or still
// upcoming - withdrawing takes it out of play immediately either way.
//
// A resolved uninformed-absence leave skips it too, but the other direction:
// its startDate/endDate are the real (often already-past) absence day, which
// would otherwise always archive it instantly - the product rule here is
// deliberately about *when it was resolved*, not when the absence was, so
// resolving before local noon surfaces it in Requests for the rest of that
// half-day before the normal date rule would ever have caught up to it.
fun LeaveRequest.isArchived(today: LocalDate = LocalDate.now()): Boolean {
    if (type == LeaveType.UNINFORMED_ABSENCE) {
        val resolvedInstant = runCatching { Instant.parse(resolvedAt) }.getOrNull() ?: return false
        return !resolvedInstant.atZone(ZoneId.systemDefault()).toLocalTime().isBefore(LocalTime.NOON)
    }
    if (status == "withdrawn") return true
    val end = effectiveEndDate() ?: return false
    return end.isBefore(today)
}

// Days left before a withdrawn request is permanently deleted, counting down
// from 7 to 0 - null if this isn't a withdrawn request or it predates the
// withdrawnAt field.
fun LeaveRequest.daysUntilPermanentDeletion(now: Instant = Instant.now()): Long? {
    if (status != "withdrawn" || withdrawnAt.isBlank()) return null
    val withdrawnInstant = runCatching { Instant.parse(withdrawnAt) }.getOrNull() ?: return null
    val elapsedDays = Duration.between(withdrawnInstant, now).toDays()
    return (WITHDRAWN_RETENTION_DAYS - elapsedDays).coerceAtLeast(0)
}

// True once a withdrawn request has sat past its 7-day grace window - the
// signal RequestListViewModel uses to trigger LeaveApiClient.deleteExpiredRequest().
fun LeaveRequest.isPastWithdrawnRetention(now: Instant = Instant.now()): Boolean {
    if (status != "withdrawn" || withdrawnAt.isBlank()) return false
    val withdrawnInstant = runCatching { Instant.parse(withdrawnAt) }.getOrNull() ?: return false
    return Duration.between(withdrawnInstant, now).toDays() >= WITHDRAWN_RETENTION_DAYS
}
