package com.techew.leaveapprovals.data

/**
 * A manager-filed report that a developer was absent without ever applying
 * for leave (see firestore.rules' uninformedLeaves block). Resolving one -
 * by the developer explaining themselves, or the owner overriding directly -
 * is the only client write; push-daemon's Admin SDK then creates the actual
 * approved leaveRequests doc and stamps linkedRequestId back here.
 */
data class UninformedLeave(
    val reportId: String,
    val email: String = "",
    val name: String = "",
    val date: String = "",
    val reasonHtml: String = "",
    val reportedBy: String = "",
    val reportedAt: String = "",
    val status: String = "reported", // "reported" | "resolved"
    val resolvedAt: String = "",
    val resolvedBy: String = "",
    val resolutionHtml: String = "",
    val linkedRequestId: String = ""
)
