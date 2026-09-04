package com.techew.leaveapprovals.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.FormatUnderlined
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp

/**
 * The whole point of tracking bold/italic/underline as three independent
 * lists of disjoint character ranges (rather than one AnnotatedString) is
 * that toggling one style never has to know or care about the other two,
 * and re-deriving the visible text + the saved reasonHtml/resolutionHtml
 * string is just "apply each list's ranges", not a stateful merge.
 */
@Stable
class RichTextState {
    var textFieldValue: TextFieldValue by mutableStateOf(TextFieldValue(""))
        internal set
    var boldRanges: List<IntRange> by mutableStateOf(emptyList())
        internal set
    var italicRanges: List<IntRange> by mutableStateOf(emptyList())
        internal set
    var underlineRanges: List<IntRange> by mutableStateOf(emptyList())
        internal set

    val isBlank: Boolean get() = textFieldValue.text.isBlank()

    // The same reasonHtml/resolutionHtml shape used everywhere else in this
    // project - HtmlCompat.fromHtml already renders <b>/<i>/<u> correctly
    // wherever those fields are displayed, with zero changes needed there.
    val html: String get() = buildRichTextHtml(textFieldValue.text, boldRanges, italicRanges, underlineRanges)

    fun clear() {
        textFieldValue = TextFieldValue("")
        boldRanges = emptyList()
        italicRanges = emptyList()
        underlineRanges = emptyList()
    }
}

@Composable
fun rememberRichTextState(): RichTextState = remember { RichTextState() }

