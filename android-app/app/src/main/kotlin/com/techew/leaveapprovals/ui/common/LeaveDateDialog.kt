package com.techew.leaveapprovals.ui.common

import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

// A calendar has no notion of "unselectable" that still shows an initial
// selection as disabled - this is what makes the picker read-only: every day
// refuses selection, so the initial highlight from *DatePickerState never
// moves no matter what the viewer taps.
private val NoDaySelectable = object : SelectableDates {
    override fun isSelectableDate(utcTimeMillis: Long) = false
    override fun isSelectableYear(year: Int) = false
}

/**
 * Read-only calendar popup showing exactly which day(s) a leave request
 * covers - opened from a request's week-label chip, which on its own (e.g.
 * "Week 37, 2026") doesn't say which actual calendar days that is.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveDateDialog(startIso: String, endIso: String, onDismiss: () -> Unit) {
    val startMillis = isoToUtcDayMillis(startIso) ?: run { onDismiss(); return }
    val endMillis = isoToUtcDayMillis(endIso) ?: startMillis

    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } }
    ) {
        if (endMillis != startMillis) {
            val state = rememberDateRangePickerState(
                initialSelectedStartDateMillis = startMillis,
                initialSelectedEndDateMillis = endMillis,
                initialDisplayedMonthMillis = startMillis,
                selectableDates = NoDaySelectable
            )
            DateRangePicker(state = state, showModeToggle = false)
        } else {
            val state = rememberDatePickerState(
                initialSelectedDateMillis = startMillis,
                initialDisplayedMonthMillis = startMillis,
                selectableDates = NoDaySelectable
            )
            DatePicker(state = state, showModeToggle = false)
        }
    }
}

// DatePicker/DateRangePicker work in UTC calendar days - convert through the
// device's local date first so the highlighted day matches the actual leave
// day, not one shifted by the local UTC offset.
private fun isoToUtcDayMillis(iso: String): Long? {
    if (iso.isBlank()) return null
    return runCatching {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate()
            .atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    }.getOrNull()
}
