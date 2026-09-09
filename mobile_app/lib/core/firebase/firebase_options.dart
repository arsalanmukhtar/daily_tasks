// PLACEHOLDER - generated files are never hand-written in a real Flutter
// project. Replace this entire file by running, once, from mobile_app/:
//
//   dart pub global activate flutterfire_cli
//   flutterfire configure --project=devteam-daily-tasks
//
// That command needs YOUR Firebase login (`firebase login` first if you
// haven't already) since it registers new Android/iOS app entries under the
// existing `devteam-daily-tasks` project - see PROJECT.md's "Firebase setup"
// section for the exact package/bundle IDs to use (com.techew.dailytasks)
// so this stays a clean second app alongside the existing
// com.techew.leaveapprovals (manager) registration.
//
// It will overwrite this file with real, working DefaultFirebaseOptions for
// every platform you configure, plus drop android/app/google-services.json
// and ios/Runner/GoogleService-Info.plist into place automatically.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'dart:io' show Platform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (Platform.isAndroid) return android;
    if (Platform.isIOS) return ios;
    throw UnsupportedError(
      'DefaultFirebaseOptions have not been configured for this platform - '
      'run `flutterfire configure` (see the comment at the top of this file).',
    );
  }

  // TODO(flutterfire-configure): replaced automatically once you run
  // `flutterfire configure` - do not fill these in by hand.
  static const android = FirebaseOptions(
    apiKey: 'REPLACE_ME',
    appId: 'REPLACE_ME',
    messagingSenderId: '690432267181', // same project_number as android-app/app/google-services.json
    projectId: 'devteam-daily-tasks',
    storageBucket: 'devteam-daily-tasks.firebasestorage.app',
  );

  static const ios = FirebaseOptions(
    apiKey: 'REPLACE_ME',
    appId: 'REPLACE_ME',
    messagingSenderId: '690432267181',
    projectId: 'devteam-daily-tasks',
    storageBucket: 'devteam-daily-tasks.firebasestorage.app',
    iosBundleId: 'com.techew.dailytasks',
  );
}
