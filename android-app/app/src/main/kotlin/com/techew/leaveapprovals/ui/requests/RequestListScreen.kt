package com.techew.leaveapprovals.ui.requests

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import com.techew.leaveapprovals.data.LeaveRequest
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
    val records by viewModel.activeRecords.collectAsState()
    LeaveRequestList(
        viewModel = viewModel,
        records = records,
        emptyMessage = "No leave requests yet.",
        highlightRequestId = highlightRequestId,
        onHighlightHandled = onHighlightHandled
    )
}

/**
 * Shared by RequestListScreen (activeRecords) and ArchivedRequestsScreen
 * (archivedRecords) - same filter bar, list, and detail-sheet mechanics,
 * differing only in which derived list is passed in.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LeaveRequestList(
    viewModel: RequestListViewModel,
    records: List<LeaveRequest>,
    emptyMessage: String,
    highlightRequestId: String?,
    onHighlightHandled: () -> Unit
) {
    val isLoading by viewModel.isLoading.collectAsState()
    val isDeciding by viewModel.isDeciding.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val typeFilter by viewModel.typeFilter.collectAsState()
    val statusFilter by viewModel.statusFilter.collectAsState()
    val emailFilter by viewModel.emailFilter.collectAsState()
    val roster by viewModel.roster.collectAsState()
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

    // Approve/Reject just sets isDeciding true and lets the sheet show a
    // spinner for the round trip; once the decision's transaction finishes
    // and isDeciding flips back to false, close the sheet automatically -
    // the live listener (started when the ViewModel was constructed) picks
    // up the resulting status change on its own.
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

    Column(modifier = Modifier.fillMaxSize()) {
        LeaveFilterBar(
            typeFilter = typeFilter,
            statusFilter = statusFilter,
            emailFilter = emailFilter,
            roster = roster,
            onTypeChange = viewModel::setTypeFilter,
            onStatusChange = viewModel::setStatusFilter,
            onEmailChange = viewModel::setEmailFilter
        )
        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            when {
                isLoading && records.isEmpty() -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                records.isEmpty() -> {
                    Text(
                        errorMessage ?: emptyMessage,
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
