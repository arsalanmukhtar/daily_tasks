package com.techew.leaveapprovals.data

data class LeaveRequest(
    val requestId: String,
    val requestedAt: String = "",
    val email: String = "",
    val name: String = "",
    val weekLabel: String = "",
    val type: String = "short",
    val reasonHtml: String = "",
    val status: String = "requested",
    val resolvedAt: String = "",
    val resolvedBy: String = "",
    val attachmentName: String = "",
    val attachmentUrl: String = ""
)
