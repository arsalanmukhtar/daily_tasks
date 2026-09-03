package com.techew.leaveapprovals.ui.requests

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.techew.leaveapprovals.data.AllowlistEntry
import com.techew.leaveapprovals.data.LeaveType

private val STATUSES = listOf("requested", "approved", "rejected")
private fun statusLabel(status: String) = when (status) {
    "requested" -> "Requested"
    "approved" -> "Approved"
    "rejected" -> "Rejected"
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

        var expanded by remember { mutableStateOf(false) }
        val selectedName = roster.find { it.email == emailFilter }?.name ?: "All developers"
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it },
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
        ) {
            OutlinedTextField(
                value = selectedName,
                onValueChange = {},
                readOnly = true,
                label = { Text("Developer") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth()
            )
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                DropdownMenuItem(text = { Text("All developers") }, onClick = { onEmailChange(null); expanded = false })
                roster.sortedBy { it.name }.forEach { entry ->
                    DropdownMenuItem(text = { Text(entry.name) }, onClick = { onEmailChange(entry.email); expanded = false })
                }
            }
        }
    }
}
