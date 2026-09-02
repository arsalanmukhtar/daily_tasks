package com.techew.leaveapprovals

/**
 * Talks to the same Firebase project (Firestore + Auth) as the web app
 * (app.js) - see firestore.rules for the security model. Owner status is
 * resolved from the `allowlist` collection at runtime (see
 * AllowlistRepository), not a build-time constant.
 */
object AppConfig {
    // Firebase Console -> Project Settings -> Android app -> the
    // "oauth_client" entry with client_type 3 in google-services.json.
    const val WEB_CLIENT_ID =
        "690432267181-29db2q87imkh6ttlv1rbo9mri2nm521t.apps.googleusercontent.com"
}
