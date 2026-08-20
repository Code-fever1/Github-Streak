import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltix/main.dart';

void main() {
  testWidgets('Voltix app renders home shell', (WidgetTester tester) async {
    await tester.pumpWidget(const VoltixApp());
    await tester.pump();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('History'), findsOneWidget);
    expect(find.text('Devices'), findsOneWidget);
    expect(find.text('Alerts'), findsOneWidget);
    expect(find.text('More'), findsOneWidget);

    // Unmount so the provider (timers + SSE) is disposed cleanly.
    await tester.pumpWidget(const SizedBox());
  });
}