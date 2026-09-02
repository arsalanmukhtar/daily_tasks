package com.techew.leaveapprovals.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.techew.leaveapprovals.ui.requests.RequestListScreen
import com.techew.leaveapprovals.ui.requests.RequestListViewModel
import com.techew.leaveapprovals.ui.summary.LeaveSummaryScreen
import com.techew.leaveapprovals.ui.summary.LeaveSummaryViewModel

private enum class ManagerTab(val title: String) {
    Requests("Leave Requests"),
    Summary("Leave Summary")
}

/**
 * Owns the single Scaffold for the signed-in-owner experience: a top bar
 * (title + refresh, both tab-aware) and a bottom-docked tab switch between
 * the pending-request queue and the analytics view. The two tab contents are
 * plain composables with no Scaffold of their own, so the status bar inset
 * is only ever applied once.
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

    // A notification tap always means "show me that request" - jump back to
    // the Requests tab so the detail sheet it opens is actually visible.
    LaunchedEffect(highlightRequestId) {
        if (highlightRequestId != null) selectedTab = ManagerTab.Requests
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(selectedTab.title) },
                actions = {
                    IconButton(onClick = {
                        when (selectedTab) {
                            ManagerTab.Requests -> requestListViewModel.refresh()
                            ManagerTab.Summary -> summaryViewModel.refresh()
                        }
                    }) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
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
                    label = { Text(ManagerTab.Requests.title.removePrefix("Leave ")) }
                )
                NavigationBarItem(
                    selected = selectedTab == ManagerTab.Summary,
                    onClick = { selectedTab = ManagerTab.Summary },
                    icon = { Icon(Icons.Outlined.Insights, contentDescription = null) },
                    label = { Text(ManagerTab.Summary.title.removePrefix("Leave ")) }
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
                ManagerTab.Summary -> LeaveSummaryScreen(viewModel = summaryViewModel)
            }
        }
    }
}
