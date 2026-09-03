package com.techew.leaveapprovals.ui.requests

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.techew.leaveapprovals.data.AllowlistEntry
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.data.LeaveType
import com.techew.leaveapprovals.ui.common.Avatar

private val STATUSES = listOf("requested", "approved", "rejected", "withdrawn")
private fun statusLabel(status: String) = when (status) {
    "requested" -> "Requested"
    "approved" -> "Approved"
    "rejected" -> "Rejected"
    "withdrawn" -> "Withdrawn"
    else -> status
}

/**
 * Status / type / developer filters, shared by the Requests and Archived
 * screens (both read/write the same filter state on RequestListViewModel,
 * so switching tabs doesn't reset the manager's current filter selection).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveFilterBar(
    typeFilter: String?,
    statusFilter: String?,
    emailFilter: String?,
    roster: List<AllowlistEntry>,
    allRecords: List<LeaveRequest>,
    onTypeChange: (String?) -> Unit,
    onStatusChange: (String?) -> Unit,
    onEmailChange: (String?) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                FilterChip(selected = statusFilter == null, onClick = { onStatusChange(null) }, label = { Text("All statuses") })
            }
            items(STATUSES) { status ->
                FilterChip(selected = statusFilter == status, onClick = { onStatusChange(status) }, label = { Text(statusLabel(status)) })
            }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
            item {
                FilterChip(selected = typeFilter == null, onClick = { onTypeChange(null) }, label = { Text("All types") })
            }
            items(LeaveType.ALL) { type ->
                FilterChip(selected = typeFilter == type, onClick = { onTypeChange(type) }, label = { Text(LeaveType.label(type)) })
            }
        }

        var sheetOpen by remember { mutableStateOf(false) }
        val selectedName = roster.find { it.email == emailFilter }?.name ?: "All developers"
        OutlinedButton(
            onClick = { sheetOpen = true },
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
        ) {
            Text(selectedName, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Start)
            Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null)
        }

        if (sheetOpen) {
            PersonFilterSheet(
                roster = roster,
                allRecords = allRecords,
                emailFilter = emailFilter,
                onEmailChange = onEmailChange,
                onDismiss = { sheetOpen = false }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PersonFilterSheet(
    roster: List<AllowlistEntry>,
    allRecords: List<LeaveRequest>,
    emailFilter: String?,
    onEmailChange: (String?) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var query by remember { mutableStateOf("") }

    // Counts come from every currently-loaded record, independent of the
    // email selection itself - so switching who's selected never changes
    // what number shows next to anyone else in the list.
    val counts = remember(allRecords) { allRecords.groupingBy { it.email }.eachCount() }
    val filteredRoster = remember(roster, query) {
        val sorted = roster.sortedBy { it.name.ifBlank { it.email } }
        if (query.isBlank()) sorted
        else sorted.filter { it.name.contains(query, ignoreCase = true) || it.email.contains(query, ignoreCase = true) }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Filter by person", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                TextButton(onClick = { onEmailChange(null); onDismiss() }) { Text("Clear") }
            }
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                singleLine = true,
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                placeholder = { Text("Search ${roster.size} developers") },
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 6.dp)
            )
            LazyColumn(modifier = Modifier.heightIn(max = 420.dp)) {
                item {
                    PersonRow(
                        avatar = {
                            Box(
                                modifier = Modifier.size(32.dp).clip(CircleShape).background(MaterialTheme.colorScheme.onSurfaceVariant),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("All", color = MaterialTheme.colorScheme.surface, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                            }
                        },
                        name = "Everyone",
                        count = allRecords.size,
                        selected = emailFilter == null,
                        onClick = { onEmailChange(null); onDismiss() }
                    )
                    HorizontalDivider()
                }
                items(filteredRoster, key = { it.email }) { entry ->
                    PersonRow(
                        avatar = { Avatar(name = entry.name, email = entry.email, size = 32.dp) },
                        name = entry.name.ifBlank { entry.email },
                        count = counts[entry.email] ?: 0,
                        selected = emailFilter == entry.email,
                        onClick = { onEmailChange(entry.email); onDismiss() }
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun PersonRow(
    avatar: @Composable () -> Unit,
    name: String,
    count: Int,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) MaterialTheme.colorScheme.secondaryContainer else androidx.compose.ui.graphics.Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        avatar()
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            name,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.weight(1f)
        )
        Text(
            count.toString(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 8.dp, vertical = 3.dp)
        )
        if (selected) {
            Icon(
                Icons.Filled.Check,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
    }
}
