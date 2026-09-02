package com.techew.leaveapprovals.auth

import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.techew.leaveapprovals.AppConfig
import com.techew.leaveapprovals.data.AllowlistRepository
import kotlinx.coroutines.tasks.await

/**
 * Native Google Sign-In via Credential Manager, exchanged for a Firebase
 * credential. This never touches a WebView or browser popup, unlike the
 * old manager.html PWA - which is the whole reason this app exists: Apple
 * blocks Google Sign-In inside an installed home-screen web app, but there
 * is no such restriction for a native Android account picker.
 *
 * The owner check here is UX only - firestore.rules independently checks
 * the same `allowlist` doc on every read/write, which is the real security
 * boundary.
 */
class AuthRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val allowlistRepository: AllowlistRepository = AllowlistRepository()
) {

    val currentUser get() = auth.currentUser

    suspend fun signIn(context: Context): AuthState {
        return try {
            val option = GetSignInWithGoogleOption.Builder(serverClientId = AppConfig.WEB_CLIENT_ID).build()
            val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
            val result = CredentialManager.create(context).getCredential(context, request)

            val credential = result.credential
            if (credential is CustomCredential &&
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                val firebaseCredential = GoogleAuthProvider.getCredential(googleIdTokenCredential.idToken, null)
                val authResult = auth.signInWithCredential(firebaseCredential).await()
                val user = authResult.user ?: return AuthState.Error("Sign-in returned no user.")
                stateFor(user)
            } else {
                AuthState.Error("Unexpected credential type from Credential Manager.")
            }
        } catch (err: Exception) {
            AuthState.Error(err.message ?: "Sign-in failed.")
        }
    }

    suspend fun signOut(context: Context) {
        auth.signOut()
        try {
            CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
        } catch (_: Exception) {
            // Best-effort only - signOut() above is what actually matters.
        }
    }

    suspend fun stateForCurrentUser(): AuthState {
        val user = auth.currentUser ?: return AuthState.SignedOut
        return stateFor(user)
    }

    private suspend fun stateFor(user: com.google.firebase.auth.FirebaseUser): AuthState {
        val email = user.email?.lowercase() ?: return AuthState.SignedInNotOwner("(no email)")
        return try {
            if (allowlistRepository.isOwner(email)) {
                AuthState.SignedInOwner(user)
            } else {
                AuthState.SignedInNotOwner(email)
            }
        } catch (err: Exception) {
            AuthState.Error(err.message ?: "Could not verify account access.")
        }
    }
}
