package com.techew.leaveapprovals.ui.requests

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.text.method.LinkMovementMethod
import android.widget.TextView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.text.HtmlCompat
import com.techew.leaveapprovals.data.Attachment
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.data.LeaveType
import com.techew.leaveapprovals.ui.common.Avatar
import com.techew.leaveapprovals.ui.theme.StatusApproved
import com.techew.leaveapprovals.ui.theme.StatusRejected
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * Full-detail view for one leave request, opened from its card's "View
 * details" button. Three fixed regions so a long reason can never push the
 * header or the decision controls out of reach:
 *  - a pinned header (identity, status, type/duration/week chips, a 2x2
 *    facts grid)
 *  - a middle region holding only the reason + attachments, which scrolls on
 *    its own (long reasons collapse behind a fade + "Read full reason")
 *  - a pinned footer (resolved verdict + optional decision note, or the
 *    Approve/Reject controls with their own optional note step)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequestDetailSheet(
    request: LeaveRequest,
    sheetState: SheetState,
    isDeciding: Boolean,
    onDismiss: () -> Unit,
    onDecide: (decision: String, note: String?) -> Unit
) {
    val context = LocalContext.current

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp)
        ) {
            DetailHeader(request)

            HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp))

            // The only part of the sheet that scrolls - identity, chips,
            // facts and the decision controls all stay put.
            Column(
                modifier = Modifier
                    .weight(weight = 1f, fill = false)
                    .verticalScroll(rememberScrollState())
            ) {
                ReasonAndAttachments(request, context)
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp))

            DetailFooter(request = request, isDeciding = isDeciding, onDecide = onDecide)
        }
    }
}

@Composable
private fun DetailHeader(request: LeaveRequest) {
    val (statusColor, statusBg) = statusColors(request.status)

    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Avatar(name = request.name, email = request.email, size = 44.dp)
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(request.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(
                request.email,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(modifier = Modifier.width(8.dp))
        StatusBadge(label = request.status.uppercase(), color = statusColor, background = statusBg)
    }

    Row(
        modifier = Modifier.padding(top = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        MetaChip(LeaveType.familyLabel(request.type), kind = ChipKind.TYPE, type = request.type)
        MetaChip(LeaveType.durationLabel(request.type), kind = ChipKind.DURATION, type = request.type)
        MetaChip(request.weekLabel, kind = ChipKind.META)
    }

    val showDecidedIn = (request.status == "approved" || request.status == "rejected") && request.resolvedAt.isNotBlank()
    val fourthLabel = if (showDecidedIn) "DECIDED IN" else "ATTACHMENTS"
    val fourthValue = if (showDecidedIn) {
        decidedIn(request.requestedAt, request.resolvedAt) ?: "—"
    } else {
        "${request.attachments.size} file${if (request.attachments.size == 1) "" else "s"}"
    }

    FactsGrid(
        listOf(
            "LEAVE DATE" to leaveDateLabel(request),
            "DURATION" to durationFact(request),
            "APPLIED" to appliedLabel(request.requestedAt),
            fourthLabel to fourthValue
        )
    )
}

@Composable
private fun FactsGrid(facts: List<Pair<String, String>>) {
    Column(modifier = Modifier.padding(top = 12.dp)) {
        facts.chunked(2).forEach { row ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (label, value) -> FactTile(label, value, Modifier.weight(1f)) }
                if (row.size == 1) Spacer(modifier = Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun FactTile(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp)
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            fontSize = 9.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 3.dp))
    }
}

@Composable
private fun ReasonAndAttachments(request: LeaveRequest, context: android.content.Context) {
    val plainReason = remember(request.reasonHtml) {
        HtmlCompat.fromHtml(
            request.reasonHtml.ifBlank { "No reason provided." },
            HtmlCompat.FROM_HTML_MODE_COMPACT
        ).toString().trim()
    }
    // No real on-screen-overflow measurement against the TextView (would
    // need a post-layout callback bridging AndroidView back into Compose
    // state) - a plain-text length heuristic is enough to decide whether a
    // reason is worth collapsing behind "Read full reason".
    val isLong = plainReason.length > 320
    var expanded by remember(request.requestId) { mutableStateOf(!isLong) }

    Text(
        "REASON",
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )

    Box(modifier = Modifier.padding(top = 6.dp)) {
        AndroidView(
            modifier = Modifier
                .fillMaxWidth()
                .let { if (isLong && !expanded) it.heightIn(max = 220.dp).clipToBounds() else it },
            factory = { ctx ->
                TextView(ctx).apply { movementMethod = LinkMovementMethod.getInstance() }
            },
            update = { textView ->
                val html = request.reasonHtml.ifBlank { "<i>No reason provided.</i>" }
                // LEGACY mode (vs COMPACT) keeps real paragraph/list spacing
                // from the web editor's contenteditable output instead of
                // collapsing it into one dense run of text.
                textView.text = HtmlCompat.fromHtml(html, HtmlCompat.FROM_HTML_MODE_LEGACY)
            }
        )
        if (isLong && !expanded) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(56.dp)
                    .background(Brush.verticalGradient(listOf(Color.Transparent, MaterialTheme.colorScheme.surface)))
            )
        }
    }

    if (isLong && !expanded) {
        Box(modifier = Modifier.fillMaxWidth().padding(top = 4.dp), contentAlignment = Alignment.Center) {
            OutlinedButton(onClick = { expanded = true }) { Text("Read full reason") }
        }
    }

    if (request.attachments.isNotEmpty()) {
        Text(
            "ATTACHMENTS",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 18.dp)
        )
    }
    request.attachments.forEach { attachment: Attachment ->
        OutlinedButton(
            onClick = { openAttachment(context, attachment.url) },
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
        ) {
            Icon(Icons.Outlined.AttachFile, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
            Text(attachment.name.ifBlank { "Open attachment" })
        }
    }
}

