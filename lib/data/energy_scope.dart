import 'package:flutter/widgets.dart';

import 'energy_provider.dart';

/// Inherited scope — pages rebuild whenever the provider ticks.
class EnergyScope extends InheritedNotifier<EnergyProvider> {
  const EnergyScope({super.key, required EnergyProvider provider, required super.child})
      : super(notifier: provider);

  static EnergyProvider of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<EnergyScope>()!.notifier!;
}
