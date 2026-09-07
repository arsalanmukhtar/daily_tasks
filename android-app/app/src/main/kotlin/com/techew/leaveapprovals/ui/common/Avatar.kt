package com.techew.leaveapprovals.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Hashing a person's key into one of a handful of fixed colors (the old
// approach) guarantees collisions the moment the roster outgrows the
// palette - with 14 developers and even a 10-color palette, at least two
// people are mathematically certain to collide (pigeonhole principle), and
// in practice several usually do. This instead assigns each newly-seen key
// the next slot around the hue wheel, stepped by the golden angle - the
// standard technique for generating any number of well-separated colors
// without knowing the final count up front. Two different keys always get
// two different slots, so they can never land on the same hue: real,
// guaranteed uniqueness instead of low collision odds. The tradeoff is that
// a person's color is now stable only for the current app process (assigned
// on first render, not derived from a fixed formula), not across restarts.
private object AvatarColorRegistry {
    private const val GOLDEN_ANGLE = 137.50776f
    private val indexByKey = LinkedHashMap<String, Int>()

    @Synchronized
    fun colorsFor(key: String): Pair<Color, Color> {
        val index = indexByKey.getOrPut(key) { indexByKey.size }
        val hue = (index * GOLDEN_ANGLE) % 360f
        val textColor = Color.hsl(hue, 0.6f, 0.32f)
        val backgroundColor = Color.hsl(hue, 0.6f, 0.87f)
        return textColor to backgroundColor
    }
}

private fun initialsFor(name: String, email: String): String {
    val source = name.ifBlank { email }
    if (source.isBlank()) return "?"
    val parts = source.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return when {
        parts.size >= 2 -> "${parts[0].first()}${parts[1].first()}".uppercase()
        parts.size == 1 -> parts[0].take(2).uppercase()
        else -> "?"
    }
}

/**
 * Initials circle used for a person's identity everywhere the app shows one
 * (request card header, detail sheet header, person-filter sheet rows,
 * Summary leaderboard). Color is assigned per email/name key via
 * AvatarColorRegistry, so every distinct person gets a distinct color.
 */
@Composable
fun Avatar(name: String, email: String, size: Dp = 36.dp) {
    val key = email.ifBlank { name }.trim().lowercase()
    val (textColor, backgroundColor) = AvatarColorRegistry.colorsFor(key)
    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(backgroundColor),
        contentAlignment = Alignment.Center
    ) {
        androidx.compose.material3.Text(
            initialsFor(name, email),
            color = textColor,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.36f).sp
        )
    }
}