@Composable
private fun DetailFooter(
    request: LeaveRequest,
    isDeciding: Boolean,
    onDecide: (decision: String, note: String?) -> Unit
) {
    if (request.status != "requested") {
        ResolvedPanel(request)
        return
    }

    if (isDeciding) {
        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.Center) {
            CircularProgressIndicator()
        }
        return
    }

    var pendingDecision by remember(request.requestId) { mutableStateOf<String?>(null) }
    var noteText by remember(request.requestId) { mutableStateOf("") }
    val decision = pendingDecision

    if (decision == null) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = { pendingDecision = "approved" },
                colors = ButtonDefaults.buttonColors(containerColor = StatusApproved),
                modifier = Modifier.weight(1f)
            ) { Text("Approve") }
            Button(
                onClick = { pendingDecision = "rejected" },
                colors = ButtonDefaults.buttonColors(containerColor = StatusRejected),
                modifier = Modifier.weight(1f)
            ) { Text("Reject") }
        }
    } else {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                if (decision == "approved") "Add a note with this approval (optional)" else "Add a note with this rejection (optional)",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedTextField(
                value = noteText,
                onValueChange = { noteText = it },
                placeholder = { Text("Optional note…") },
                minLines = 2,
                maxLines = 4,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp)
            )
            Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = { pendingDecision = null; noteText = "" },
                    modifier = Modifier.weight(1f)
                ) { Text("Cancel") }
                Button(
                    onClick = { onDecide(decision, noteText.trim().ifBlank { null }) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (decision == "approved") StatusApproved else StatusRejected
                    ),
                    modifier = Modifier.weight(1f)
                ) { Text(if (decision == "approved") "Confirm approve" else "Confirm reject") }
            }
        }
    }
}

