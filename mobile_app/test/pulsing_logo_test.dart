import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dailytasks/widgets/pulsing_logo.dart';

void main() {
  testWidgets('renders and animates without throwing across several frames', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Center(child: PulsingLogo()))));
    expect(find.byType(PulsingLogo), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);

    // Advance well past one full pulse cycle (2400ms) and partway through
    // the rotation (16s) - if either AnimationController or the ring math
    // ever throws (e.g. a bad lerp/opacity value), this catches it.
    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }
  });
}
