# Tech EW Mobile — Flutter Architecture (Developer App)

Planning document for a new Flutter/Dart mobile app (Android + iOS) for **developers** — the mobile counterpart to what they use today on the web app. This is a new, third client talking to the same Firebase backend; it does not replace anything.

## Scope

| Surface | Stays as-is | Changes |
|---|---|---|
| Web app (`index.html`/`app.js`/`styles.css`) | ✅ Untouched — devs and managers keep using it exactly as today | — |
| Native Android manager app (`android-app/`, Kotlin/Compose) | ✅ Untouched — managers keep using it | — |
| **New: Flutter dev app** | — | New `mobile-app/` (or similar) directory in this repo |
| Firebase backend (Firestore, Auth, rules, push-daemon) | ✅ No changes needed | Flutter is just a third client of the same data |

The Flutter app is **developer-facing only** — it reimplements what a developer does on the web app today (weekly task submissions + leave), not what the manager does. It is not a port of the Kotlin app (that's a different, manager-facing feature set built around approve/reject/summary).

Target platforms: **Android + iOS**, one Dart codebase. iOS builds (`flutter build ipa`) require Xcode on macOS — not possible from this Windows environment. Code and structure will be written platform-agnostically throughout; the actual `.ipa` build/signing happens on your Mac when ready.

---

## Why this is a small backend lift

Firebase has first-class Flutter support (the "FlutterFire" packages). Every backend piece this project already has is directly reusable:

- **Firestore** — same project (`devteam-daily-tasks`), same collections, same `firestore.rules`. Rules are enforced per-document/field, not per-client, so a Flutter client signed in with the same Google account gets identical permissions to the web client today. **No rules changes required.**
- **Auth** — same Firebase Google Sign-In flow, same `allowlist/{email}` gate the web app already reads.
- **Push** — `push-daemon/` already sends FCM to `pushTokens` docs; a Flutter client registers its token into the same collection the same way the Kotlin app does (see below). No daemon changes required for v1 (see "Future work").
- **Attachments** — the web app uploads leave attachments straight to the requester's own Google Drive via the `drive.file` OAuth scope requested at sign-in (`app.js:52`), not Firebase Storage. Flutter replicates this with the `google_sign_in` package's `scopes` parameter + the Drive v3 REST API (or the `googleapis` Dart package) — no billing plan, no new infrastructure.

Net result: this is a pure client build. Nothing in Firestore, `firestore.rules`, or `push-daemon/` needs to change to ship v1.

---

## Firestore collections this app reads/writes

All under the existing `devteam-daily-tasks` project, exactly as documented in the root `README.md` and `firestore.rules`.

| Collection | Doc ID | Written by this app | Purpose |
|---|---|---|---|
| `allowlist` | lowercase email | read-only | Gates access; carries `name`, `designation`, `reportedTo`, `domain`, `isOwner`, `active` |
| `submissions` | `{email}_{sanitized-weekLabel}` | create/update (own docs only) | Weekly task timesheet: `weekLabel`, `weekRange`, `designation`, `taskRows`, `updatedAt` |
| `leaveRequests` | auto-id | create (own), limited update (withdraw) | A leave application — see field list below |
| `uninformedLeaves` | auto-id | limited update (`explain`, own docs only) | Manager-filed absence reports the developer explains — see field list below |
| `pushTokens` | the FCM token itself | create/update (own) | `{email, platform, registeredAt}` — same shape the Kotlin app already writes |

**`leaveRequests` fields** (mirrors `android-app/.../data/LeaveRequest.kt` exactly, since that's already the canonical cross-client shape):
`requestId, requestedAt, startDate, endDate, customDates[], email, name, weekLabel, type, reasonHtml, status, resolvedAt, resolvedBy, attachments[{name,url,fileId}], halfDayPeriod, shortLeaveTime, checkOutTime, checkInTime, decisionNote, withdrawnAt`

`type` is one of: `casualShort`, `casualFull`, `casualOutPass`, `medical`, `foreignTrip`, `umrah`, plus the read-only `uninformedAbsence` (created server-side by `push-daemon`, never by a client).

**`uninformedLeaves` fields** (mirrors `android-app/.../data/UninformedLeave.kt`):
`reportId, email, name, date, reasonHtml, reportedBy, reportedAt, status ("reported"|"explained"|"resolved"), explanationHtml, explainedAt, rejectionNote, rejectionNoteAt, resolvedAt, resolvedBy, resolutionHtml, linkedRequestId`

A developer's only write here is the `reported → explained` transition (see `firestore.rules`'s `uninformedLeaves` block) — everything else is the manager's or `push-daemon`'s.

---

## Feature parity target (what a developer does today on web)

1. **Sign in** — Google Sign-In, blocked with a clear message if not on the `allowlist` or `active:false`.
2. **My Submissions** — weekly task grid (Mon–Fri rows), submit/edit by week, list of past weeks.
3. **Apply for Leave** — all 6 developer-facing types (Casual Short/Full, Out Pass, Medical, Foreign Trip, Umrah), date picker (single/range/custom multi-date), half-day AM/PM + short-leave time for Casual Short, check-in/out time for Out Pass, rich-text reason, file attachments (→ Google Drive).
4. **My Leaves** — KPI tiles (Total/Approved/Rejected/Pending/Withdrawn), quarter tiles, monthly trend chart, full history list, withdraw a still-pending request.
5. **Uninformed Leave** — a banner the moment a manager flags an absence; an "Explain" screen (rich-text B/I/U editor, same shape as `resolutionHtml` elsewhere) that submits `status: "explained"`; visibility into a manager's rejection note if sent back.
6. **Notifications** — v1 ships via the existing **email** paths (`push-daemon` already emails on decision/report/rejection — nothing to build). FCM push to the developer's own device is a fast-follow (see below), not required for parity.

---

## Rich text: match the existing HTML shape, don't invent a new one

Three surfaces already read/write `reasonHtml` / `resolutionHtml` / `explanationHtml` / `rejectionNote` as HTML strings: the web app's `contenteditable` boxes, the Kotlin app's custom `RichTextEditor` (`ui/common/RichTextEditor.kt`), and `push-daemon/emailTemplate.js`'s rendering of them in emails.

**Match the Kotlin app's shape, not the web app's** — the web editor supports strikethrough/color/highlight/lists, which is more than any other consumer (Android's `HtmlText`, the emails) actually renders distinctly. The Kotlin app's `buildRichTextHtml()` produces exactly:
```
<p>{escaped text with <b>/<i>/<u> spans, \n → <br/>}</p>
```
Build the Flutter editor to the same B/I/U-only feature set and emit the same shape (a simple `TextField` + a small span-tracking model, same idea as `RichTextEditor.kt`, not a full rich-text package). For **rendering** HTML back (the reported reason on an uninformed-leave banner, a manager's decision note isn't HTML — see below), use the `flutter_widget_from_html` or `flutter_html` package.

One field is **not** HTML despite being adjacent to ones that are: `decisionNote` on `leaveRequests` is plain text everywhere (see the bug fixed this session in `push-daemon/index.js` — it must never contain markup). Render it as plain `Text`, never through an HTML widget.

---

## Suggested project structure

```
mobile-app/                          # new Flutter project root
  lib/
    main.dart
    core/
      theme/app_theme.dart           # ColorScheme + AppColors, see Theming below
      firebase/firebase_options.dart # generated by `flutterfire configure`
      auth/auth_gate.dart            # allowlist check, mirrors app.js's onAuthStateChanged gate
    data/
      models/                       # LeaveRequest, UninformedLeave, Submission, AllowlistEntry
      repositories/                 # LeaveRepository, SubmissionRepository, UninformedLeaveRepository
                                      # (mirrors LeaveApiClient.kt one-for-one — same method names
                                      #  where practical, so the two codebases stay easy to compare)
    features/
      submissions/                  # My Submissions: list + weekly grid editor
      leave/
        apply/                      # Apply for Leave form
        my_leaves/                  # KPIs, quarter tiles, trend chart, history
      uninformed_leave/             # banner + explain screen
      push/                         # token registration, foreground notification handling
    widgets/
      rich_text_editor.dart         # the B/I/U editor described above
      period_chip.dart, segmented_control.dart, kpi_tile.dart  # ports of the Compose equivalents
  ios/                              # generated by `flutter create`, built later on macOS
  android/                          # generated by `flutter create`
```

### State management

Recommend **Riverpod** (`flutter_riverpod`). It's the closest idiomatic match to the Kotlin app's `ViewModel` + `StateFlow` pattern you already know: a `StreamProvider` wrapping a Firestore snapshot listener is the direct equivalent of `LeaveApiClient.listenLeaveRequests` feeding a `MutableStateFlow`, and `AsyncNotifier` covers the mutation methods (`report()`, `resolve()`, `withdraw()`, etc.) the same way `ReportViewModel`'s suspend functions do today. `Provider` (the simpler predecessor) is a fine fallback if Riverpod's learning curve isn't worth it for a single developer-facing app.

### Firebase packages

`firebase_core`, `firebase_auth`, `cloud_firestore`, `firebase_messaging`, `google_sign_in` (for the Drive scope), `googleapis`/`googleapis_auth` (Drive v3 upload), `flutter_local_notifications` (foreground push display), `flutter_widget_from_html` (HTML rendering).

---

## Theming — same look, translated to Flutter's system

Flutter's `ThemeData`/`ColorScheme` doesn't have as many semantic slots as this app needs, so mirror the Kotlin app's approach exactly: a `ColorScheme` for the handful of roles Material widgets read automatically, plus a flat `AppColors` class for everything else (status/type/duration colors) — a direct Dart translation of `Color.kt`, same hex values, so all three surfaces (web, Kotlin app, Flutter app) stay visually identical:

```dart
class AppColors {
  static const techEwOrange = Color(0xFFEA580C);
  static const techEwOrangeDark = Color(0xFFC2410C);

  static const statusRequested = Color(0xFF92400E);
  static const statusRequestedBg = Color(0xFFFEF3C7);
  static const statusApproved = Color(0xFF166534);
  static const statusApprovedBg = Color(0xFFDCFCE7);
  static const statusRejected = Color(0xFFB91C1C);
  static const statusRejectedBg = Color(0xFFFFE2E3);
  static const statusWithdrawn = Color(0xFF49454F);
  static const statusWithdrawnBg = Color(0xFFE7E0EB);

  static const typeForeignTrip = Color(0xFF3B5BDB);
  static const typeForeignTripBg = Color(0xFFE8EDFC);
  static const typeUmrah = Color(0xFF0E8A7D);
  static const typeUmrahBg = Color(0xFFDFF2EF);
  static const typeMedical = Color(0xFF0B7FA8);
  static const typeMedicalBg = Color(0xFFDFF0F8);
  static const typeCasual = Color(0xFF6C4CC4);
  static const typeCasualBg = Color(0xFFEDE7FA);

  static const durationShort = Color(0xFF0369A1);
  static const durationShortBg = Color(0xFFE3EFF8);
  static const durationFull = Color(0xFF3730A3);
  static const durationFullBg = Color(0xFFE9E8F8);
  static const durationOutPass = Color(0xFF0F766E);
  static const durationOutPassBg = Color(0xFFE3F4F2);

  // Neutral scale (SignIn*Light in Color.kt) - background/surface/text/borders
  static const bg = Color(0xFFF6F6F4);
  static const surface = Color(0xFFFFFFFF);
  static const surface2 = Color(0xFFECEBE8);
  static const surface3 = Color(0xFFE0DEDA);
  static const ink900 = Color(0xFF131316);
  static const ink700 = Color(0xFF75757A);
  static const line = Color(0xFFE6E4DF);
  static const lineStrong = Color(0xFFD1CFC9);
  static const brandTint = Color(0xFFFFE9DA);
}

final appColorScheme = ColorScheme.light(
  primary: AppColors.techEwOrange,
  onPrimary: Colors.white,
  primaryContainer: AppColors.brandTint,
  onPrimaryContainer: AppColors.techEwOrangeDark,
  surface: AppColors.surface,
  onSurface: AppColors.ink900,
  surfaceContainerHighest: AppColors.surface3,
  outline: AppColors.lineStrong,
  outlineVariant: AppColors.line,
  error: AppColors.statusRejected,
);
```

Card styling (thin hairline outline, no shadow, white-on-off-white) and typography (system font stack, same weight/scale conventions as the Compose screens) should carry over the same way — outline-driven separation instead of elevation/shadow, matching every other surface in this product.

---

## Development workflow & visualization (Android Studio → Flutter)

You keep Android Studio — Flutter has an **official first-party plugin** for it (Preferences → Plugins → search "Flutter", which pulls in the Dart plugin too). Same IDE, same emulator (AVD) you already use, no new install beyond the plugin + the Flutter SDK itself.

What's different from Compose:

- **Hot reload replaces `@Preview`.** Instead of a static preview of one composable, you run the real app on the emulator/device and every saved file pushes the change into the *running* app in under a second, state preserved (you stay on whatever screen you were testing). It's arguably a tighter loop than Compose Preview, since you're always looking at the actual live app, not an isolated preview surface.
- **Flutter DevTools** (opens as a browser tab, launched from Android Studio's Flutter panel or `dart devtools` from a terminal) replaces Layout Inspector: a **Widget Inspector** for the visual tree, a **Performance** view, a **Network** view (handy for watching Firestore/Drive calls), and a structured log console.
- **Isolated widget preview** (the actual `@Preview`-equivalent) isn't built into core Flutter, but the `widgetbook` package gives you the same "render one widget in isolation with mock data" workflow if you want it for the reusable pieces (`PeriodChip`, `KpiTile`, etc.) — optional, add later if useful rather than up front.
- Running on a **physical Android device**: identical to today (USB debugging, `flutter run` or Android Studio's Run button).
- Running on **iOS**: once you're on a Mac, the same Android Studio (or VS Code) Flutter plugin drives the iOS Simulator identically — no separate tool to learn, Xcode is only needed for the underlying simulator runtime and the final signing/build step.

---

## Build & ship

```bash
flutter build apk --release      # sideloadable Android build, same distribution as today's Kotlin app
flutter build appbundle          # only needed if/when this goes to Play Store
flutter build ipa                # macOS + Xcode only, deferred until you're on a Mac
```

For an internal tool, `flutter build apk --release` is almost certainly the right v1 distribution path (matches how the Kotlin app is shared today) — Play Store/App Store listing brings real overhead (developer accounts, store review, privacy policy) that a 14-person internal team likely doesn't need. Revisit Play Store/TestFlight distribution once the app is proven out, not before.

### iOS checklist for later (on your Mac)

1. Apple Developer Program enrollment ($99/yr) if distributing beyond your own device.
2. Xcode installed, `flutter doctor` reporting no iOS toolchain issues.
3. `flutterfire configure` re-run to generate the iOS Firebase config (`GoogleService-Info.plist`) alongside the existing Android one.
4. Signing: either your personal team (free, device-limited, for your own testing) or the paid program + TestFlight for wider internal distribution.

---

## Suggested build order

1. Scaffold (`flutter create`), `flutterfire configure` for Android, theme (`AppColors`/`ColorScheme`), Google Sign-In + allowlist gate — verify sign-in/reject-if-not-allowlisted end to end.
2. Read-only screens first: My Submissions history, My Leaves (KPIs/quarter tiles/trend chart/history) — pure Firestore listeners, no writes yet, lowest risk.
3. Write flows: submit/edit a weekly task grid, Apply for Leave (incl. Drive attachment upload), withdraw a request.
4. Uninformed Leave: banner + explain screen.
5. Push token registration (`pushTokens` write) + foreground notification display.
6. Polish pass against the theme above, real-device testing, `flutter build apk --release` for internal distribution.
7. iOS build once a Mac is available, following the checklist above.

## Future work (not required for v1)

- **FCM push to developers**, not just email: `push-daemon`'s `handleDecidedRequest`/`handleReportedUninformedLeave`/`handleRejectedExplanation` would need to also look up the developer's own `pushTokens` (today only owners/managers receive push) and send a multicast the same way `handleNewRequest` already does for managers. Small, additive change to `push-daemon/index.js` — worth doing once the Flutter app is live and tokens exist to send to.
- Flutter Web (explicitly declined for now — web stays vanilla JS/Tailwind).
