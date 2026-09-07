package com.techew.leaveapprovals.ui.requests

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.ui.common.PeriodChip
import java.time.Instant
import java.time.LocalDate
import java.time.Year
import java.time.ZoneId
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

private val ARCHIVE_MONTH_LABELS = (1..12).map {
    java.time.Month.of(it).getDisplayName(TextStyle.SHORT, Locale.getDefault())
}

private enum class ArchiveGranularity(val label: String) { YEAR("Year"), QUARTER("Quarter"), MONTH("Month"), WEEK("Week") }

// "When did this leave actually happen" - startDate first (the real leave
// day, matching how the web app derives its own week/quarter groupings),
// falling back to requestedAt only for the rare doc missing a startDate.
private fun LeaveRequest.archiveDateOrNull(): LocalDate? =
    startDate.toArchiveLocalDateOrNull() ?: requestedAt.toArchiveLocalDateOrNull()

private fun String.toArchiveLocalDateOrNull(): LocalDate? =
    if (isBlank()) null else runCatching { Instant.parse(this).atZone(ZoneId.systemDefault()).toLocalDate() }.getOrNull()

private fun LeaveRequest.archiveWeekOrNull(): Int? =
    archiveDateOrNull()?.get(WeekFields.ISO.weekOfWeekBasedYear())

