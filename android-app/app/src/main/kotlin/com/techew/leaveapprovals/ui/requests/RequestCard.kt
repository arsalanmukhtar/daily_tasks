package com.techew.leaveapprovals.ui.requests

import androidx.compose.foundation.background
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.text.HtmlCompat
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.data.LeaveType
import com.techew.leaveapprovals.ui.theme.StatusApproved
import com.techew.leaveapprovals.ui.theme.StatusApprovedBg
import com.techew.leaveapprovals.ui.theme.StatusRejected
import com.techew.leaveapprovals.ui.theme.StatusRejectedBg
import com.techew.leaveapprovals.ui.theme.StatusRequested
import com.techew.leaveapprovals.ui.theme.StatusRequestedBg
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

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    request.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                StatusBadge(label = request.status.uppercase(), color = statusColor, background = statusBg)
            }

            Text(
                request.email,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp)
            )

            Row(
                modifier = Modifier.padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                MetaChip(LeaveType.label(request.type))
                MetaChip(request.weekLabel)
                val time = formatTimeHHmm(request.requestedAt)
                if (time.isNotBlank()) MetaChip(time)
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
                    "${if (request.status == "approved") "Approved" else "Rejected"} by ${request.resolvedBy}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            OutlinedButton(
                onClick = onViewDetails,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
            ) { Text("View details") }
        }
    }
}

@Composable
internal fun statusColors(status: String): Pair<androidx.compose.ui.graphics.Color, androidx.compose.ui.graphics.Color> = when (status) {
    "approved" -> StatusApproved to StatusApprovedBg
    "rejected" -> StatusRejected to StatusRejectedBg
    else -> StatusRequested to StatusRequestedBg
}

@Composable
internal fun StatusBadge(label: String, color: androidx.compose.ui.graphics.Color, background: androidx.compose.ui.graphics.Color) {
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

@Composable
internal fun MetaChip(label: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            softWrap = false
        )
    }
}
