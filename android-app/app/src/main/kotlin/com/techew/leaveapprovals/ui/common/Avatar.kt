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

// A dedicated identity palette - pastel background paired with a matching
// dark foreground, same "light bg + saturated same-hue text" convention as
// the Type/Status chips elsewhere, but kept separate from those (reusing
// only 4 semantic type colors left the roster's 14 developers colliding
// into the same handful of hues constantly). Ten genuinely distinct hues
// keeps collisions rare without needing a lookup table per person.
private val AVATAR_PALETTE: List<Pair<Color, Color>> = listOf(
    Color(0xFF6C4CC4) to Color(0xFFEDE7FA), // purple
    Color(0xFF0E8A7D) to Color(0xFFDFF2EF), // teal
    Color(0xFFC2410C) to Color(0xFFFFE7D6), // orange
    Color(0xFF3B5BDB) to Color(0xFFE8EDFC), // blue
    Color(0xFFBE185D) to Color(0xFFFCE4EF), // pink
    Color(0xFF15803D) to Color(0xFFDCFCE7), // green
    Color(0xFF4338CA) to Color(0xFFE5E3FB), // indigo
    Color(0xFF92400E) to Color(0xFFFDECC8), // brown
    Color(0xFF0B7FA8) to Color(0xFFDFF0F8), // cyan
    Color(0xFFB91C1C) to Color(0xFFFEE2E2)  // red
)

private fun avatarColorsFor(key: String): Pair<Color, Color> {
    val trimmed = key.trim().lowercase()
    if (trimmed.isBlank()) return AVATAR_PALETTE.first()
    val hash = trimmed.fold(0) { acc, c -> acc * 31 + c.code }
    val index = ((hash % AVATAR_PALETTE.size) + AVATAR_PALETTE.size) % AVATAR_PALETTE.size
    return AVATAR_PALETTE[index]
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
 * Summary leaderboard). Color is deterministic from the name/email hash so
 * the same person always renders the same color without any lookup table.
 */
@Composable
fun Avatar(name: String, email: String, size: Dp = 36.dp) {
    val (textColor, backgroundColor) = avatarColorsFor(email.ifBlank { name })
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
