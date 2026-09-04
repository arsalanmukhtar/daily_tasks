package com.techew.leaveapprovals.ui.common

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.techew.leaveapprovals.data.AllowlistEntry

/**
 * Single-select developer dropdown, required (no "All"/none option) - used
 * to pick exactly who an uninformed-leave report is against. A sibling of
 * LeaveSummaryScreen's multi-select DeveloperFilterDropdown, but this one
 * closes as soon as a pick is made, matching the status/type dropdowns.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeveloperPickerDropdown(
    roster: List<AllowlistEntry>,
    selectedEmail: String?,
    onSelect: (AllowlistEntry) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val sortedRoster = remember(roster) { roster.sortedBy { it.name.ifBlank { it.email } } }
    val label = sortedRoster.find { it.email == selectedEmail }?.name?.ifBlank { selectedEmail }
        ?: "Select a developer"

    Box(modifier = modifier) {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Text(
                label, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f)
            )
            Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, modifier = Modifier.size(18.dp))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            sortedRoster.forEach { entry ->
                DropdownMenuItem(
                    text = { Text(entry.name.ifBlank { entry.email }) },
                    onClick = {
                        onSelect(entry)
                        expanded = false
                    }
                )
            }
        }
    }
}
