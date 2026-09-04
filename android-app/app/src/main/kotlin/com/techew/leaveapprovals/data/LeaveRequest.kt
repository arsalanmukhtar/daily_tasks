package com.techew.leaveapprovals.data

data class Attachment(
    val name: String = "",
    val url: String = "",
    val fileId: String = ""
)

data class LeaveRequest(
    val requestId: String,
    val requestedAt: String = "",
    val startDate: String = "",
    val endDate: String = "",
    // Only set for a Custom (non-contiguous) date pick with more than one
    // day - startDate/endDate above still cover the full first-to-last span
    // for backward-compat with archive/overlap logic, but this is the exact
    // set of days actually picked and is what display code should prefer
    // (see leaveDateLabel()/durationFact() in RequestDetailSheet.kt).
    val customDates: List<String> = emptyList(),
    val email: String = "",
    val name: String = "",
    val weekLabel: String = "",
    val type: String = "casualShort",
    val reasonHtml: String = "",
    val status: String = "requested",
    val resolvedAt: String = "",
    val resolvedBy: String = "",
    val attachments: List<Attachment> = emptyList(),
    // 'AM' | 'PM', only ever set by the web app at creation, only meaningful
    // when type normalizes to casualShort.
    val halfDayPeriod: String = "",
    // e.g. "7:00 AM" - the exact time the web app's Short Leave time picker
    // was set to, alongside halfDayPeriod (which stays AM/PM-only).
    val shortLeaveTime: String = "",
    // e.g. "9:00 AM" / "12:30 PM" - only meaningful when type normalizes to
    // casualOutPass.
    val checkOutTime: String = "",
    val checkInTime: String = "",
    // Optional note the approver can attach when approving/rejecting.
    val decisionNote: String = "",
    // Set only when status == "withdrawn" - start of the 7-day grace window
    // before the request is eligible for permanent deletion (see
    // isArchived()/daysUntilPermanentDeletion() in ArchiveRules.kt).
    val withdrawnAt: String = ""
)
