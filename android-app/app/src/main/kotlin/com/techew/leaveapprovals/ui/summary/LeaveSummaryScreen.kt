package com.techew.leaveapprovals.ui.summary

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.unit.dp
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.data.LeaveType
import com.techew.leaveapprovals.ui.charts.MonthlyTrendChart
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

private enum class Granularity(val label: String) { YEAR("Year"), QUARTER("Quarter"), MONTH("Month"), WEEK("Week") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveSummaryScreen(viewModel: LeaveSummaryViewModel) {
    val records by viewModel.records.collectAsState()
    val roster by viewModel.roster.collectAsState()
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
                        SectionLabel("Developers")
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            item {
                                FilterChip(
                                    selected = selectedEmails.isEmpty(),
                                    onClick = { selectedEmails = emptySet() },
                                    label = { Text("All developers") }
                                )
                            }
                            items(roster.sortedBy { it.name }) { entry ->
                                FilterChip(
                                    selected = entry.email in selectedEmails,
                                    onClick = {
                                        selectedEmails = if (entry.email in selectedEmails) {
                                            selectedEmails - entry.email
                                        } else {
                                            selectedEmails + entry.email
                                        }
                                    },
                                    label = { Text(entry.name.ifBlank { entry.email }) }
                                )
                            }
                        }

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

                        SectionLabel("Activity", topPadding = 20.dp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            KpiTile("Total", finalRecords.size.toString(), Modifier.weight(1f))
                            KpiTile("Approved", finalRecords.count { it.status == "approved" }.toString(), Modifier.weight(1f))
                            KpiTile("Rejected", finalRecords.count { it.status == "rejected" }.toString(), Modifier.weight(1f))
                            KpiTile("Pending", finalRecords.count { it.status == "requested" }.toString(), Modifier.weight(1f))
                        }

                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(top = 8.dp)
                        ) {
                            items(LeaveType.ALL) { type ->
                                KpiTile(
                                    LeaveType.label(type),
                                    finalRecords.count { it.type == type }.toString(),
                                    Modifier.width(110.dp)
                                )
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
                                    QuarterTile("Q${index + 1}", count, Modifier.weight(1f))
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
                    }
                }
            }
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

@Composable
private fun KpiTile(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp)) {
            Text(
                label.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1
            )
            Text(
                value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                modifier = Modifier.padding(top = 2.dp)
            )
        }
    }
}

@Composable
private fun QuarterTile(label: String, count: Int, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
            Text(count.toString(), style = MaterialTheme.typography.titleSmall, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, modifier = Modifier.padding(top = 2.dp))
        }
    }
}
