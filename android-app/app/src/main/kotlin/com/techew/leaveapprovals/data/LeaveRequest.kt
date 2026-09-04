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
    // Optional note the approver can attach when approving/rejecting.
    val decisionNote: String = "",
    // Set only when status == "withdrawn" - start of the 7-day grace window
    // before the request is eligible for permanent deletion (see
    // isArchived()/daysUntilPermanentDeletion() in ArchiveRules.kt).
    val withdrawnAt: String = ""
)
