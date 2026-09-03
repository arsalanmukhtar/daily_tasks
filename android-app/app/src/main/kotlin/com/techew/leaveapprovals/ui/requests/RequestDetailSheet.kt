package com.techew.leaveapprovals.ui.requests

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.text.method.LinkMovementMethod
import android.widget.TextView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.text.HtmlCompat
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.ui.theme.StatusApproved
import com.techew.leaveapprovals.ui.theme.StatusRejected

/**
 * Full-detail view for one leave request, opened from its card's "View
 * details" button. Approve/Reject live here rather than on the card, so a
 * manager reads the full reason and attachment before deciding.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequestDetailSheet(
    request: LeaveRequest,
    sheetState: SheetState,
    isDeciding: Boolean,
    onDismiss: () -> Unit,
    onDecide: (decision: String) -> Unit
) {
    val context = LocalContext.current
    val (statusColor, statusBg) = statusColors(request.status)
    val typeLabel = if (request.type == "full") "Full Leave" else "Short Leave"

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(request.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(
                        request.email,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                StatusBadge(label = request.status.uppercase(), color = statusColor, background = statusBg)
            }

            Row(
                modifier = Modifier.padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                MetaChip(request.weekLabel)
                MetaChip(typeLabel)
            }

            HorizontalDivider(modifier = Modifier.padding(top = 16.dp, bottom = 14.dp))

            Text(
                "REASON",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            AndroidView(
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                factory = { ctx ->
                    TextView(ctx).apply { movementMethod = LinkMovementMethod.getInstance() }
                },
                update = { textView ->
                    val html = request.reasonHtml.ifBlank { "<i>No reason provided.</i>" }
                    textView.text = HtmlCompat.fromHtml(html, HtmlCompat.FROM_HTML_MODE_COMPACT)
                }
            )

            if (request.attachmentUrl.isNotBlank()) {
                OutlinedButton(
                    onClick = { openAttachment(context, request.attachmentUrl) },
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp)
                ) {
                    Icon(Icons.Outlined.AttachFile, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                    Text(request.attachmentName.ifBlank { "Open attachment" })
                }
            }

            if (request.status != "requested") {
                HorizontalDivider(modifier = Modifier.padding(top = 18.dp, bottom = 14.dp))
                Text(
                    "${if (request.status == "approved") "Approved" else "Rejected"} by ${request.resolvedBy}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else if (isDeciding) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 22.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(modifier = Modifier.padding(vertical = 6.dp))
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 22.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = { onDecide("approved") },
                        colors = ButtonDefaults.buttonColors(containerColor = StatusApproved),
                        modifier = Modifier.weight(1f)
                    ) { Text("Approve") }
                    Button(
                        onClick = { onDecide("rejected") },
                        colors = ButtonDefaults.buttonColors(containerColor = StatusRejected),
                        modifier = Modifier.weight(1f)
                    ) { Text("Reject") }
                }
            }
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
