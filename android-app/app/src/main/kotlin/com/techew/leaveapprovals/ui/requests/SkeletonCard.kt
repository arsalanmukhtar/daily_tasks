package com.techew.leaveapprovals.ui.requests

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
private fun shimmerBrush(): Brush {
    val transition = rememberInfiniteTransition(label = "skeleton-shimmer")
    val translate by transition.animateFloat(
        initialValue = -400f,
        targetValue = 400f,
        animationSpec = infiniteRepeatable(animation = tween(1200, easing = LinearEasing), repeatMode = RepeatMode.Restart),
        label = "skeleton-shimmer-x"
    )
    val base = MaterialTheme.colorScheme.surfaceVariant
    val highlight = MaterialTheme.colorScheme.surface
    return Brush.linearGradient(
        colors = listOf(base, highlight, base),
        start = Offset(translate - 200f, 0f),
        end = Offset(translate + 200f, 0f)
    )
}

@Composable
private fun ShimmerBlock(width: Dp, height: Dp, shape: Shape = RoundedCornerShape(6.dp)) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier.width(width).height(height).clip(shape).background(shimmerBrush())
    )
}

/**
 * Placeholder card shown only on the very first load (list still empty) -
 * shaped like [RequestCard] so the layout doesn't visibly jump once real
 * data replaces it. Never shown for a manual refresh with data already on
 * screen - that case gets [RefreshingPill] instead, with the real list still
 * visible underneath.
 */
@Composable
fun SkeletonCard() {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ShimmerBlock(36.dp, 36.dp, shape = CircleShape)
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    ShimmerBlock(140.dp, 14.dp)
                    Spacer(modifier = Modifier.height(6.dp))
                    ShimmerBlock(100.dp, 10.dp)
                }
                Spacer(modifier = Modifier.width(8.dp))
                ShimmerBlock(70.dp, 22.dp, shape = RoundedCornerShape(50))
            }
            Row(modifier = Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ShimmerBlock(56.dp, 22.dp)
                ShimmerBlock(76.dp, 22.dp)
                ShimmerBlock(64.dp, 22.dp)
            }
            Spacer(modifier = Modifier.height(12.dp))
            ShimmerBlock(240.dp, 11.dp)
            Spacer(modifier = Modifier.height(6.dp))
            ShimmerBlock(180.dp, 11.dp)
        }
    }
}

/** Shown atop the list during a manual refresh when data is already on screen. */
@Composable
fun RefreshingPill(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(50))
            .padding(horizontal = 14.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
        Text("Refreshing…", style = MaterialTheme.typography.labelMedium)
    }
}
