package com.techew.leaveapprovals.data

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
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

    // A live listener, not a one-shot fetch - the caller gets pushed a fresh
    // list the instant a request is created or decided anywhere, with no
    // manual refresh needed. Caller owns the returned registration and must
    // call .remove() on it when done (these ViewModels aren't backed by a
    // real ViewModelStore, so onCleared() never fires for them - see
    // RequestListViewModel/LeaveSummaryViewModel's stopListening()).
    fun listenLeaveRequests(limit: Int = 300, onResult: (Result<List<LeaveRequest>>) -> Unit): ListenerRegistration {
        return db.collection("leaveRequests")
            .orderBy("requestedAt", Query.Direction.DESCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    onResult(Result.failure(error))
                } else if (snapshot != null) {
                    onResult(Result.success(snapshot.documents.map { it.toLeaveRequest() }))
                }
            }
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
    //
    // `note` is the optional decision note typed in RequestDetailSheet's
    // inline approve/reject step - written as `decisionNote` alongside the
    // status fields only when non-blank, so a plain approve/reject with no
    // note leaves the field untouched rather than writing an empty string.
    suspend fun decideLeave(requestId: String, decision: String, note: String? = null) {
        val status = if (decision == "approved") "approved" else "rejected"
        val resolvedBy = auth.currentUser?.displayName ?: auth.currentUser?.email ?: "Unknown"
        val trimmedNote = note?.trim()
        val ref = db.collection("leaveRequests").document(requestId)
        try {
            db.runTransaction { transaction ->
                val snapshot = transaction.get(ref)
                if (snapshot.getString("status") != "requested") {
                    throw ApiException("This request has already been resolved.")
                }
                val updates = mutableMapOf<String, Any>(
                    "status" to status,
                    "resolvedAt" to FieldValue.serverTimestamp(),
                    "resolvedBy" to resolvedBy
                )
                if (!trimmedNote.isNullOrBlank()) updates["decisionNote"] = trimmedNote
                transaction.update(ref, updates)
            }.await()
        } catch (err: ApiException) {
            throw err
        } catch (err: Exception) {
            throw ApiException(err.message ?: "Could not save decision.")
        }
    }

    // Permanently removes a request that's past its 7-day withdrawn grace
    // window - firestore.rules is what actually enforces that floor, this is
    // just the trigger (see RequestListViewModel's cleanup pass, which calls
    // this for every withdrawn request it notices is expired). Silently
    // ignored on failure: another client may have already deleted it, or the
    // rule's time check hasn't technically opened yet - either way it'll be
    // retried next time the list reloads.
    suspend fun deleteExpiredRequest(requestId: String) {
        runCatching { db.collection("leaveRequests").document(requestId).delete().await() }
    }

    fun listenUninformedLeaves(limit: Int = 300, onResult: (Result<List<UninformedLeave>>) -> Unit): ListenerRegistration {
        return db.collection("uninformedLeaves")
            .orderBy("reportedAt", Query.Direction.DESCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    onResult(Result.failure(error))
                } else if (snapshot != null) {
                    onResult(Result.success(snapshot.documents.map { it.toUninformedLeave() }))
                }
            }
    }

    // `dateMillis` is a UTC-day value from EditableDateField's DatePickerState,
    // same convention as LeaveDateDialog's read-only picker.
    suspend fun reportUninformedLeave(email: String, name: String, dateMillis: Long, reasonHtml: String) {
        val reportedBy = auth.currentUser?.displayName ?: auth.currentUser?.email ?: "Unknown"
        db.collection("uninformedLeaves").add(
            mapOf(
                "email" to email.lowercase(),
                "name" to name,
                "date" to Timestamp(java.util.Date(dateMillis)),
                "reasonHtml" to reasonHtml,
                "reportedBy" to reportedBy,
                "reportedAt" to FieldValue.serverTimestamp(),
                "status" to "reported"
            )
        ).await()
    }

    // Used both by the developer explaining themselves (web) and the owner
    // overriding directly (Android) - firestore.rules' two update disjuncts
    // allow either, both writing exactly these fields. push-daemon's Admin
    // SDK is what actually converts this into an approved leaveRequests doc.
    suspend fun resolveUninformedLeave(reportId: String, resolutionHtml: String) {
        val resolvedBy = auth.currentUser?.displayName ?: auth.currentUser?.email ?: "Unknown"
        db.collection("uninformedLeaves").document(reportId).update(
            mapOf(
                "status" to "resolved",
                "resolvedAt" to FieldValue.serverTimestamp(),
                "resolvedBy" to resolvedBy,
                "resolutionHtml" to resolutionHtml
            )
        ).await()
    }
}

private fun DocumentSnapshot.toLeaveRequest(): LeaveRequest = LeaveRequest(
    requestId = id,
    requestedAt = getTimestamp("requestedAt").toIsoStringOrEmpty(),
    startDate = getTimestamp("startDate").toIsoStringOrEmpty(),
    endDate = getTimestamp("endDate").toIsoStringOrEmpty(),
    email = getString("email") ?: "",
    name = getString("name") ?: "",
    weekLabel = getString("weekLabel") ?: "",
    type = LeaveType.normalize(getString("type") ?: ""),
    reasonHtml = getString("reasonHtml") ?: "",
    status = getString("status") ?: "requested",
    resolvedAt = getTimestamp("resolvedAt").toIsoStringOrEmpty(),
    resolvedBy = getString("resolvedBy") ?: "",
    attachments = toAttachments(),
    halfDayPeriod = getString("halfDayPeriod") ?: "",
    shortLeaveTime = getString("shortLeaveTime") ?: "",
    decisionNote = getString("decisionNote") ?: "",
    withdrawnAt = getTimestamp("withdrawnAt").toIsoStringOrEmpty()
)

private fun DocumentSnapshot.toUninformedLeave(): UninformedLeave = UninformedLeave(
    reportId = id,
    email = getString("email") ?: "",
    name = getString("name") ?: "",
    date = getTimestamp("date").toIsoStringOrEmpty(),
    reasonHtml = getString("reasonHtml") ?: "",
    reportedBy = getString("reportedBy") ?: "",
    reportedAt = getTimestamp("reportedAt").toIsoStringOrEmpty(),
    status = getString("status") ?: "reported",
    resolvedAt = getTimestamp("resolvedAt").toIsoStringOrEmpty(),
    resolvedBy = getString("resolvedBy") ?: "",
    resolutionHtml = getString("resolutionHtml") ?: "",
    linkedRequestId = getString("linkedRequestId") ?: ""
)

private fun Timestamp?.toIsoStringOrEmpty(): String = this?.toDate()?.toInstant()?.toString() ?: ""

// New docs store an `attachments` array; old docs have the singular
// attachmentName/attachmentUrl/attachmentFileId trio instead. Normalize to a
// list here so display code never has to branch on which shape a doc has.
@Suppress("UNCHECKED_CAST")
private fun DocumentSnapshot.toAttachments(): List<Attachment> {
    val list = get("attachments") as? List<Map<String, Any?>>
    if (list != null) {
        return list.map {
            Attachment(
                name = it["name"] as? String ?: "",
                url = it["url"] as? String ?: "",
                fileId = it["fileId"] as? String ?: ""
            )
        }
    }
    val legacyUrl = getString("attachmentUrl")
    if (!legacyUrl.isNullOrBlank()) {
        return listOf(
            Attachment(
                name = getString("attachmentName") ?: "Attachment",
                url = legacyUrl,
                fileId = getString("attachmentFileId") ?: ""
            )
        )
    }
    return emptyList()
}
