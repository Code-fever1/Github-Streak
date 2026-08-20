import 'package:flutter_test/flutter_test.dart';

import 'package:voltix/main.dart';

void main() {
  testWidgets('Voltix app renders home shell', (WidgetTester tester) async {
    await tester.pumpWidget(const VoltixApp());
    await tester.pump();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Energy'), findsOneWidget);
    expect(find.text('Summary'), findsOneWidget);
    expect(find.text('Logs'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);
  });
}
