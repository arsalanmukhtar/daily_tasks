package com.techew.leaveapprovals.ui.common

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

// A calendar has no notion of "unselectable" that still shows an initial
// selection as disabled - this is what makes the picker read-only: every day
// refuses selection, so the initial highlight from *DatePickerState never
// moves no matter what the viewer taps.
private val NoDaySelectable = object : SelectableDates {
    override fun isSelectableDate(utcTimeMillis: Long) = false
    override fun isSelectableYear(year: Int) = false
}

private val HEADLINE_WITH_YEAR = DateTimeFormatter.ofPattern("d MMM yyyy")
private val HEADLINE_WITHOUT_YEAR = DateTimeFormatter.ofPattern("d MMM")

/**
 * Read-only calendar popup showing exactly which day(s) a leave request
 * covers - opened from a request's week-label chip, which on its own (e.g.
 * "Week 37, 2026") doesn't say which actual calendar days that is.
 *
 * Material3's default DatePicker/DateRangePicker header ("Select date(s)" +
 * a generic headline) is built for an editable picker, not a plain viewer -
 * it looks and reads oddly here, so title/headline are overridden with a
 * small caption + a properly formatted, on-theme date line instead.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveDateDialog(startIso: String, endIso: String, onDismiss: () -> Unit) {
    val startDate = isoToLocalDate(startIso) ?: run { onDismiss(); return }
    val endDate = isoToLocalDate(endIso) ?: startDate
    val isRange = endDate != startDate
    val startMillis = startDate.toUtcDayMillis()
    val endMillis = endDate.toUtcDayMillis()

    val headlineText = if (isRange) {
        val startText = if (startDate.year == endDate.year) {
            startDate.format(HEADLINE_WITHOUT_YEAR)
        } else {
            startDate.format(HEADLINE_WITH_YEAR)
        }
        "$startText – ${endDate.format(HEADLINE_WITH_YEAR)}"
    } else {
        startDate.format(HEADLINE_WITH_YEAR)
    }

    val title: @Composable () -> Unit = {
        Text(
            if (isRange) "LEAVE DATES" else "LEAVE DATE",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 24.dp, end = 24.dp, top = 20.dp)
        )
    }
    val headline: @Composable () -> Unit = {
        Text(
            headlineText,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(start = 24.dp, end = 24.dp, top = 6.dp, bottom = 12.dp)
        )
    }

    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } }
    ) {
        if (isRange) {
            val state = rememberDateRangePickerState(
                initialSelectedStartDateMillis = startMillis,
                initialSelectedEndDateMillis = endMillis,
                initialDisplayedMonthMillis = startMillis,
                selectableDates = NoDaySelectable
            )
            DateRangePicker(state = state, title = title, headline = headline, showModeToggle = false)
        } else {
            val state = rememberDatePickerState(
                initialSelectedDateMillis = startMillis,
                initialDisplayedMonthMillis = startMillis,
                selectableDates = NoDaySelectable
            )
            DatePicker(state = state, title = title, headline = headline, showModeToggle = false)
        }
    }
}

private fun isoToLocalDate(iso: String): LocalDate? {
    if (iso.isBlank()) return null
    return runCatching { Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate() }.getOrNull()
}

private fun LocalDate.toUtcDayMillis(): Long = atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
