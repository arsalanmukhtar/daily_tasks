package com.techew.leaveapprovals.data

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

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
}
