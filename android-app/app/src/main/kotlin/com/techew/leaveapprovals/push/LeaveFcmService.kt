package com.techew.leaveapprovals.push

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.techew.leaveapprovals.AppConfig
import com.techew.leaveapprovals.data.LeaveApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class LeaveFcmService : FirebaseMessagingService() {

    private val apiClient = LeaveApiClient(AppConfig.APPS_SCRIPT_URL)
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onNewToken(token: String) {
        val user = FirebaseAuth.getInstance().currentUser ?: return
        if (user.email?.lowercase() != AppConfig.OWNER_EMAIL) return
        scope.launch {
            runCatching {
                val idToken = user.getIdToken(false).await().token ?: return@runCatching
                apiClient.registerPushToken(idToken, token)
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: "Leave Approvals"
        val body = message.notification?.body ?: ""
        val requestId = message.data["requestId"]
        NotificationHelper.showLeaveNotification(applicationContext, title, body, requestId)
    }
}
