package com.techew.leaveapprovals.push

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.techew.leaveapprovals.data.AllowlistRepository
import com.techew.leaveapprovals.data.LeaveApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class LeaveFcmService : FirebaseMessagingService() {

    private val apiClient = LeaveApiClient()
    private val allowlistRepository = AllowlistRepository()
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onNewToken(token: String) {
        val email = FirebaseAuth.getInstance().currentUser?.email?.lowercase() ?: return
        scope.launch {
            runCatching {
                if (!allowlistRepository.isOwner(email)) return@runCatching
                apiClient.registerPushToken(token)
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
