package com.techew.leaveapprovals.ui.requests

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequestListScreen(
    viewModel: RequestListViewModel,
    highlightRequestId: String?,
    onHighlightHandled: () -> Unit
) {
    val records by viewModel.records.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    LaunchedEffect(records, highlightRequestId) {
        if (highlightRequestId != null) {
            val index = records.indexOfFirst { it.requestId == highlightRequestId }
            if (index >= 0) {
                listState.animateScrollToItem(index)
                delay(3000)
                onHighlightHandled()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Leave Approvals") },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
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
                                highlighted = request.requestId == highlightRequestId,
                                onDecide = { decision -> viewModel.decide(request.requestId, decision) }
                            )
                        }
                    }
                }
            }
        }
    }
}
