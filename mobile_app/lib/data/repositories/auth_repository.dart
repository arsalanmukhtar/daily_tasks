import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../models/allowlist_entry.dart';

/// Same gate as app.js's onAuthStateChanged (app.js:3205-3261): sign in with
/// Google, then check `allowlist/{email}` exists and active != false before
/// letting the user into the app. Also holds the `drive.file` OAuth scope
/// (app.js:52) needed later for uploading leave attachments to the
/// requester's own Drive.
class AuthRepository {
  AuthRepository({FirebaseAuth? auth, FirebaseFirestore? firestore, GoogleSignIn? googleSignIn})
      : _auth = auth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirebaseFirestore.instance,
        _googleSignIn = googleSignIn ??
            GoogleSignIn(
              scopes: ['email', 'https://www.googleapis.com/auth/drive.file'],
            );

  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  final GoogleSignIn _googleSignIn;

  Stream<User?> get authStateChanges => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;
  String currentEmail() => _auth.currentUser?.email?.toLowerCase() ?? '';

  /// Result of a sign-in attempt: either a resolved allowlist entry, or a
  /// human-readable reason access was denied - mirrors the two failure
  /// branches in app.js's onAuthStateChanged (not allowlisted / inactive).
  Future<({AllowlistEntry? entry, String? deniedReason})> signIn() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) {
      return (entry: null, deniedReason: null); // user cancelled - not an error
    }
    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    final userCredential = await _auth.signInWithCredential(credential);
    final email = userCredential.user?.email?.toLowerCase();
    if (email == null) {
      return (entry: null, deniedReason: 'Could not read your Google account email.');
    }
    return checkAllowlist(email);
  }

  Future<({AllowlistEntry? entry, String? deniedReason})> checkAllowlist(String email) async {
    final doc = await _firestore.collection('allowlist').doc(email).get();
    if (!doc.exists) {
      await signOut();
      return (entry: null, deniedReason: "The account $email isn't authorized. Contact your manager.");
    }
    final entry = AllowlistEntry.fromDoc(doc);
    if (!entry.active) {
      await signOut();
      return (entry: null, deniedReason: "The account $email isn't authorized. Contact your manager.");
    }
    return (entry: entry, deniedReason: null);
  }

  /// The access token from the Drive scope granted at sign-in, for the
  /// attachment-upload repository - refreshed silently if still valid.
  Future<String?> driveAccessToken() async {
    final account = _googleSignIn.currentUser ?? await _googleSignIn.signInSilently();
    final auth = await account?.authentication;
    return auth?.accessToken;
  }

  Future<void> signOut() async {
    await Future.wait([_auth.signOut(), _googleSignIn.signOut()]);
  }
}
