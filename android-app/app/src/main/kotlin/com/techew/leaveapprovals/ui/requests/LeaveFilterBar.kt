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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.text.style.TextOverflow
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
        // Three compact pickers side by side (status / type / person) rather
        // than two separately-scrolling rows of one-chip-per-value - matches
        // the mockup's single-row .filterbar and actually fits a phone
        // screen instead of clipping the last chip off both rows.
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            FilterDropdownButton(
                label = statusFilter?.let { statusLabel(it) } ?: "All statuses",
                modifier = Modifier.weight(1f)
            ) { close ->
                DropdownMenuItem(text = { Text("All statuses") }, onClick = { onStatusChange(null); close() })
                STATUSES.forEach { status ->
                    DropdownMenuItem(text = { Text(statusLabel(status)) }, onClick = { onStatusChange(status); close() })
                }
            }
            FilterDropdownButton(
                label = typeFilter?.let { LeaveType.label(it) } ?: "All types",
                modifier = Modifier.weight(1f)
            ) { close ->
                DropdownMenuItem(text = { Text("All types") }, onClick = { onTypeChange(null); close() })
                LeaveType.ALL.forEach { type ->
                    DropdownMenuItem(text = { Text(LeaveType.label(type)) }, onClick = { onTypeChange(type); close() })
                }
            }

            var sheetOpen by remember { mutableStateOf(false) }
            val selectedName = roster.find { it.email == emailFilter }?.name ?: "Everyone"
            OutlinedButton(
                onClick = { sheetOpen = true },
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 8.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    selectedName, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f)
                )
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, modifier = Modifier.size(18.dp))
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
}

/**
 * A single compact "Label ▾" pill that opens a plain DropdownMenu - used for
 * the status/type pickers, which (unlike the person filter) are short,
 * static, unsearched lists where a full bottom sheet would be overkill.
 */
@Composable
private fun FilterDropdownButton(
    label: String,
    modifier: Modifier = Modifier,
    items: @Composable (close: () -> Unit) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = modifier) {
        OutlinedButton(
            onClick = { expanded = true },
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                label, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f)
            )
            Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, modifier = Modifier.size(18.dp))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            items { expanded = false }
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
