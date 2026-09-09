# Tech EW Mobile (developer app)

Flutter/Dart app for developers - the mobile counterpart to what they use on the web app today (weekly task submissions + leave). See [PROJECT.md](../PROJECT.md) at the repo root for the full architecture writeup.

This talks directly to the same Firebase project (`devteam-daily-tasks`) the web app and the native Kotlin manager app already use - no new backend, no `firestore.rules` changes.

## One-time setup (do this before your first `flutter run`)

`lib/core/firebase/firebase_options.dart` is currently a **placeholder** - it has fake keys and will fail at `Firebase.initializeApp()`. Replace it for real:

```bash
dart pub global activate flutterfire_cli
firebase login          # your own Google account, needs access to devteam-daily-tasks
cd mobile_app
flutterfire configure --project=devteam-daily-tasks
```

When prompted, register this as a **new** app (don't reuse the existing `com.techew.leaveapprovals` one - that's the manager's Kotlin app). Use:

- Android package name: `com.techew.dailytasks`
- iOS bundle ID: `com.techew.dailytasks`

This overwrites `firebase_options.dart` with real values and drops `android/app/google-services.json` (and, once you configure iOS, `ios/Runner/GoogleService-Info.plist`) into place automatically.

## Running

```bash
flutter pub get
flutter run                # picks whatever device/emulator is connected
```

## Building

```bash
flutter build apk --release      # sideloadable Android build
flutter build appbundle          # only if/when this goes to Play Store
flutter build ipa                # macOS + Xcode only - see PROJECT.md's iOS checklist
```

## What's here vs. what's deferred

Built: sign-in + allowlist gate, theme matching the rest of the product, weekly task submissions (list + grid editor), Apply for Leave (all 6 developer-facing types), My Leaves (KPIs + history + withdraw), the Uninformed Leave banner + explain flow, FCM token registration.

Deferred (see PROJECT.md's "Future work" and the scope notes in `apply_leave_screen.dart`/`weekly_grid_screen.dart`):
- Attachment upload UI (the Drive upload logic itself is written in `AttachmentRepository` - it just isn't wired to a file picker yet; `file_picker`'s current AAR conflicts with this Flutter version's transitive Android deps and was left out for now).
- Custom (non-contiguous) multi-date leave picking - single day / contiguous range only for now.
- Per-day rich text (Bold/Italic/Underline) in the weekly grid - cells are plain text for now; the reason boxes on leave/uninformed-leave screens do have the full B/I/U editor.
- push-daemon sending FCM push to developers (today it only pushes to managers) - tokens are already being registered, so this is a small daemon-side change whenever you want it.

## Known local dev gotcha (Windows)

If a build fails with `Could not close incremental caches` from a Kotlin compile task, that's a flaky Windows/Kotlin-incremental-compiler issue, not a real code problem - `android/gradle.properties` already sets `kotlin.incremental=false` to avoid it. If you ever remove that line and hit the error again, `cd android && ./gradlew --stop` then retry.
