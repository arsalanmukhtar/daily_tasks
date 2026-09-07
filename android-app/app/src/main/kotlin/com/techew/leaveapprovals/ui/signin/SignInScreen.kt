package com.techew.leaveapprovals.ui.signin

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.techew.leaveapprovals.R
import com.techew.leaveapprovals.ui.common.AuthPalette
import com.techew.leaveapprovals.ui.common.authPalette
import com.techew.leaveapprovals.ui.common.dotGrid

// Google's own brand button spec (white surface, #DADCE0 border, #3C4045
// label) - kept exact rather than themed, since altering an official Google
// sign-in button's colors to match app branding isn't allowed by their
// guidelines.
private val GoogleButtonBorder = Color(0xFFDADCE0)
private val GoogleButtonLabel = Color(0xFF3C4043)

@Composable
fun SignInScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onSignInClick: () -> Unit
) {
    val palette = authPalette()

    Surface(modifier = Modifier.fillMaxSize(), color = palette.bg) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .dotGrid(palette.bgDot)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 24.dp)
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                LanguageBadge(palette)
            }

            Spacer(Modifier.height(18.dp))

            SignInCard(palette, isLoading, errorMessage, onSignInClick)

            Spacer(Modifier.height(14.dp))

            FeatureRow(palette)

            Spacer(Modifier.height(12.dp))

            TrustStrip(palette)

            Spacer(Modifier.height(26.dp))

            Footer(palette)

            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun LanguageBadge(palette: AuthPalette) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(palette.surface)
            .border(1.dp, palette.line, RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Icon(Icons.Outlined.Language, contentDescription = null, tint = palette.ink500, modifier = Modifier.size(13.dp))
        Text("EN", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = palette.ink700)
    }
}

@Composable
private fun SignInCard(
    palette: AuthPalette,
    isLoading: Boolean,
    errorMessage: String?,
    onSignInClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(28.dp))
            .background(palette.surface)
            .border(1.dp, palette.line, RoundedCornerShape(28.dp))
            .padding(horizontal = 26.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        LogoHalo(palette)

        Spacer(Modifier.height(24.dp))

        Text(
            "NDMA · TECH EW",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            letterSpacing = 2.sp,
            color = palette.brand
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Tech EW",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = palette.ink900
        )
        Text(
            "Leave Approvals",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = palette.brand,
            modifier = Modifier.padding(top = 2.dp)
        )
        Text(
            "Review requests, track archives, and flag uninformed leave. Owner access only.",
            style = MaterialTheme.typography.bodyMedium,
            color = palette.ink700,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 14.dp, bottom = 26.dp)
        )

        GoogleSignInButton(isLoading = isLoading, onClick = onSignInClick)

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Icon(Icons.Outlined.Shield, contentDescription = null, tint = palette.ink400, modifier = Modifier.size(14.dp))
            Text(
                "Only the owner account can continue",
                style = MaterialTheme.typography.bodySmall,
                color = palette.ink500
            )
        }

        if (errorMessage != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 16.dp)
            ) {
                Icon(
                    Icons.Outlined.ErrorOutline,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    errorMessage,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun LogoHalo(palette: AuthPalette) {
    val transition = rememberInfiniteTransition(label = "logo-halo")
    val scale by transition.animateFloat(
        initialValue = 0.94f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(animation = tween(2250, easing = FastOutSlowInEasing), repeatMode = RepeatMode.Reverse),
        label = "halo-scale"
    )
    val haloAlpha by transition.animateFloat(
        initialValue = 0.6f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(animation = tween(2250, easing = FastOutSlowInEasing), repeatMode = RepeatMode.Reverse),
        label = "halo-alpha"
    )

    Box(modifier = Modifier.size(132.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .size(132.dp)
                .graphicsLayer { scaleX = scale; scaleY = scale; alpha = haloAlpha }
                .background(
                    Brush.radialGradient(listOf(palette.brandTintStrong.copy(alpha = 0.55f), Color.Transparent)),
                    CircleShape
                )
        )
        Surface(
            shape = CircleShape,
            color = palette.surface,
            border = BorderStroke(1.dp, palette.brandTintStrong),
            modifier = Modifier.size(108.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Image(
                    painter = painterResource(R.drawable.ndma_logo),
                    contentDescription = "National Disaster Management Authority",
                    modifier = Modifier.size(68.dp)
                )
            }
        }
    }
}

@Composable
private fun GoogleSignInButton(isLoading: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = !isLoading,
        shape = RoundedCornerShape(50),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.White,
            contentColor = GoogleButtonLabel,
            disabledContainerColor = Color.White,
            disabledContentColor = GoogleButtonLabel.copy(alpha = 0.6f)
        ),
        border = BorderStroke(1.dp, GoogleButtonBorder),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 1.dp, pressedElevation = 0.dp),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp,
                color = GoogleButtonLabel.copy(alpha = 0.6f)
            )
        } else {
            Icon(
                painter = painterResource(R.drawable.ic_google_logo),
                contentDescription = null,
                tint = Color.Unspecified,
                modifier = Modifier.size(18.dp)
            )
        }
        Spacer(Modifier.width(12.dp))
        Text(
            if (isLoading) "Signing in..." else "Sign in with Google",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun FeatureRow(palette: AuthPalette) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureCard(palette, Icons.Outlined.Shield, "Owner-only access", "Single manager account", Modifier.weight(1f))
        FeatureCard(palette, Icons.Outlined.NotificationsActive, "Instant decisions", "Push on every request", Modifier.weight(1f))
        FeatureCard(palette, Icons.Outlined.Lock, "Secured by Firebase", "Google identity", Modifier.weight(1f))
    }
}

@Composable
private fun FeatureCard(palette: AuthPalette, icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, caption: String, modifier: Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(18.dp))
            .background(palette.surface2)
            .border(1.dp, palette.line, RoundedCornerShape(18.dp))
            .padding(horizontal = 8.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(palette.brandTint),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = palette.brand, modifier = Modifier.size(17.dp))
        }
        Spacer(Modifier.height(9.dp))
        Text(
            title,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = palette.ink900,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(3.dp))
        Text(
            caption,
            style = MaterialTheme.typography.labelSmall,
            color = palette.ink500,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun TrustStrip(palette: AuthPalette) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(palette.surface)
            .border(1.dp, palette.line, RoundedCornerShape(16.dp))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(palette.surface2)
                    .border(1.dp, palette.line, RoundedCornerShape(9.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Outlined.Fingerprint, contentDescription = null, tint = palette.ink700, modifier = Modifier.size(16.dp))
            }
            Text(
                "Google Identity · Firebase Auth",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Medium,
                color = palette.ink700
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(palette.secureTint)
                .padding(horizontal = 10.dp, vertical = 5.dp)
        ) {
            Icon(Icons.Filled.Check, contentDescription = null, tint = palette.secure, modifier = Modifier.size(11.dp))
            Text(
                "SECURE",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.4.sp,
                color = palette.secure
            )
        }
    }
}

@Composable
private fun Footer(palette: AuthPalette) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            "NATIONAL DISASTER MANAGEMENT AUTHORITY",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = palette.ink700,
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .border(1.dp, palette.lineStrong, RoundedCornerShape(50))
                .padding(horizontal = 16.dp, vertical = 8.dp)
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Single-user manager app · No account switching",
            style = MaterialTheme.typography.labelSmall,
            color = palette.ink400,
            textAlign = TextAlign.Center
        )
    }
}
