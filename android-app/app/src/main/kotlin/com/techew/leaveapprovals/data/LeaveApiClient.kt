package com.techew.leaveapprovals.data

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

class ApiException(message: String) : Exception(message)

/**
 * Talks to Firestore directly (client SDK, no backend) - authorization comes
 * from firestore.rules, not from a request parameter. Only the signed-in
 * owner ever constructs/uses this (see AppRoot's AuthState.SignedInOwner
 * branch), matching the rules' `isOwner()` gate on reading every request.
 */
class LeaveApiClient(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
) {

    suspend fun listLeaveRequests(limit: Int = 50): List<LeaveRequest> {
        val snapshot = db.collection("leaveRequests")
            .orderBy("requestedAt", Query.Direction.DESCENDING)
            .limit(limit.toLong())
            .get()
            .await()
        return snapshot.documents.map { it.toLeaveRequest() }
    }

    suspend fun registerPushToken(token: String) {
        val email = auth.currentUser?.email?.lowercase() ?: throw ApiException("Not signed in.")
        db.collection("pushTokens").document(token).set(
            mapOf(
                "email" to email,
                "platform" to "android",
                "registeredAt" to FieldValue.serverTimestamp()
            )
        ).await()
    }

    // Apps Script's single-threaded execution used to make the "already
    // resolved" guard safe for free; Firestore doesn't, so this reads the
    // current status and writes the decision inside one transaction.
    suspend fun decideLeave(requestId: String, decision: String) {
        val status = if (decision == "approved") "approved" else "rejected"
        val resolvedBy = auth.currentUser?.displayName ?: auth.currentUser?.email ?: "Unknown"
        val ref = db.collection("leaveRequests").document(requestId)
        try {
            db.runTransaction { transaction ->
                val snapshot = transaction.get(ref)
                if (snapshot.getString("status") != "requested") {
                    throw ApiException("This request has already been resolved.")
                }
                transaction.update(
                    ref,
                    mapOf(
                        "status" to status,
                        "resolvedAt" to FieldValue.serverTimestamp(),
                        "resolvedBy" to resolvedBy
                    )
                )
            }.await()
        } catch (err: ApiException) {
            throw err
        } catch (err: Exception) {
            throw ApiException(err.message ?: "Could not save decision.")
        }
    }
}

private fun DocumentSnapshot.toLeaveRequest(): LeaveRequest = LeaveRequest(
    requestId = id,
    requestedAt = getTimestamp("requestedAt").toIsoStringOrEmpty(),
    email = getString("email") ?: "",
    name = getString("name") ?: "",
    weekLabel = getString("weekLabel") ?: "",
    type = getString("type") ?: "short",
    reasonHtml = getString("reasonHtml") ?: "",
    status = getString("status") ?: "requested",
    resolvedAt = getTimestamp("resolvedAt").toIsoStringOrEmpty(),
    resolvedBy = getString("resolvedBy") ?: "",
    attachmentName = getString("attachmentName") ?: "",
    attachmentUrl = getString("attachmentUrl") ?: ""
)

private fun Timestamp?.toIsoStringOrEmpty(): String = this?.toDate()?.toInstant()?.toString() ?: ""
