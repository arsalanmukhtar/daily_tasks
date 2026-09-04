package com.techew.leaveapprovals.ui.common

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

private val DISPLAY_FORMATTER = DateTimeFormatter.ofPattern("d MMM yyyy")

/**
 * A real (editable) single-date picker, unlike LeaveDateDialog's read-only
 * one - same underlying Material3 DatePicker, just without the
 * always-refuse-selection constraint, and with a Confirm button that
 * actually commits the pick. Used for the uninformed-absence date, which
 * defaults to today but the manager can back-date to when it actually
 * happened.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditableDateField(
    dateMillis: Long,
    onDateChange: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    var showDialog by remember { mutableStateOf(false) }
    val label = remember(dateMillis) {
        Instant.ofEpochMilli(dateMillis).atZone(ZoneId.systemDefault()).toLocalDate().format(DISPLAY_FORMATTER)
    }

    OutlinedButton(onClick = { showDialog = true }, modifier = modifier) {
        Icon(Icons.Filled.CalendarMonth, contentDescription = null, modifier = Modifier.size(18.dp))
        Text(label, modifier = Modifier.padding(start = 8.dp))
    }

    if (showDialog) {
        val state = rememberDatePickerState(initialSelectedDateMillis = dateMillis)
        DatePickerDialog(
            onDismissRequest = { showDialog = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { pickedUtcMillis ->
                        // The state's millis are a UTC-midnight day value - convert
                        // through LocalDate so what's stored matches the calendar
                        // day actually tapped, not shifted by the local UTC offset.
                        val localDate = Instant.ofEpochMilli(pickedUtcMillis).atZone(ZoneOffset.UTC).toLocalDate()
                        onDateChange(localDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli())
                    }
                    showDialog = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showDialog = false }) { Text("Cancel") } }
        ) {
            DatePicker(state = state, showModeToggle = false)
        }
    }
}
