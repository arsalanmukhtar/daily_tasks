package com.techew.leaveapprovals.ui.requests

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.text.HtmlCompat
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.data.LeaveType
import com.techew.leaveapprovals.data.daysUntilPermanentDeletion
import com.techew.leaveapprovals.ui.common.Avatar
import com.techew.leaveapprovals.ui.common.LeaveDateDialog
import com.techew.leaveapprovals.ui.theme.DurationFull
import com.techew.leaveapprovals.ui.theme.DurationFullBg
import com.techew.leaveapprovals.ui.theme.DurationShort
import com.techew.leaveapprovals.ui.theme.DurationShortBg
import com.techew.leaveapprovals.ui.theme.Meta
import com.techew.leaveapprovals.ui.theme.MetaBg
import com.techew.leaveapprovals.ui.theme.StatusApproved
import com.techew.leaveapprovals.ui.theme.StatusApprovedBg
import com.techew.leaveapprovals.ui.theme.StatusRejected
import com.techew.leaveapprovals.ui.theme.StatusRejectedBg
import com.techew.leaveapprovals.ui.theme.StatusRequested
import com.techew.leaveapprovals.ui.theme.StatusRequestedBg
import com.techew.leaveapprovals.ui.theme.StatusWithdrawn
import com.techew.leaveapprovals.ui.theme.StatusWithdrawnBg
import com.techew.leaveapprovals.ui.theme.TypeCasual
import com.techew.leaveapprovals.ui.theme.TypeCasualBg
import com.techew.leaveapprovals.ui.theme.TypeForeignTrip
import com.techew.leaveapprovals.ui.theme.TypeForeignTripBg
import com.techew.leaveapprovals.ui.theme.TypeMedical
import com.techew.leaveapprovals.ui.theme.TypeMedicalBg
import com.techew.leaveapprovals.ui.theme.TypeUmrah
import com.techew.leaveapprovals.ui.theme.TypeUmrahBg
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Compact summary card for the Requests list. Full formatted description,
 * the attachment, and the Approve/Reject actions all live behind "View
 * details" in [RequestDetailSheet] - the card itself is just enough to scan
 * and decide whether to open one.
 */
@Composable
fun RequestCard(
    request: LeaveRequest,
    onViewDetails: () -> Unit
) {
    val (statusColor, statusBg) = statusColors(request.status)
    val reasonPreview = remember(request.reasonHtml) {
        val plain = HtmlCompat.fromHtml(
            request.reasonHtml.ifBlank { "No reason provided." },
            HtmlCompat.FROM_HTML_MODE_COMPACT
        ).toString().trim()
        plain.ifBlank { "No reason provided." }
    }
    var showDateDialog by remember { mutableStateOf(false) }
    if (showDateDialog) {
        LeaveDateDialog(
            startIso = request.startDate,
            endIso = request.endDate,
            onDismiss = { showDateDialog = false }
        )
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                Avatar(name = request.name, email = request.email)
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        request.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        request.email,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                StatusBadge(label = request.status.uppercase(), color = statusColor, background = statusBg)
            }

            Row(
                modifier = Modifier.padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                MetaChip(LeaveType.familyLabel(request.type), kind = ChipKind.TYPE, type = request.type)
                MetaChip(LeaveType.durationLabel(request.type), kind = ChipKind.DURATION, type = request.type)
                MetaChip(
                    request.weekLabel,
                    kind = ChipKind.META,
                    onClick = if (request.startDate.isNotBlank()) { { showDateDialog = true } } else null
                )
                val time = formatTimeHHmm(request.requestedAt)
                if (time.isNotBlank()) MetaChip(time, kind = ChipKind.META)
            }

            HorizontalDivider(modifier = Modifier.padding(top = 12.dp, bottom = 10.dp))

            Text(
                reasonPreview,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            if (request.status != "requested") {
                Text(
                    resolvedSummaryText(request),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            val daysLeft = request.daysUntilPermanentDeletion()
            if (daysLeft != null) {
                Text(
                    "This withdrawn request will be permanently deleted after $daysLeft" +
                        if (daysLeft == 1L) " day." else " days.",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = StatusRejected,
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .fillMaxWidth()
                        .background(StatusRejectedBg, RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 7.dp)
                )
            }

            OutlinedButton(
                onClick = onViewDetails,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
            ) { Text("View details") }
        }
    }
}

// Shared by the card's plain resolved-by line and could grow further if the
// detail sheet's footer text ever needs the exact same phrasing - kept
// status-exhaustive so a request stuck in an unexpected/withdrawn state
// never falls through to a wrong "Rejected by" label.
internal fun resolvedSummaryText(request: LeaveRequest): String = when (request.status) {
    "approved" -> "Approved by ${request.resolvedBy}"
    "rejected" -> "Rejected by ${request.resolvedBy}"
    "withdrawn" -> "Withdrawn by requester"
    else -> request.status.replaceFirstChar { it.uppercase() }
}

@Composable
internal fun statusColors(status: String): Pair<Color, Color> = when (status) {
    "approved" -> StatusApproved to StatusApprovedBg
    "rejected" -> StatusRejected to StatusRejectedBg
    "withdrawn" -> StatusWithdrawn to StatusWithdrawnBg
    else -> StatusRequested to StatusRequestedBg
}

@Composable
internal fun StatusBadge(label: String, color: Color, background: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(background)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            label,
            color = color,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            maxLines = 1,
            softWrap = false
        )
    }
}

private val TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm")

// Local HH:mm the request was submitted at - shared by RequestCard and
// RequestDetailSheet's chip rows (same package, internal visibility).
internal fun formatTimeHHmm(iso: String): String {
    if (iso.isBlank()) return ""
    return runCatching {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(TIME_FORMATTER)
    }.getOrDefault("")
}

/** Which color pair (and lookup) a [MetaChip] should use. */
internal enum class ChipKind { TYPE, DURATION, META }

@Composable
internal fun MetaChip(
    label: String,
    kind: ChipKind = ChipKind.META,
    type: String = "",
    onClick: (() -> Unit)? = null
) {
    val (color, background) = when (kind) {
        ChipKind.TYPE -> typeColors(type)
        ChipKind.DURATION -> durationColors(type)
        ChipKind.META -> Meta to MetaBg
    }
    var modifier = Modifier.clip(RoundedCornerShape(8.dp))
    if (onClick != null) modifier = modifier.clickable(onClick = onClick)
    modifier = modifier.background(background).padding(horizontal = 10.dp, vertical = 5.dp)
    Box(modifier = modifier) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = color,
            maxLines = 1,
            softWrap = false
        )
    }
}

// Leave-type family color - casualShort/casualFull share the "Casual" color,
// matching LeaveType.familyLabel() collapsing them into one chip label.
internal fun typeColors(type: String): Pair<Color, Color> = when (LeaveType.normalize(type)) {
    LeaveType.FOREIGN_TRIP -> TypeForeignTrip to TypeForeignTripBg
    LeaveType.UMRAH -> TypeUmrah to TypeUmrahBg
    LeaveType.MEDICAL -> TypeMedical to TypeMedicalBg
    // Reuses the "requested/pending" amber rather than a new color pair -
    // it already reads as "flagged, needs attention" across the app.
    LeaveType.UNINFORMED_ABSENCE -> StatusRequested to StatusRequestedBg
    else -> TypeCasual to TypeCasualBg
}

// Every type has an inherent duration - only casualShort is ever "short".
internal fun durationColors(type: String): Pair<Color, Color> =
    if (LeaveType.isShort(type)) DurationShort to DurationShortBg else DurationFull to DurationFullBg
