package com.techew.leaveapprovals.ui.common

import android.text.method.LinkMovementMethod
import android.widget.TextView
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.text.HtmlCompat

/**
 * Renders a reasonHtml/resolutionHtml-shaped string (the same rich-text
 * output every editor in this project produces, native or web) with real
 * paragraph/list spacing - same AndroidView+TextView+FROM_HTML_MODE_LEGACY
 * pattern already used in RequestDetailSheet, pulled out here so the new
 * Report screen doesn't have to duplicate it.
 */
@Composable
fun HtmlText(html: String, modifier: Modifier = Modifier) {
    AndroidView(
        modifier = modifier.fillMaxWidth(),
        factory = { ctx -> TextView(ctx).apply { movementMethod = LinkMovementMethod.getInstance() } },
        update = { textView ->
            textView.text = HtmlCompat.fromHtml(html.ifBlank { "<i>No details provided.</i>" }, HtmlCompat.FROM_HTML_MODE_LEGACY)
        }
    )
}
