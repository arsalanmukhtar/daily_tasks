package com.techew.leaveapprovals.ui.restricted

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.GppBad
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.techew.leaveapprovals.ui.common.authPalette
import com.techew.leaveapprovals.ui.theme.StatusRejected
import com.techew.leaveapprovals.ui.theme.StatusRejectedBg

/**
 * Shown when a Google account signs in successfully but isn't the
 * configured owner - a dead end, not a flow, so it's deliberately spare:
 * what happened, whose account it thinks you are, and the two ways out.
 * Shares the Sign In screen's warm-neutral identity (see AuthPalette) so
 * the two "gate" screens read as one design language.
 */
@Composable
fun RestrictedScreen(email: String, onSignOut: () -> Unit) {
    val palette = authPalette()

    Surface(modifier = Modifier.fillMaxSize(), color = palette.bg) {
        Box(modifier = Modifier.fillMaxSize().systemBarsPadding()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(108.dp)
                    .clip(CircleShape)
                    .background(StatusRejectedBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Filled.GppBad,
                    contentDescription = null,
                    tint = StatusRejected,
                    modifier = Modifier.size(46.dp)
                )
            }

            Spacer(Modifier.height(22.dp))

            Text(
                "ACCESS RESTRICTED",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
                color = palette.brand
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Not the owner account",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = palette.ink900,
                textAlign = TextAlign.Center
            )
            Text(
                "This app is only available to the account owner. Signed in as $email.",
                style = MaterialTheme.typography.bodyMedium,
                color = palette.ink700,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp, bottom = 26.dp)
            )

            Button(
                onClick = onSignOut,
                shape = RoundedCornerShape(50),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.inverseSurface,
                    contentColor = MaterialTheme.colorScheme.inverseOnSurface
                ),
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 14.dp),
                modifier = Modifier.fillMaxWidth(0.72f)
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                Text("Sign out", modifier = Modifier.padding(start = 8.dp), fontWeight = FontWeight.Medium)
            }

            Spacer(Modifier.height(14.dp))

            // Functionally the same exit as "Sign out" above - there's no
            // separate account-switch API, but offering it as its own quiet
            // link (rather than only the one heavy button) matches the
            // reference design and reads as the lighter-weight option it is.
            Text(
                "Use a different account",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = palette.ink700,
                modifier = Modifier.clickable(onClick = onSignOut).padding(8.dp)
            )
        }

        Column(
            modifier = Modifier.fillMaxSize().padding(bottom = 28.dp),
            verticalArrangement = Arrangement.Bottom,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "National Disaster Management Authority",
                style = MaterialTheme.typography.labelSmall,
                color = palette.ink400
            )
        }
        }
    }
}
