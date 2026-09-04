package com.techew.leaveapprovals.ui.summary

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.techew.leaveapprovals.data.AllowlistEntry
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.data.LeaveType
import com.techew.leaveapprovals.data.UninformedLeave
import com.techew.leaveapprovals.ui.charts.MonthlyTrendChart
import com.techew.leaveapprovals.ui.common.Avatar
import com.techew.leaveapprovals.ui.requests.durationColors
import com.techew.leaveapprovals.ui.theme.StatusApproved
import com.techew.leaveapprovals.ui.theme.StatusApprovedBg
import com.techew.leaveapprovals.ui.theme.StatusRejected
import com.techew.leaveapprovals.ui.theme.StatusRejectedBg
import com.techew.leaveapprovals.ui.theme.StatusRequested
import com.techew.leaveapprovals.ui.theme.StatusRequestedBg
import java.time.Instant
import java.time.ZoneId
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

private val MONTH_LABELS = (1..12).map {
    java.time.Month.of(it).getDisplayName(TextStyle.SHORT, Locale.getDefault())
}

private fun LeaveRequest.dateOrNull(): java.time.ZonedDateTime? =
    runCatching { Instant.parse(requestedAt).atZone(ZoneId.systemDefault()) }.getOrNull()

private fun LeaveRequest.isoWeekOrNull(): Int? =
    dateOrNull()?.toLocalDate()?.get(WeekFields.ISO.weekOfWeekBasedYear())

// Uninformed-leave reports live in their own collection (not leaveRequests
// until resolved), scoped by their own `date` field - same "when did this
// actually happen" grain as LeaveRequest.dateOrNull() above.
private fun UninformedLeave.dateOrNull(): java.time.ZonedDateTime? =
    runCatching { Instant.parse(date).atZone(ZoneId.systemDefault()) }.getOrNull()

private fun UninformedLeave.isoWeekOrNull(): Int? =
    dateOrNull()?.toLocalDate()?.get(WeekFields.ISO.weekOfWeekBasedYear())

private enum class Granularity(val label: String) { YEAR("Year"), QUARTER("Quarter"), MONTH("Month"), WEEK("Week") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveSummaryScreen(viewModel: LeaveSummaryViewModel) {
    val records by viewModel.records.collectAsState()
    val roster by viewModel.roster.collectAsState()
    val uninformedLeaves by viewModel.uninformedLeaves.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    var selectedEmails by remember { mutableStateOf<Set<String>>(emptySet()) } // empty = All developers
    var selectedYear by remember { mutableStateOf(java.time.Year.now().value) }
    var granularity by remember { mutableStateOf(Granularity.YEAR) }
    var selectedQuarter by remember { mutableStateOf(((java.time.MonthDay.now().monthValue - 1) / 3) + 1) }
    var selectedMonth by remember { mutableStateOf(java.time.MonthDay.now().monthValue) }
    var selectedWeek by remember { mutableStateOf(java.time.LocalDate.now().get(WeekFields.ISO.weekOfWeekBasedYear())) }

    val scopedRecords = remember(records, selectedEmails) {
        if (selectedEmails.isEmpty()) records else records.filter { it.email in selectedEmails }
    }

    val availableYears = remember(scopedRecords) {
        val years = scopedRecords.mapNotNull { it.dateOrNull()?.year }.toMutableSet()
        years.add(java.time.Year.now().value)
        years.sortedDescending()
    }
    LaunchedEffect(availableYears) {
        if (selectedYear !in availableYears) selectedYear = availableYears.first()
    }

    val yearRecords = remember(scopedRecords, selectedYear) {
        scopedRecords.filter { it.dateOrNull()?.year == selectedYear }
    }

    // The records actually driving the KPI tiles - narrows further as the
    // manager drills from Year down to Quarter/Month/Week.
    val finalRecords = remember(yearRecords, granularity, selectedQuarter, selectedMonth, selectedWeek) {
        when (granularity) {
            Granularity.YEAR -> yearRecords
            Granularity.QUARTER -> yearRecords.filter { r ->
                val m = r.dateOrNull()?.monthValue ?: return@filter false
                (m - 1) / 3 + 1 == selectedQuarter
            }
            Granularity.MONTH -> yearRecords.filter { it.dateOrNull()?.monthValue == selectedMonth }
            Granularity.WEEK -> yearRecords.filter { it.isoWeekOrNull() == selectedWeek }
        }
    }

    val availableWeeks = remember(yearRecords) {
        val weeks = yearRecords.mapNotNull { it.isoWeekOrNull() }.toMutableSet()
        weeks.add(java.time.LocalDate.now().get(WeekFields.ISO.weekOfWeekBasedYear()))
        weeks.sorted()
    }

