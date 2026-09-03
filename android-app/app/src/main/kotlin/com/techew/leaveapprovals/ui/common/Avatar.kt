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
import com.techew.leaveapprovals.ui.theme.TypeCasual
import com.techew.leaveapprovals.ui.theme.TypeForeignTrip
import com.techew.leaveapprovals.ui.theme.TypeMedical
import com.techew.leaveapprovals.ui.theme.TypeUmrah

// Reuses the leave-type accent colors already in the palette (matching the
// mockup's .ava/.ava.b/.ava.c variants) rather than inventing a parallel
// "avatar palette" nobody asked for.
private val AVATAR_COLORS = listOf(TypeCasual, TypeMedical, TypeUmrah, TypeForeignTrip)

private fun avatarColorFor(key: String): Color {
    val trimmed = key.trim().lowercase()
    if (trimmed.isBlank()) return AVATAR_COLORS.first()
    val hash = trimmed.fold(0) { acc, c -> acc * 31 + c.code }
    val index = ((hash % AVATAR_COLORS.size) + AVATAR_COLORS.size) % AVATAR_COLORS.size
    return AVATAR_COLORS[index]
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
    val color = avatarColorFor(email.ifBlank { name })
    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(color),
        contentAlignment = Alignment.Center
    ) {
        androidx.compose.material3.Text(
            initialsFor(name, email),
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.36f).sp
        )
    }
}
