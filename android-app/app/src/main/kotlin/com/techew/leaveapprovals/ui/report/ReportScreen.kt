package com.techew.leaveapprovals.ui.report

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.techew.leaveapprovals.data.AllowlistEntry
import com.techew.leaveapprovals.data.UninformedLeave
import com.techew.leaveapprovals.ui.common.DeveloperPickerDropdown
import com.techew.leaveapprovals.ui.common.EditableDateField
import com.techew.leaveapprovals.ui.common.HtmlText
import com.techew.leaveapprovals.ui.common.RichTextEditor
import com.techew.leaveapprovals.ui.common.rememberRichTextState
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val DATE_FORMATTER = DateTimeFormatter.ofPattern("d MMM yyyy")

private fun String.toFriendlyDate(): String =
    runCatching { Instant.parse(this).atZone(ZoneId.systemDefault()).format(DATE_FORMATTER) }.getOrDefault("-")

/**
 * Manager-only screen: file a report against a developer who was absent
 * without ever applying for leave, and work through resolving them (either
 * waiting for the developer's own explanation via the emailed link/My
 * Leaves banner on web, or resolving directly here). Resolving hands off to
 * push-daemon, which creates the actual approved leaveRequests doc.
 */
@Composable
fun ReportScreen(viewModel: ReportViewModel) {
    val roster by viewModel.roster.collectAsState()
    val openReports by viewModel.openReports.collectAsState()
    val resolvedReports by viewModel.resolvedReports.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isSubmitting by viewModel.isSubmitting.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    var showNewReportForm by remember { mutableStateOf(false) }
    var resolvingReportId by remember { mutableStateOf<String?>(null) }

    Box(modifier = Modifier.fillMaxSize()) {
        if (isLoading && openReports.isEmpty() && resolvedReports.isEmpty()) {
            CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "Report", style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)
                    )
                    Button(onClick = { showNewReportForm = !showNewReportForm }) {
                        Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                        Text("New report", modifier = Modifier.padding(start = 6.dp))
                    }
                }

                if (errorMessage != null) {
                    Text(
                        errorMessage ?: "",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                if (showNewReportForm) {
                    NewReportCard(
                        roster = roster,
                        isSubmitting = isSubmitting,
                        onSubmit = { email, name, dateMillis, html ->
                            viewModel.report(email, name, dateMillis, html) { success ->
                                if (success) showNewReportForm = false
                            }
                        },
                        onCancel = { showNewReportForm = false }
                    )
                }

                if (openReports.isEmpty()) {
                    Text(
                        "No open reports.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                } else {
                    openReports.forEach { report ->
                        OpenReportCard(
                            report = report,
                            isResolving = resolvingReportId == report.reportId,
                            isSubmitting = isSubmitting,
                            onStartResolve = { resolvingReportId = report.reportId },
                            onCancelResolve = { resolvingReportId = null },
                            onSubmitResolve = { html ->
                                viewModel.resolve(report.reportId, html) { success ->
                                    if (success) resolvingReportId = null
                                }
                            }
                        )
                    }
                }

                Text(
                    "Resolutions", style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 24.dp, bottom = 4.dp)
                )
                if (resolvedReports.isEmpty()) {
                    Text(
                        "Nothing resolved yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    resolvedReports.forEach { ResolvedReportCard(it) }
                }
            }
        }
    }
}

@Composable
private fun NewReportCard(
    roster: List<AllowlistEntry>,
    isSubmitting: Boolean,
    onSubmit: (email: String, name: String, dateMillis: Long, reasonHtml: String) -> Unit,
    onCancel: () -> Unit
) {
    var selectedEmail by remember { mutableStateOf<String?>(null) }
    var selectedName by remember { mutableStateOf("") }
    var dateMillis by remember { mutableStateOf(System.currentTimeMillis()) }
    val reasonState = rememberRichTextState()

    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            DeveloperPickerDropdown(
                roster = roster,
                selectedEmail = selectedEmail,
                onSelect = { selectedEmail = it.email; selectedName = it.name },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(10.dp))
            EditableDateField(dateMillis = dateMillis, onDateChange = { dateMillis = it })
            Spacer(modifier = Modifier.height(14.dp))
            Text("Reason", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(4.dp))
            RichTextEditor(state = reasonState, placeholder = "Why is this being flagged?")
            Spacer(modifier = Modifier.height(14.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onCancel) { Text("Cancel") }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    enabled = selectedEmail != null && !reasonState.isBlank && !isSubmitting,
                    onClick = { onSubmit(selectedEmail!!, selectedName, dateMillis, reasonState.html) }
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Submit")
                    }
                }
            }
        }
    }
}

@Composable
private fun OpenReportCard(
    report: UninformedLeave,
    isResolving: Boolean,
    isSubmitting: Boolean,
    onStartResolve: () -> Unit,
    onCancelResolve: () -> Unit,
    onSubmitResolve: (String) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(report.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text(report.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(
                    report.date.toFriendlyDate(),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            HtmlText(report.reasonHtml, modifier = Modifier.padding(top = 8.dp))
            Text(
                "Reported by ${report.reportedBy}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 6.dp)
            )

            if (!isResolving) {
                OutlinedButton(onClick = onStartResolve, modifier = Modifier.padding(top = 10.dp)) {
                    Text("Resolve")
                }
            } else {
                val resolutionState = rememberRichTextState()
                Spacer(modifier = Modifier.height(10.dp))
                Text("Resolution", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(4.dp))
                RichTextEditor(state = resolutionState, placeholder = "Explain what happened...")
                Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onCancelResolve) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        enabled = !resolutionState.isBlank && !isSubmitting,
                        onClick = { onSubmitResolve(resolutionState.html) }
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Save resolution")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ResolvedReportCard(report: UninformedLeave) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(report.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text(report.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(
                    "Absence: ${report.date.toFriendlyDate()}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
            Text("Resolved by ${report.resolvedBy}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
            HtmlText(report.resolutionHtml, modifier = Modifier.padding(top = 4.dp))
        }
    }
}
