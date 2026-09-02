package com.techew.leaveapprovals.ui.charts

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * A dependency-free bar chart for a 12-value series (Jan-Dec). Deliberately
 * plain - flat bars, one accent colour for the tallest bar to call out the
 * "hotspot" month, no gridlines or animation - to match the sober, quiet
 * style of the rest of the app rather than looking like a stock chart widget.
 */
@Composable
fun MonthlyTrendChart(
    values: List<Int>,
    labels: List<String>,
    modifier: Modifier = Modifier,
    barHeight: Dp = 110.dp
) {
    val maxValue = (values.maxOrNull() ?: 0).coerceAtLeast(1)
    val peakIndex = if ((values.maxOrNull() ?: 0) > 0) values.indexOf(values.max()) else -1
    val barColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.28f)
    val peakColor = MaterialTheme.colorScheme.primary

    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth().height(barHeight),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            values.forEachIndexed { index, value ->
                val fraction = (value / maxValue.toFloat()).coerceIn(0.03f, 1f)
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(fraction)
                        .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                        .background(if (index == peakIndex) peakColor else barColor)
                )
            }
        }
        Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
            labels.forEach { label ->
                Text(
                    label,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
