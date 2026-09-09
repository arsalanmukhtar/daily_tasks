// The default counter-app smoke test doesn't apply here, and pumping the
// real TechEwApp widget needs Firebase.initializeApp() first (main.dart),
// which isn't available in a plain widget test without mocking
// firebase_core - see https://firebase.google.com/docs/flutter/unit-testing
// if/when this project wants real widget tests.

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('placeholder - see comment above for why there is no app-level widget test yet', () {
    expect(1 + 1, 2);
  });
}
