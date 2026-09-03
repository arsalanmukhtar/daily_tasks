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
    val attachments: List<Attachment> = emptyList()
)
