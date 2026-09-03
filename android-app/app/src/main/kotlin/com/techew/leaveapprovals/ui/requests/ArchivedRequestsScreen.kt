package com.techew.leaveapprovals.ui.requests

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue

/**
 * Same list/filter/detail-sheet mechanics as RequestListScreen, just backed
 * by archivedRecords instead of activeRecords - a request moves here once
 * its last leave day has passed (see LeaveRequest.isArchived()), regardless
 * of whether it was ever decided.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArchivedRequestsScreen(
    viewModel: RequestListViewModel,
    highlightRequestId: String?,
    onHighlightHandled: () -> Unit,
    onGoToRequests: () -> Unit
) {
    val records by viewModel.archivedRecords.collectAsState()
    LeaveRequestList(
        viewModel = viewModel,
        records = records,
        emptyMessage = "No archived leave requests yet.",
        highlightRequestId = highlightRequestId,
        onHighlightHandled = onHighlightHandled,
        emptySlot = { hasActiveFilters, onClearFilters ->
            ArchivedEmptyState(
                hasActiveFilters = hasActiveFilters,
                onClearFilters = onClearFilters,
                onGoToRequests = onGoToRequests
            )
        }
    )
}