/**
 * Same list/filter/detail-sheet mechanics as RequestListScreen, just backed
 * by archivedRecords instead of activeRecords - a request moves here once
 * its last leave day has passed (see LeaveRequest.isArchived()), regardless
 * of whether it was ever decided.
 *
 * Archived history only grows, so a flat list becomes unwieldy fast - this
 * adds a Year > Quarter > Month > Week drill-down above the list (same
 * granularity-chip pattern as the Summary screen). Every level is directly
 * selectable, not just the deepest one: picking "Year" and a year alone
 * already scopes the list to that whole year, "Quarter" scopes to one
 * quarter, and so on - there's no requirement to drill all the way down to
 * a single week to see something.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArchivedRequestsScreen(
    viewModel: RequestListViewModel,
    highlightRequestId: String?,
    onHighlightHandled: () -> Unit,
    onGoToRequests: () -> Unit
) {
    val allArchived by viewModel.archivedRecords.collectAsState()

    var granularity by remember { mutableStateOf(ArchiveGranularity.YEAR) }
    var selectedYear by remember { mutableStateOf(Year.now().value) }
    var selectedQuarter by remember { mutableStateOf(((LocalDate.now().monthValue - 1) / 3) + 1) }
    var selectedMonth by remember { mutableStateOf(LocalDate.now().monthValue) }
    var selectedWeek by remember { mutableStateOf(LocalDate.now().get(WeekFields.ISO.weekOfWeekBasedYear())) }

    val availableYears = remember(allArchived) {
        val years = allArchived.mapNotNull { it.archiveDateOrNull()?.year }.toMutableSet()
        years.add(Year.now().value)
        years.sortedDescending()
    }
    LaunchedEffect(availableYears) {
        if (selectedYear !in availableYears) selectedYear = availableYears.first()
    }

    val yearRecords = remember(allArchived, selectedYear) {
        allArchived.filter { it.archiveDateOrNull()?.year == selectedYear }
    }
    val availableWeeks = remember(yearRecords) {
        val weeks = yearRecords.mapNotNull { it.archiveWeekOrNull() }.toMutableSet()
        weeks.add(LocalDate.now().get(WeekFields.ISO.weekOfWeekBasedYear()))
        weeks.sorted()
    }
    LaunchedEffect(availableWeeks) {
        if (selectedWeek !in availableWeeks) selectedWeek = availableWeeks.first()
    }

    // The records actually shown below, narrowed as far as the current
    // granularity + selection goes - just yearRecords when granularity is
    // YEAR, so "view the whole year" needs no further picking.
    val periodRecords = remember(yearRecords, granularity, selectedQuarter, selectedMonth, selectedWeek) {
        when (granularity) {
            ArchiveGranularity.YEAR -> yearRecords
            ArchiveGranularity.QUARTER -> yearRecords.filter { r ->
                val m = r.archiveDateOrNull()?.monthValue ?: return@filter false
                (m - 1) / 3 + 1 == selectedQuarter
            }
            ArchiveGranularity.MONTH -> yearRecords.filter { it.archiveDateOrNull()?.monthValue == selectedMonth }
            ArchiveGranularity.WEEK -> yearRecords.filter { it.archiveWeekOrNull() == selectedWeek }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    ArchiveSectionLabel("Period", topPadding = 0.dp)
                    Text(
                        "Archives grow over time",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(ArchiveGranularity.entries) { g ->
                        PeriodChip(selected = granularity == g, onClick = { granularity = g }, label = g.label)
                    }
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    items(availableYears) { year ->
                        PeriodChip(selected = selectedYear == year, onClick = { selectedYear = year }, label = year.toString())
                    }
                }
                if (granularity == ArchiveGranularity.QUARTER) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                        items((1..4).toList()) { q ->
                            PeriodChip(selected = selectedQuarter == q, onClick = { selectedQuarter = q }, label = "Q$q")
                        }
                    }
                }
                if (granularity == ArchiveGranularity.MONTH) {
                    val monthListState = remember { androidx.compose.foundation.lazy.LazyListState(firstVisibleItemIndex = (selectedMonth - 1).coerceAtLeast(0)) }
                    LazyRow(state = monthListState, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                        items((1..12).toList()) { m ->
                            PeriodChip(selected = selectedMonth == m, onClick = { selectedMonth = m }, label = ARCHIVE_MONTH_LABELS[m - 1])
                        }
                    }
                }
                if (granularity == ArchiveGranularity.WEEK) {
                    val weekIndex = availableWeeks.indexOf(selectedWeek).coerceAtLeast(0)
                    val weekListState = remember(availableWeeks) { androidx.compose.foundation.lazy.LazyListState(firstVisibleItemIndex = weekIndex) }
                    LazyRow(state = weekListState, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                        items(availableWeeks) { w ->
                            PeriodChip(selected = selectedWeek == w, onClick = { selectedWeek = w }, label = "Week $w")
                        }
                    }
                }

                val requestCountSuffix = "${periodRecords.size} request${if (periodRecords.size == 1) "" else "s"}"
                when (granularity) {
                    ArchiveGranularity.QUARTER -> ArchiveBreadcrumb(
                        parts = listOf(selectedYear.toString() to false, "Q$selectedQuarter" to true),
                        suffix = archiveQuarterMonthRange(selectedQuarter)
                    )
                    ArchiveGranularity.MONTH -> ArchiveBreadcrumb(
                        parts = listOf(
                            selectedYear.toString() to false,
                            "Q${(selectedMonth - 1) / 3 + 1}" to false,
                            ARCHIVE_MONTH_LABELS[selectedMonth - 1] to true
                        ),
                        suffix = requestCountSuffix
                    )
                    ArchiveGranularity.WEEK -> ArchiveBreadcrumb(
                        parts = listOf(selectedYear.toString() to false, "Week $selectedWeek" to true),
                        suffix = requestCountSuffix
                    )
                    ArchiveGranularity.YEAR -> ArchiveBreadcrumb(
                        parts = listOf(selectedYear.toString() to true),
                        suffix = requestCountSuffix
                    )
                }
            }
        }

        Box(modifier = Modifier.fillMaxSize().weight(1f)) {
            LeaveRequestList(
                viewModel = viewModel,
                records = periodRecords,
                emptyMessage = "No archived leave requests in this period.",
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
    }
}

private fun archiveQuarterMonthRange(quarter: Int): String {
    val startMonth = (quarter - 1) * 3 + 1
    val endMonth = startMonth + 2
    return "${ARCHIVE_MONTH_LABELS[startMonth - 1]} – ${ARCHIVE_MONTH_LABELS[endMonth - 1]}"
}

@Composable
private fun ArchiveBreadcrumb(parts: List<Pair<String, Boolean>>, suffix: String? = null) {
    Row(modifier = Modifier.padding(top = 10.dp, bottom = 2.dp)) {
        parts.forEachIndexed { index, (label, isCurrent) ->
            if (index > 0) {
                Text(" › ", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                label,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                color = if (isCurrent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (suffix != null) {
            Text(" · $suffix", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun ArchiveSectionLabel(text: String, topPadding: Dp = 0.dp) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = topPadding, bottom = 8.dp)
    )
}
