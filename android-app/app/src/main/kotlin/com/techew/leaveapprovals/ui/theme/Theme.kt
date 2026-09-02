package com.techew.leaveapprovals.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = TechEwOrange,
    onPrimary = Color.White,
    secondary = TechEwOrangeDark
)

private val DarkColors = darkColorScheme(
    primary = TechEwOrange,
    onPrimary = Color.White,
    secondary = TechEwOrangeDark
)

@Composable
fun LeaveApprovalsTheme(
    darkTheme: Boolean = androidx.compose.foundation.isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
