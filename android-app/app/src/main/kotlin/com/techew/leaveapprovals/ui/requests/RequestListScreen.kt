package com.techew.leaveapprovals.ui.requests

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/**
 * Content only - no Scaffold/TopAppBar of its own. It's hosted inside
 * ManagerHomeScreen's single Scaffold, which owns the top bar (title +
 * refresh) and the bottom navigation dock; nesting a second Scaffold here
 * would double-apply the status bar inset.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequestListScreen(
    viewModel: RequestListViewModel,
    highlightRequestId: String?,
    onHighlightHandled: () -> Unit
) {
    val records by viewModel.records.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isDeciding by viewModel.isDeciding.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    var selectedRequestId by remember { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    fun closeSheet() {
        scope.launch {
            sheetState.hide()
        }.invokeOnCompletion {
            if (!sheetState.isVisible) selectedRequestId = null
        }
    }

    LaunchedEffect(Unit) { viewModel.refresh() }

    // Approve/Reject just sets isDeciding true and lets the sheet show a
    // spinner for the round trip; once the refreshed list lands and
    // isDeciding flips back to false, close the sheet automatically.
    var wasDeciding by remember { mutableStateOf(false) }
    LaunchedEffect(isDeciding) {
        if (wasDeciding && !isDeciding) closeSheet()
        wasDeciding = isDeciding
    }

    // Notification tap: scroll to the request and open its details directly -
    // stronger and simpler than the old flash-then-fade card highlight, since
    // the sheet itself is now the "here's the one you tapped" cue.
    LaunchedEffect(records, highlightRequestId) {
        if (highlightRequestId != null) {
            val index = records.indexOfFirst { it.requestId == highlightRequestId }
            if (index >= 0) {
                listState.animateScrollToItem(index)
                selectedRequestId = highlightRequestId
                onHighlightHandled()
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when {
            isLoading && records.isEmpty() -> {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            }
            records.isEmpty() -> {
                Text(
                    errorMessage ?: "No leave requests yet.",
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            else -> {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)
                ) {
                    items(records, key = { it.requestId }) { request ->
                        RequestCard(
                            request = request,
                            onViewDetails = { selectedRequestId = request.requestId }
                        )
                    }
                }
            }
        }
    }

    val selectedRequest = records.find { it.requestId == selectedRequestId }
    if (selectedRequest != null) {
        RequestDetailSheet(
            request = selectedRequest,
            sheetState = sheetState,
            isDeciding = isDeciding,
            onDismiss = { closeSheet() },
            onDecide = { decision ->
                viewModel.decide(selectedRequest.requestId, decision)
            }
        )
    }
}
