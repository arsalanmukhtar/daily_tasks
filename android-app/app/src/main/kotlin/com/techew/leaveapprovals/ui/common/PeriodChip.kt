package com.techew.leaveapprovals.ui.common

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * The Year/Quarter/Month/Week-style filter chip used throughout the Summary
 * and Archived period pickers. Plain Material3 FilterChip defaults to an
 * outlined look when unselected (transparent fill + a visible border),
 * which read as a totally different, thinner control next to the filled
 * pills everywhere else in the mockup - this always fills with
 * surfaceVariant and drops the border, so "unselected" reads as a muted
 * filled pill rather than an outline, matching the reference exactly.
 * Selected still uses the near-white/dark-text pairing (inverseSurface/
 * inverseOnSurface) shared with the solid CTAs and DevSegmentButton.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PeriodChip(
    selected: Boolean,
    onClick: () -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    leadingIcon: (@Composable () -> Unit)? = null
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        leadingIcon = leadingIcon,
        shape = RoundedCornerShape(50),
        border = null,
        colors = FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
            iconColor = MaterialTheme.colorScheme.onSurfaceVariant,
            selectedContainerColor = MaterialTheme.colorScheme.inverseSurface,
            selectedLabelColor = MaterialTheme.colorScheme.inverseOnSurface,
            selectedLeadingIconColor = MaterialTheme.colorScheme.inverseOnSurface
        ),
        modifier = modifier
    )
}
