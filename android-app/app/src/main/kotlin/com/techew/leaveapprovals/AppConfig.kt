package com.techew.leaveapprovals

/**
 * Mirrors the constants already used by the web app (app.js) and the
 * backend (apps-script/Code.gs) - same Firebase project, same OWNER_EMAIL,
 * same Apps Script deployment. No backend changes were made for this app.
 */
object AppConfig {
    const val OWNER_EMAIL = "developer.ndma@gmail.com"

    const val APPS_SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbz6njgCzwRK1i1aXzW9dmlZzlYfexxx72snoSB46L20u4ecitTTTYrLUnrHY_T_rkUmDQ/exec"

    // Firebase Console -> Project Settings -> Android app -> the
    // "oauth_client" entry with client_type 3 in google-services.json.
    const val WEB_CLIENT_ID =
        "690432267181-29db2q87imkh6ttlv1rbo9mri2nm521t.apps.googleusercontent.com"
}
