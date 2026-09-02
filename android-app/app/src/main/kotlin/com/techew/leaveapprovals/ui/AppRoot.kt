package com.techew.leaveapprovals.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.techew.leaveapprovals.auth.AuthRepository
import com.techew.leaveapprovals.auth.AuthState
import com.techew.leaveapprovals.data.LeaveApiClient
import com.techew.leaveapprovals.push.NotificationHelper
import com.techew.leaveapprovals.ui.requests.RequestListViewModel
import com.techew.leaveapprovals.ui.restricted.RestrictedScreen
import com.techew.leaveapprovals.ui.signin.SignInScreen
import com.techew.leaveapprovals.ui.summary.LeaveSummaryViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@Composable
fun AppRoot(
    highlightRequestId: String?,
    onHighlightHandled: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val authRepository = remember { AuthRepository() }
    val apiClient = remember { LeaveApiClient() }

    var authState by remember { mutableStateOf<AuthState>(AuthState.Loading) }
    var isSigningIn by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        authState = authRepository.stateForCurrentUser()
    }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* registration below happens regardless of the result */ }

    // Once signed in as owner: request the notification permission (API 33+)
    // and register the FCM token - registration itself doesn't need the
    // permission, only *displaying* a notification does, so this always runs.
    LaunchedEffect(authState) {
        if (authState !is AuthState.SignedInOwner) return@LaunchedEffect
        NotificationHelper.ensureChannel(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        runCatching {
            val token = FirebaseMessaging.getInstance().token.await()
            apiClient.registerPushToken(token)
        }
    }

    when (val state = authState) {
        is AuthState.Loading -> {
            Box(Modifier.fillMaxSize()) { CircularProgressIndicator(Modifier.align(Alignment.Center)) }
        }
        is AuthState.SignedOut -> {
            SignInScreen(
                isLoading = isSigningIn,
                errorMessage = null,
                onSignInClick = {
                    isSigningIn = true
                    scope.launch {
                        authState = authRepository.signIn(context)
                        isSigningIn = false
                    }
                }
            )
        }
        is AuthState.Error -> {
            SignInScreen(
                isLoading = isSigningIn,
                errorMessage = state.message,
                onSignInClick = {
                    isSigningIn = true
                    scope.launch {
                        authState = authRepository.signIn(context)
                        isSigningIn = false
                    }
                }
            )
        }
        is AuthState.SignedInNotOwner -> {
            RestrictedScreen(
                email = state.email,
                onSignOut = {
                    scope.launch {
                        authRepository.signOut(context)
                        authState = AuthState.SignedOut
                    }
                }
            )
        }
        is AuthState.SignedInOwner -> {
            val requestListViewModel = remember(state.user.uid) { RequestListViewModel(apiClient) }
            val summaryViewModel = remember(state.user.uid) { LeaveSummaryViewModel(apiClient) }
            ManagerHomeScreen(
                requestListViewModel = requestListViewModel,
                summaryViewModel = summaryViewModel,
                highlightRequestId = highlightRequestId,
                onHighlightHandled = onHighlightHandled
            )
        }
    }
}
