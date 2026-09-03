package com.techew.leaveapprovals.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import com.techew.leaveapprovals.data.isArchived
import com.techew.leaveapprovals.ui.requests.ArchivedRequestsScreen
import com.techew.leaveapprovals.ui.requests.RequestListScreen
import com.techew.leaveapprovals.ui.requests.RequestListViewModel
import com.techew.leaveapprovals.ui.summary.LeaveSummaryScreen
import com.techew.leaveapprovals.ui.summary.LeaveSummaryViewModel

private enum class ManagerTab(val title: String) {
    Requests("Leave Requests"),
    Archived("Archived Requests"),
    Summary("Leave Summary")
}

/**
 * Owns the single Scaffold for the signed-in-owner experience: a top bar
 * (title + refresh, both tab-aware) and a bottom-docked tab switch across
 * Requests / Archived / Summary. The tab contents are plain composables with
 * no Scaffold of their own, so the status bar inset is only ever applied once.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManagerHomeScreen(
    requestListViewModel: RequestListViewModel,
    summaryViewModel: LeaveSummaryViewModel,
    highlightRequestId: String?,
    onHighlightHandled: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(ManagerTab.Requests) }
    val allRecords by requestListViewModel.records.collectAsState()

    // A notification tap always means "show me that request" - route to
    // whichever tab it actually lives in. A request can age into Archived
    // between when the push fired and when it's actually tapped, so this
    // can't just always jump to Requests anymore.
    LaunchedEffect(highlightRequestId, allRecords) {
        if (highlightRequestId == null) return@LaunchedEffect
        val target = allRecords.find { it.requestId == highlightRequestId }
        selectedTab = if (target != null && target.isArchived()) ManagerTab.Archived else ManagerTab.Requests
    }

    val requestsLoading by requestListViewModel.isLoading.collectAsState()
    val summaryLoading by summaryViewModel.isLoading.collectAsState()
    val isRefreshing = when (selectedTab) {
        ManagerTab.Requests, ManagerTab.Archived -> requestsLoading
        ManagerTab.Summary -> summaryLoading
    }
    val rotation by rememberInfiniteTransition(label = "refresh-spin").animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(animation = tween(800, easing = LinearEasing), repeatMode = RepeatMode.Restart),
        label = "refresh-spin-angle"
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(selectedTab.title) },
                actions = {
                    IconButton(onClick = {
                        when (selectedTab) {
                            ManagerTab.Requests, ManagerTab.Archived -> requestListViewModel.refresh()
                            ManagerTab.Summary -> summaryViewModel.refresh()
                        }
                    }) {
                        Icon(
                            Icons.Filled.Refresh,
                            contentDescription = "Refresh",
                            modifier = if (isRefreshing) Modifier.rotate(rotation) else Modifier
                        )
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == ManagerTab.Requests,
                    onClick = { selectedTab = ManagerTab.Requests },
                    icon = { Icon(Icons.Outlined.Assignment, contentDescription = null) },
                    label = { Text("Requests") }
                )
                NavigationBarItem(
                    selected = selectedTab == ManagerTab.Archived,
                    onClick = { selectedTab = ManagerTab.Archived },
                    icon = { Icon(Icons.Outlined.Archive, contentDescription = null) },
                    label = { Text("Archived") }
                )
                NavigationBarItem(
                    selected = selectedTab == ManagerTab.Summary,
                    onClick = { selectedTab = ManagerTab.Summary },
                    icon = { Icon(Icons.Outlined.Insights, contentDescription = null) },
                    label = { Text("Summary") }
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (selectedTab) {
                ManagerTab.Requests -> RequestListScreen(
                    viewModel = requestListViewModel,
                    highlightRequestId = highlightRequestId,
                    onHighlightHandled = onHighlightHandled
                )
                ManagerTab.Archived -> ArchivedRequestsScreen(
                    viewModel = requestListViewModel,
                    highlightRequestId = highlightRequestId,
                    onHighlightHandled = onHighlightHandled,
                    onGoToRequests = { selectedTab = ManagerTab.Requests }
                )
                ManagerTab.Summary -> LeaveSummaryScreen(viewModel = summaryViewModel)
            }
        }
    }
}
