package com.techew.leaveapprovals

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.techew.leaveapprovals.push.NotificationHelper
import com.techew.leaveapprovals.ui.AppRoot
import com.techew.leaveapprovals.ui.theme.LeaveApprovalsTheme

class MainActivity : ComponentActivity() {

    private var highlightRequestIdState = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        highlightRequestIdState.value = intent?.getStringExtra(NotificationHelper.EXTRA_REQUEST_ID)

        setContent {
            var highlightRequestId by highlightRequestIdState
            LeaveApprovalsTheme {
                AppRoot(
                    highlightRequestId = highlightRequestId,
                    onHighlightHandled = { highlightRequestId = null }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        highlightRequestIdState.value = intent.getStringExtra(NotificationHelper.EXTRA_REQUEST_ID)
    }
}
