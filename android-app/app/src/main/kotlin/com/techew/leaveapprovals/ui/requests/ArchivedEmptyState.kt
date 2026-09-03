package com.techew.leaveapprovals.ui.requests

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Real empty state for the Archived tab (icon + explanatory copy + a way
 * out), replacing the bare centered "No archived leave requests yet." text.
 * Only used here, via LeaveRequestList's optional emptySlot - the Requests
 * tab keeps its own plain message untouched.
 *
 * Copy intentionally does NOT say "after 90 days" (unlike the mobile mockup
 * this was designed from) - the real archiving rule in ArchiveRules.kt is
 * purely date-driven: a request archives the day after its last leave day
 * passes, regardless of status or age.
 */
@Composable
internal fun ArchivedEmptyState(
    hasActiveFilters: Boolean,
    onClearFilters: () -> Unit,
    onGoToRequests: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 34.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Outlined.Archive,
                contentDescription = null,
                modifier = Modifier.size(40.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Text(
            if (hasActiveFilters) "No archived requests match" else "Nothing archived yet",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 16.dp)
        )
        Text(
            if (hasActiveFilters) {
                "No archived requests match the current filters. Try clearing them to see everything."
            } else {
                "A request moves here the day after its last leave date passes, whether or not it was ever decided."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp)
        )
        Row(modifier = Modifier.padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (hasActiveFilters) {
                OutlinedButton(onClick = onClearFilters) { Text("Clear filters") }
            }
            Button(onClick = onGoToRequests) { Text("Go to requests") }
        }
    }
}