@Composable
fun RichTextEditor(
    state: RichTextState,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    minLines: Int = 4
) {
    fun selectionRange(): IntRange? {
        val sel = state.textFieldValue.selection
        return if (sel.min < sel.max) sel.min until sel.max else null
    }

    fun onValueChange(new: TextFieldValue) {
        val old = state.textFieldValue
        if (new.text != old.text) {
            val edit = computeTextEdit(old.text, new.text)
            state.boldRanges = remapRanges(state.boldRanges, edit)
            state.italicRanges = remapRanges(state.italicRanges, edit)
            state.underlineRanges = remapRanges(state.underlineRanges, edit)
        }
        state.textFieldValue = new
    }

    val selection = selectionRange()
    val hasSelection = selection != null
    val boldActive = selection != null && isFullyCovered(state.boldRanges, selection)
    val italicActive = selection != null && isFullyCovered(state.italicRanges, selection)
    val underlineActive = selection != null && isFullyCovered(state.underlineRanges, selection)

    val visualTransformation = remember(state.boldRanges, state.italicRanges, state.underlineRanges) {
        VisualTransformation { text ->
            val builder = AnnotatedString.Builder(text.text)
            fun apply(ranges: List<IntRange>, style: SpanStyle) {
                ranges.forEach { r ->
                    val start = r.first.coerceIn(0, text.length)
                    val end = (r.last + 1).coerceIn(start, text.length)
                    if (start < end) builder.addStyle(style, start, end)
                }
            }
            apply(state.boldRanges, SpanStyle(fontWeight = FontWeight.Bold))
            apply(state.italicRanges, SpanStyle(fontStyle = FontStyle.Italic))
            apply(state.underlineRanges, SpanStyle(textDecoration = TextDecoration.Underline))
            TransformedText(builder.toAnnotatedString(), OffsetMapping.Identity)
        }
    }

    Column(modifier = modifier) {
        Row(modifier = Modifier.padding(bottom = 6.dp)) {
            FormatToggleButton(
                icon = Icons.Filled.FormatBold,
                contentDescription = "Bold",
                active = boldActive,
                enabled = hasSelection,
                onClick = { selection?.let { state.boldRanges = toggleRange(state.boldRanges, it) } }
            )
            FormatToggleButton(
                icon = Icons.Filled.FormatItalic,
                contentDescription = "Italic",
                active = italicActive,
                enabled = hasSelection,
                onClick = { selection?.let { state.italicRanges = toggleRange(state.italicRanges, it) } }
            )
            FormatToggleButton(
                icon = Icons.Filled.FormatUnderlined,
                contentDescription = "Underline",
                active = underlineActive,
                enabled = hasSelection,
                onClick = { selection?.let { state.underlineRanges = toggleRange(state.underlineRanges, it) } }
            )
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                .padding(12.dp)
                .defaultMinSize(minHeight = (minLines * 22).dp)
        ) {
            if (state.textFieldValue.text.isEmpty()) {
                Text(placeholder, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            BasicTextField(
                value = state.textFieldValue,
                onValueChange = ::onValueChange,
                visualTransformation = visualTransformation,
                textStyle = MaterialTheme.typography.bodyMedium.copy(color = LocalContentColor.current),
                cursorBrush = androidx.compose.ui.graphics.SolidColor(MaterialTheme.colorScheme.primary),
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun FormatToggleButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    active: Boolean,
    enabled: Boolean,
    onClick: () -> Unit
) {
    IconButton(onClick = onClick, enabled = enabled) {
        Icon(
            icon,
            contentDescription = contentDescription,
            tint = when {
                !enabled -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                active -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.onSurfaceVariant
            }
        )
    }
}

// ---------- range math ----------
// Three independent lists of disjoint, sorted IntRanges (inclusive) - one
// per style. Every operation below treats a list purely as "the set of
// character indices currently in that style" and returns a new normalized
// (sorted, merged, non-overlapping) list.

private fun mergeRanges(ranges: List<IntRange>): List<IntRange> {
    val sorted = ranges.filter { it.first <= it.last }.sortedBy { it.first }
    if (sorted.isEmpty()) return emptyList()
    val merged = mutableListOf(sorted.first())
    for (r in sorted.drop(1)) {
        val last = merged.last()
        if (r.first <= last.last + 1) {
            merged[merged.size - 1] = last.first..maxOf(last.last, r.last)
        } else {
            merged.add(r)
        }
    }
    return merged
}

private fun subtractRange(ranges: List<IntRange>, remove: IntRange): List<IntRange> {
    val result = mutableListOf<IntRange>()
    for (r in ranges) {
        if (remove.last < r.first || remove.first > r.last) {
            result.add(r)
            continue
        }
        if (remove.first > r.first) result.add(r.first until remove.first)
        if (remove.last < r.last) result.add((remove.last + 1)..r.last)
    }
    return result.filter { it.first <= it.last }
}

private fun isFullyCovered(ranges: List<IntRange>, target: IntRange): Boolean {
    if (target.first > target.last) return false
    var pos = target.first
    for (r in ranges.sortedBy { it.first }) {
        if (r.last < pos) continue
        if (r.first > pos) return false
        pos = r.last + 1
        if (pos > target.last) return true
    }
    return pos > target.last
}

private fun toggleRange(ranges: List<IntRange>, selection: IntRange): List<IntRange> =
    if (isFullyCovered(ranges, selection)) subtractRange(ranges, selection) else mergeRanges(ranges + listOf(selection))

// A single text replacement: [start, oldEnd) in the old text became
// [start, newEnd) in the new text. Derived from the old/new strings' common
// prefix/suffix rather than assumed to be "insert at cursor", so paste,
// autocorrect, and multi-character replace all remap spans correctly too.
private data class TextEdit(val start: Int, val oldEnd: Int, val newEnd: Int)

private fun computeTextEdit(old: String, new: String): TextEdit {
    val maxCommon = minOf(old.length, new.length)
    var start = 0
    while (start < maxCommon && old[start] == new[start]) start++
    var oldEnd = old.length
    var newEnd = new.length
    while (oldEnd > start && newEnd > start && old[oldEnd - 1] == new[newEnd - 1]) {
        oldEnd--
        newEnd--
    }
    return TextEdit(start, oldEnd, newEnd)
}

// Text strictly inside the replaced region loses its formatting (split into
// "the part before" and "the part after, shifted" - nothing fancier).
private fun remapRanges(ranges: List<IntRange>, edit: TextEdit): List<IntRange> {
    val delta = (edit.newEnd - edit.start) - (edit.oldEnd - edit.start)
    val result = mutableListOf<IntRange>()
    for (r in ranges) {
        val rStart = r.first
        val rEndExclusive = r.last + 1
        when {
            rEndExclusive <= edit.start -> result.add(r)
            rStart >= edit.oldEnd -> result.add((rStart + delta)..(rEndExclusive + delta - 1))
            else -> {
                if (rStart < edit.start) result.add(rStart until edit.start)
                if (rEndExclusive > edit.oldEnd) result.add(edit.newEnd..(rEndExclusive + delta - 1))
            }
        }
    }
    return mergeRanges(result)
}

// ---------- HTML serialization ----------

private fun escapeHtml(text: String): String = text
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")

private fun buildRichTextHtml(text: String, bold: List<IntRange>, italic: List<IntRange>, underline: List<IntRange>): String {
    if (text.isBlank()) return ""
    val boundaries = sortedSetOf(0, text.length)
    (bold + italic + underline).forEach {
        boundaries.add(it.first.coerceIn(0, text.length))
        boundaries.add((it.last + 1).coerceIn(0, text.length))
    }
    val points = boundaries.toList()
    val sb = StringBuilder("<p>")
    for (i in 0 until points.size - 1) {
        val start = points[i]
        val end = points[i + 1]
        if (start >= end) continue
        var segment = escapeHtml(text.substring(start, end)).replace("\n", "<br/>")
        if (underline.any { start >= it.first && end <= it.last + 1 }) segment = "<u>$segment</u>"
        if (italic.any { start >= it.first && end <= it.last + 1 }) segment = "<i>$segment</i>"
        if (bold.any { start >= it.first && end <= it.last + 1 }) segment = "<b>$segment</b>"
        sb.append(segment)
    }
    sb.append("</p>")
    return sb.toString()
}