    // Same developer/year/quarter/month/week scoping chain as finalRecords
    // above, applied to uninformedLeaves instead - counts every report
    // (reported and resolved both) in scope, since the "Uninformed Leave"
    // bar is meant to answer "how many days did this happen", not "how many
    // have been dealt with".
    val scopedUninformed = remember(uninformedLeaves, selectedEmails) {
        if (selectedEmails.isEmpty()) uninformedLeaves else uninformedLeaves.filter { it.email in selectedEmails }
    }
    val yearUninformed = remember(scopedUninformed, selectedYear) {
        scopedUninformed.filter { it.dateOrNull()?.year == selectedYear }
    }
    val finalUninformed = remember(yearUninformed, granularity, selectedQuarter, selectedMonth, selectedWeek) {
        when (granularity) {
            Granularity.YEAR -> yearUninformed
            Granularity.QUARTER -> yearUninformed.filter { r ->
                val m = r.dateOrNull()?.monthValue ?: return@filter false
                (m - 1) / 3 + 1 == selectedQuarter
            }
            Granularity.MONTH -> yearUninformed.filter { it.dateOrNull()?.monthValue == selectedMonth }
            Granularity.WEEK -> yearUninformed.filter { it.isoWeekOrNull() == selectedWeek }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when {
            isLoading && records.isEmpty() -> {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            }
            records.isEmpty() -> {
                Text(
                    errorMessage ?: "No leave activity yet.",
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            else -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp)
                    ) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        SectionLabel("Developers", topPadding = 0.dp)
                        DeveloperFilterDropdown(
                            roster = roster,
                            selectedEmails = selectedEmails,
                            onSelectionChange = { selectedEmails = it }
                        )

                        SectionLabel("Period", topPadding = 20.dp)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(Granularity.entries) { g ->
                                FilterChip(
                                    selected = granularity == g,
                                    onClick = { granularity = g },
                                    label = { Text(g.label) }
                                )
                            }
                        }
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                            items(availableYears) { year ->
                                FilterChip(
                                    selected = selectedYear == year,
                                    onClick = { selectedYear = year },
                                    label = { Text(year.toString()) }
                                )
                            }
                        }
                        if (granularity == Granularity.QUARTER) {
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                                items((1..4).toList()) { q ->
                                    FilterChip(
                                        selected = selectedQuarter == q,
                                        onClick = { selectedQuarter = q },
                                        label = { Text("Q$q") }
                                    )
                                }
                            }
                        }
                        if (granularity == Granularity.MONTH) {
                            val monthListState = remember { androidx.compose.foundation.lazy.LazyListState(firstVisibleItemIndex = (selectedMonth - 1).coerceAtLeast(0)) }
                            LazyRow(state = monthListState, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                                items((1..12).toList()) { m ->
                                    FilterChip(
                                        selected = selectedMonth == m,
                                        onClick = { selectedMonth = m },
                                        label = { Text(MONTH_LABELS[m - 1]) }
                                    )
                                }
                            }
                        }
                        if (granularity == Granularity.WEEK) {
                            val weekIndex = availableWeeks.indexOf(selectedWeek).coerceAtLeast(0)
                            val weekListState = remember(availableWeeks) { androidx.compose.foundation.lazy.LazyListState(firstVisibleItemIndex = weekIndex) }
                            LazyRow(state = weekListState, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                                items(availableWeeks) { w ->
                                    FilterChip(
                                        selected = selectedWeek == w,
                                        onClick = { selectedWeek = w },
                                        label = { Text("Week $w") }
                                    )
                                }
                            }
                        }
                    }
                    }

                        // Drill-down breadcrumb - only meaningful once the manager
                        // has actually narrowed past Year, mirroring the mockup's
                        // "2026 › Q3 · Jul – Sep" / "2026 › Q3 › Sep · N requests".
                        if (granularity == Granularity.QUARTER) {
                            Breadcrumb(
                                parts = listOf(selectedYear.toString() to false, "Q$selectedQuarter" to true),
                                suffix = quarterMonthRange(selectedQuarter)
                            )
                        }
                        if (granularity == Granularity.MONTH) {
                            Breadcrumb(
                                parts = listOf(
                                    selectedYear.toString() to false,
                                    "Q${(selectedMonth - 1) / 3 + 1}" to false,
                                    MONTH_LABELS[selectedMonth - 1] to true
                                ),
                                suffix = "${finalRecords.size} request${if (finalRecords.size == 1) "" else "s"}"
                            )
                        }

                        SectionLabel("Activity", topPadding = 20.dp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            KpiTile("Total", finalRecords.size.toString(), Modifier.weight(1f))
                            KpiTile(
                                "Approved", finalRecords.count { it.status == "approved" }.toString(),
                                Modifier.weight(1f), StatusApproved, StatusApprovedBg
                            )
                            KpiTile(
                                "Rejected", finalRecords.count { it.status == "rejected" }.toString(),
                                Modifier.weight(1f), StatusRejected, StatusRejectedBg
                            )
                            KpiTile(
                                "Pending", finalRecords.count { it.status == "requested" }.toString(),
                                Modifier.weight(1f), StatusRequested, StatusRequestedBg
                            )
                        }

                        SectionLabel("By leave type", topPadding = 20.dp)
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                                // Uninformed Leave's count comes from the separate
                                // uninformedLeaves collection (see finalUninformed
                                // above), not from finalRecords like every other type.
                                val typeCounts = remember(finalRecords, finalUninformed) {
                                    LeaveType.ALL.associateWith { t ->
                                        if (t == LeaveType.UNINFORMED_ABSENCE) finalUninformed.size else finalRecords.count { it.type == t }
                                    }
                                }
                                val maxTypeCount = (typeCounts.values.maxOrNull() ?: 0).coerceAtLeast(1)
                                LeaveType.ALL.forEachIndexed { index, type ->
                                    if (index > 0) Box(Modifier.height(10.dp))
                                    val count = typeCounts[type] ?: 0
                                    val (barColor, _) = durationColors(type)
                                    TypeBarRow(LeaveType.label(type), count, maxTypeCount, barColor)
                                }
                            }
                        }

                        if (granularity == Granularity.YEAR || granularity == Granularity.QUARTER) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                SectionLabel("By quarter & month", topPadding = 0.dp)
                            }

                            val quarterCounts = remember(yearRecords) {
                                IntArray(4).also { arr ->
                                    yearRecords.forEach { r ->
                                        val month = r.dateOrNull()?.monthValue ?: return@forEach
                                        arr[(month - 1) / 3]++
                                    }
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                quarterCounts.forEachIndexed { index, count ->
                                    QuarterTile(
                                        label = "Q${index + 1}",
                                        count = count,
                                        selected = granularity == Granularity.QUARTER && selectedQuarter == index + 1,
                                        modifier = Modifier.weight(1f),
                                        onClick = {
                                            granularity = Granularity.QUARTER
                                            selectedQuarter = index + 1
                                        }
                                    )
                                }
                            }

                            val monthlyValues = remember(yearRecords) {
                                IntArray(12).also { arr ->
                                    yearRecords.forEach { r ->
                                        val month = r.dateOrNull()?.monthValue ?: return@forEach
                                        arr[month - 1]++
                                    }
                                }.toList()
                            }
                            Card(
                                modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    MonthlyTrendChart(values = monthlyValues, labels = MONTH_LABELS)
                                    val peakCount = monthlyValues.maxOrNull() ?: 0
                                    if (peakCount > 0) {
                                        val peakMonth = MONTH_LABELS[monthlyValues.indexOf(peakCount)]
                                        Text(
                                            "Busiest month: $peakMonth · $peakCount request${if (peakCount == 1) "" else "s"}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.padding(top = 10.dp)
                                        )
                                    }
                                }
                            }
                        }

                        if (granularity == Granularity.MONTH) {
                            val monthWeeks = remember(selectedYear, selectedMonth) {
                                val firstDay = java.time.LocalDate.of(selectedYear, selectedMonth, 1)
                                val lastDay = firstDay.withDayOfMonth(firstDay.lengthOfMonth())
                                val weeks = mutableListOf<Int>()
                                var d = firstDay
                                while (!d.isAfter(lastDay)) {
                                    val w = d.get(WeekFields.ISO.weekOfWeekBasedYear())
                                    if (weeks.isEmpty() || weeks.last() != w) weeks.add(w)
                                    d = d.plusDays(1)
                                }
                                weeks
                            }
                            val weekCounts = remember(finalRecords, monthWeeks) {
                                monthWeeks.associateWith { w -> finalRecords.count { it.isoWeekOrNull() == w } }
                            }

                            SectionLabel("By week", topPadding = 20.dp)
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    weekCounts.toSortedMap().forEach { (week, count) ->
                                        WeekTile("W$week", count, Modifier.weight(1f))
                                    }
                                }
                            }

                            val leaderboard = remember(finalRecords) {
                                finalRecords.groupBy { it.email }
                                    .map { (email, list) ->
                                        Triple(list.firstOrNull { it.name.isNotBlank() }?.name ?: email, email, list.size)
                                    }
                                    .sortedByDescending { it.third }
                                    .take(5)
                            }

                            SectionLabel("Most requests", topPadding = 20.dp)
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                            ) {
                                Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                                    if (leaderboard.isEmpty()) {
                                        Text(
                                            "No requests in this period.",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.padding(vertical = 12.dp)
                                        )
                                    } else {
                                        leaderboard.forEach { (name, email, count) ->
                                            Row(
                                                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Avatar(name = name, email = email, size = 28.dp)
                                                Text(
                                                    name,
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    modifier = Modifier.weight(1f).padding(start = 10.dp)
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
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
    }
}

private fun quarterMonthRange(quarter: Int): String {
    val startMonth = (quarter - 1) * 3 + 1
    val endMonth = startMonth + 2
    return "${MONTH_LABELS[startMonth - 1]} – ${MONTH_LABELS[endMonth - 1]}"
}

@Composable
private fun Breadcrumb(parts: List<Pair<String, Boolean>>, suffix: String? = null) {
    Row(modifier = Modifier.padding(top = 10.dp, bottom = 2.dp)) {
        parts.forEachIndexed { index, (label, isCurrent) ->
            if (index > 0) {
                Text(" › ", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                label,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = if (isCurrent) androidx.compose.ui.text.font.FontWeight.Bold else androidx.compose.ui.text.font.FontWeight.Normal,
                color = if (isCurrent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (suffix != null) {
            Text(" · $suffix", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun WeekTile(label: String, count: Int, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            count.toString(),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            color = if (count == 0) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 2.dp)
        )
    }
}

@Composable
private fun SectionLabel(text: String, topPadding: androidx.compose.ui.unit.Dp = 0.dp) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = topPadding, bottom = 8.dp)
    )
}

// Multi-select "Developers" filter, redesigned from a horizontally-scrolling
// row of one-chip-per-developer (which clipped/overflowed once the roster
// grew past 2-3 names) into a single compact dropdown. Unlike the single-
// select status/type dropdowns elsewhere, this one stays open across taps -
// only "All developers" or dismissing it closes the menu - since picking
// several developers to compare at once is the whole point of multi-select.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeveloperFilterDropdown(
    roster: List<AllowlistEntry>,
    selectedEmails: Set<String>,
    onSelectionChange: (Set<String>) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val sortedRoster = remember(roster) { roster.sortedBy { it.name.ifBlank { it.email } } }
    val label = when {
        selectedEmails.isEmpty() -> "All developers"
        selectedEmails.size == 1 -> {
            val email = selectedEmails.first()
            sortedRoster.find { it.email == email }?.name?.ifBlank { email } ?: email
        }
        else -> "${selectedEmails.size} developers"
    }

    Box {
        OutlinedButton(
            onClick = { expanded = true },
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                label, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f)
            )
            Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, modifier = Modifier.size(18.dp))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("All developers") },
                trailingIcon = { if (selectedEmails.isEmpty()) Icon(Icons.Filled.Check, contentDescription = null) },
                onClick = {
                    onSelectionChange(emptySet())
                    expanded = false
                }
            )
            HorizontalDivider()
            sortedRoster.forEach { entry ->
                val isSelected = entry.email in selectedEmails
                DropdownMenuItem(
                    text = { Text(entry.name.ifBlank { entry.email }) },
                    trailingIcon = { if (isSelected) Icon(Icons.Filled.Check, contentDescription = null) },
                    onClick = {
                        onSelectionChange(if (isSelected) selectedEmails - entry.email else selectedEmails + entry.email)
                    }
                )
            }
        }
    }
}

