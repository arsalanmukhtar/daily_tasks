package com.techew.leaveapprovals.data

/**
 * A manager-filed report that a developer was absent without ever applying
 * for leave (see firestore.rules' uninformedLeaves block). The developer
 * explains themselves (reported -> explained); the owner then accepts
 * (explained -> resolved, which push-daemon converts into an approved
 * leaveRequests doc) or rejects (explained -> reported, bouncing it back
 * with a note for the developer to try again) - or can resolve a fresh
 * report directly, skipping the developer entirely.
 */
data class UninformedLeave(
    val reportId: String,
    val email: String = "",
    val name: String = "",
    val date: String = "",
    val reasonHtml: String = "",
    val reportedBy: String = "",
    val reportedAt: String = "",
    val status: String = "reported", // "reported" | "explained" | "resolved"
    val explanationHtml: String = "",
    val explainedAt: String = "",
    val rejectionNote: String = "",
    val rejectionNoteAt: String = "",
    val resolvedAt: String = "",
    val resolvedBy: String = "",
    val resolutionHtml: String = "",
    val linkedRequestId: String = ""
)
