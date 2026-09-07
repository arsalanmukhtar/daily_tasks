package com.techew.leaveapprovals.ui.common

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.techew.leaveapprovals.data.AllowlistEntry

/**
 * The search box dropped at the top of a developer-picker DropdownMenu -
 * shared by every dropdown long enough that typing a name beats scrolling
 * to it (DeveloperPickerDropdown, the Summary "Compare" and Report
 * developer filters). The short, fixed-length status/type dropdowns in
 * LeaveFilterBar deliberately skip this - see the comment on
 * FilterDropdownButton there.
 */
@Composable
fun DropdownSearchField(query: String, onQueryChange: (String) -> Unit, itemCount: Int) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyMedium,
        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
        placeholder = { Text("Search $itemCount developers", style = MaterialTheme.typography.bodyMedium) },
        shape = RoundedCornerShape(50),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp).height(46.dp)
    )
}

fun List<AllowlistEntry>.filterByQuery(query: String): List<AllowlistEntry> =
    if (query.isBlank()) this
    else filter { it.name.contains(query, ignoreCase = true) || it.email.contains(query, ignoreCase = true) }