@Composable
private fun KpiTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    valueColor: Color? = null,
    containerColor: Color? = null
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = containerColor ?: MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp)) {
            Text(
                label.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = valueColor ?: MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1
            )
            Text(
                value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                color = valueColor ?: MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 2.dp)
            )
        }
    }
}

@Composable
private fun TypeBarRow(label: String, count: Int, maxCount: Int, barColor: Color) {
    val fraction = if (maxCount == 0) 0f else count.toFloat() / maxCount.toFloat()
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(90.dp)
        )
        Box(
            modifier = Modifier
                .weight(1f)
                .height(8.dp)
                .clip(RoundedCornerShape(50))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            if (fraction > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(fraction)
                        .height(8.dp)
                        .clip(RoundedCornerShape(50))
                        .background(barColor)
                )
            }
        }
        Text(
            count.toString(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            color = if (count == 0) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.width(28.dp).padding(start = 6.dp)
        )
    }
}

@Composable
private fun QuarterTile(
    label: String,
    count: Int,
    selected: Boolean = false,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    val containerColor = when {
        selected -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    val contentColor = when {
        selected -> MaterialTheme.colorScheme.onPrimaryContainer
        count == 0 -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(containerColor)
            .then(
                if (selected) Modifier.border(1.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(10.dp))
                else Modifier
            )
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = contentColor, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
            Text(
                count.toString(),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 2.dp)
            )
        }
    }
}
