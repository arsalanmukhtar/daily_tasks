package com.techew.leaveapprovals.data

import kotlinx.serialization.Serializable

@Serializable
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

@Serializable
data class ListResponse(
    val status: String,
    val records: List<LeaveRequest> = emptyList(),
    val message: String? = null
)

@Serializable
data class OkResponse(
    val status: String,
    val message: String? = null
)