@Composable
private fun ResolvedPanel(request: LeaveRequest) {
    val (color, background) = statusColors(request.status)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(background)
            .padding(12.dp)
    ) {
        Text(
            buildAnnotatedString {
                when (request.status) {
                    "approved" -> {
                        append("Approved by ")
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(request.resolvedBy) }
                    }
                    "rejected" -> {
                        append("Rejected by ")
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(request.resolvedBy) }
                    }
                    "withdrawn" -> append("Withdrawn by requester")
                    else -> append(request.status.replaceFirstChar { it.uppercase() })
                }
            },
            style = MaterialTheme.typography.bodyMedium,
            color = color
        )
        if (request.decisionNote.isNotBlank()) {
            Text(
                request.decisionNote,
                style = MaterialTheme.typography.bodySmall,
                color = color,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

private val LEAVE_DATE_FORMATTER = DateTimeFormatter.ofPattern("EEE d MMM yyyy")
private val SHORT_DATE_FORMATTER = DateTimeFormatter.ofPattern("d MMM")
private val APPLIED_DATE_FORMATTER = DateTimeFormatter.ofPattern("d MMM")
private val APPLIED_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm")

private fun String.toLocalDateOrNull(): LocalDate? =
    if (isBlank()) null else runCatching { Instant.parse(this).atZone(ZoneId.systemDefault()).toLocalDate() }.getOrNull()

internal fun leaveDateLabel(request: LeaveRequest): String {
    val start = request.startDate.toLocalDateOrNull()
    val end = request.endDate.toLocalDateOrNull()
    return when {
        start != null && end != null && start == end -> start.format(LEAVE_DATE_FORMATTER)
        start != null && end != null -> "${start.format(SHORT_DATE_FORMATTER)} – ${end.format(LEAVE_DATE_FORMATTER)}"
        start != null -> start.format(LEAVE_DATE_FORMATTER)
        else -> request.weekLabel.ifBlank { "—" }
    }
}

internal fun durationFact(request: LeaveRequest): String = when {
    LeaveType.isShort(request.type) ->
        if (request.halfDayPeriod.isNotBlank()) "Half day · ${request.halfDayPeriod}" else "Half day"
    LeaveType.normalize(request.type) == LeaveType.CASUAL_FULL -> "Full day"
    else -> {
        val start = request.startDate.toLocalDateOrNull()
        val end = request.endDate.toLocalDateOrNull()
        if (start != null && end != null) {
            val days = ChronoUnit.DAYS.between(start, end) + 1
            if (days > 0) "$days day${if (days == 1L) "" else "s"}" else "Full leave"
        } else {
            "Full leave"
        }
    }
}

internal fun appliedLabel(requestedAt: String): String {
    if (requestedAt.isBlank()) return "—"
    return runCatching {
        val zdt = Instant.parse(requestedAt).atZone(ZoneId.systemDefault())
        "${zdt.format(APPLIED_DATE_FORMATTER)} · ${zdt.format(APPLIED_TIME_FORMATTER)}"
    }.getOrDefault("—")
}

/** e.g. "4 hours", "2 days" - how long the decision took after submission. */
internal fun decidedIn(requestedAt: String, resolvedAt: String): String? {
    val start = runCatching { Instant.parse(requestedAt) }.getOrNull() ?: return null
    val end = runCatching { Instant.parse(resolvedAt) }.getOrNull() ?: return null
    val duration = Duration.between(start, end)
    if (duration.isNegative) return null
    val minutes = duration.toMinutes()
    return when {
        minutes < 1 -> "less than a minute"
        minutes < 60 -> "$minutes minute${if (minutes == 1L) "" else "s"}"
        minutes < 60 * 24 -> {
            val hours = duration.toHours()
            "$hours hour${if (hours == 1L) "" else "s"}"
        }
        else -> {
            val days = duration.toDays()
            "$days day${if (days == 1L) "" else "s"}"
        }
    }
}

/**
 * Opens the attachment's Drive link directly, with no forced mime type.
 *
 * Drive attachments are uploaded via the API but a viewer's Drive account
 * may auto-convert Office files (.doc/.docx/etc.) to native Google Docs on
 * ingestion, in which case the "attachment" is really a live
 * docs.google.com editor page, not the original file - a real Word/Office
 * viewer has nothing to match there. Forcing a guessed mime type (from the
 * original filename) onto the intent doesn't help either way: it makes
 * Intent.createChooser() look for an app whose intent-filter matches that
 * exact (scheme, mimeType) pair, and if nothing does,
 * createChooser()'s own chooser activity is always resolvable, so
 * startActivity() never throws ActivityNotFoundException - it just shows an
 * empty "no app can perform this action" chooser instead of ever reaching
 * our catch block/fallback. A plain, type-less ACTION_VIEW on the URL lets
 * any browser (or Drive/Docs app, if installed) open it correctly either
 * way, and still lets the OS show its own chooser if more than one app
 * actually matches.
 */
private fun openAttachment(context: android.content.Context, url: String) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    } catch (_: ActivityNotFoundException) {
        // No browser at all - nothing more we can do here.
    }
}
