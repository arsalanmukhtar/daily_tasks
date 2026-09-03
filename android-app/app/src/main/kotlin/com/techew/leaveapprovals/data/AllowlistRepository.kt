package com.techew.leaveapprovals.data

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

data class AllowlistEntry(
    val email: String,
    val name: String = "",
    val isOwner: Boolean = false,
    val active: Boolean = true
)

/**
 * Owner status lives in Firestore (`allowlist/{emailLower}`), the same
 * collection the web app's security rules read - not a build-time constant,
 * so adding/removing an owner is a Console data edit, not an app release.
 */
class AllowlistRepository(private val db: FirebaseFirestore = FirebaseFirestore.getInstance()) {

    suspend fun isOwner(emailLower: String): Boolean {
        val doc = db.collection("allowlist").document(emailLower).get().await()
        return doc.getBoolean("active") == true && doc.getBoolean("isOwner") == true
    }

    // The full roster, regardless of leave history - used to populate user
    // filters (Requests/Archive/Summary) so every allowlisted developer is
    // selectable even if they've never applied for leave.
    suspend fun listAll(): List<AllowlistEntry> {
        val snap = db.collection("allowlist").get().await()
        return snap.documents.map { doc ->
            AllowlistEntry(
                email = doc.id,
                name = doc.getString("name") ?: doc.id,
                isOwner = doc.getBoolean("isOwner") == true,
                active = doc.getBoolean("active") == true
            )
        }
    }
}
