// The default counter-app smoke test doesn't apply here, and pumping the
// real TechEwApp widget hits the live REST API (ApiClient/RealtimeClient
// have no test doubles yet) - see PROJECT.md if/when this project wants
// real widget tests (would need fake ApiClient/RealtimeClient injected via
// Riverpod overrides).

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('placeholder - see comment above for why there is no app-level widget test yet', () {
    expect(1 + 1, 2);
  });
}
