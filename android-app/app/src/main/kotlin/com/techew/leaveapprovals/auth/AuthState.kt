package com.techew.leaveapprovals.auth

import com.google.firebase.auth.FirebaseUser

sealed class AuthState {
    data object Loading : AuthState()
    data object SignedOut : AuthState()
    data class SignedInOwner(val user: FirebaseUser) : AuthState()
    data class SignedInNotOwner(val email: String) : AuthState()
    data class Error(val message: String) : AuthState()
}
