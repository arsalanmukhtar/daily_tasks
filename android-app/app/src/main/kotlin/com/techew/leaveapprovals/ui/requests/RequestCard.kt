package com.techew.leaveapprovals.ui.requests

import android.content.Intent
import android.net.Uri
import android.text.method.LinkMovementMethod
import android.widget.TextView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.text.HtmlCompat
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.ui.theme.StatusApproved
import com.techew.leaveapprovals.ui.theme.StatusApprovedBg
import com.techew.leaveapprovals.ui.theme.StatusRejected
import com.techew.leaveapprovals.ui.theme.StatusRejectedBg
import com.techew.leaveapprovals.ui.theme.StatusRequested
import com.techew.leaveapprovals.ui.theme.StatusRequestedBg

@Composable
fun RequestCard(
    request: LeaveRequest,
    highlighted: Boolean,
    onDecide: (decision: String) -> Unit
) {
    val context = LocalContext.current
    var isSubmitting by remember(request.requestId) { mutableStateOf(false) }

    val (statusColor, statusBg) = when (request.status) {
        "approved" -> StatusApproved to StatusApprovedBg
        "rejected" -> StatusRejected to StatusRejectedBg
        else -> StatusRequested to StatusRequestedBg
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        colors = if (highlighted) {
            CardDefaults.cardColors(containerColor = statusBg)
        } else {
            CardDefaults.cardColors()
        },
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {

            // Name + status badge - name takes remaining space and truncates,
            // badge is measured separately so it never gets squeezed into a
            // per-letter wrap.
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
                MetaChip(request.weekLabel)
                MetaChip(if (request.type == "full") "Full Leave" else "Short Leave")
            }

            HorizontalDivider(modifier = Modifier.padding(top = 12.dp, bottom = 12.dp))

            AndroidView(
                modifier = Modifier.fillMaxWidth(),
                factory = { ctx ->
                    TextView(ctx).apply { movementMethod = LinkMovementMethod.getInstance() }
                },
                update = { textView ->
                    val html = request.reasonHtml.ifBlank { "<i>No reason provided.</i>" }
                    textView.text = HtmlCompat.fromHtml(html, HtmlCompat.FROM_HTML_MODE_COMPACT)
                }
            )

            if (request.attachmentUrl.isNotBlank()) {
                TextButton(
                    onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(request.attachmentUrl)))
                    },
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp, vertical = 4.dp)
                ) {
                    Icon(Icons.Filled.AttachFile, contentDescription = null, modifier = Modifier.height(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(request.attachmentName.ifBlank { "View attachment" }, style = MaterialTheme.typography.bodySmall)
                }
            }

            if (request.status != "requested") {
                Text(
                    "${if (request.status == "approved") "Approved" else "Rejected"} by ${request.resolvedBy}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp)
                )
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = { isSubmitting = true; onDecide("approved") },
                        enabled = !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = StatusApproved),
                        modifier = Modifier.weight(1f)
                    ) { Text("Approve") }
                    Button(
                        onClick = { isSubmitting = true; onDecide("rejected") },
                        enabled = !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = StatusRejected),
                        modifier = Modifier.weight(1f)
                    ) { Text("Reject") }
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(label: String, color: androidx.compose.ui.graphics.Color, background: androidx.compose.ui.graphics.Color) {
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

@Composable
private fun MetaChip(label: String) {
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
