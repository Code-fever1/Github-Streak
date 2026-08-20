// Data models mirroring the Voltix backend contract.
// Frontend-only for now — values come from the mock provider.

class InverterTelemetry {
  final double solarW, solarV, solarA;
  final double pv1V, pv1A, pv1W;
  final double pv2V, pv2A, pv2W;
  final double gridW, gridV, gridHz;
  final bool gridConnected;
  final String gridDirection; // import | export
  final double loadW, loadVa, loadPercent;
  final double acOutV, acOutHz;
  final String inverterMode, inverterFault;
  final double temperatureC;
  final double ratedOutputW;
  final double? signal;
  final String? firmware;
  final bool isOnline, isLive;

  const InverterTelemetry({
    this.solarW = 0, this.solarV = 0, this.solarA = 0,
    this.pv1V = 0, this.pv1A = 0, this.pv1W = 0,
    this.pv2V = 0, this.pv2A = 0, this.pv2W = 0,
    this.gridW = 0, this.gridV = 0, this.gridHz = 50,
    this.gridConnected = false, this.gridDirection = 'import',
    this.loadW = 0, this.loadVa = 0, this.loadPercent = 0,
    this.acOutV = 230, this.acOutHz = 50,
    this.inverterMode = 'S', this.inverterFault = 'NO',
    this.temperatureC = 0, this.ratedOutputW = 3000,
    this.signal, this.firmware,
    this.isOnline = true, this.isLive = true,
  });

  InverterTelemetry copyWith({double? solarW, double? loadW, double? gridW, double? solarV, double? solarA}) =>
      InverterTelemetry(
        solarW: solarW ?? this.solarW, solarV: solarV ?? this.solarV, solarA: solarA ?? this.solarA,
        pv1V: pv1V, pv1A: pv1A, pv1W: (solarW ?? this.solarW) >= 100 ? (solarW ?? this.solarW) * 0.62 : pv1W,
        pv2V: pv2V, pv2A: pv2A, pv2W: pv2W,
        gridW: gridW ?? this.gridW, gridV: gridV, gridHz: gridHz,
        gridConnected: gridConnected, gridDirection: gridDirection,
        loadW: loadW ?? this.loadW, loadVa: loadVa, loadPercent: loadPercent,
        acOutV: acOutV, acOutHz: acOutHz,
        inverterMode: inverterMode, inverterFault: inverterFault,
        temperatureC: temperatureC, ratedOutputW: ratedOutputW,
        signal: signal, firmware: firmware, isOnline: isOnline, isLive: isLive,
      );
}

class TomznLive {
  final double energyKwh, voltageV, currentA, powerW, frequencyHz;
  final bool isOnline, switchOn;
  final int faultCode;
  final bool isLive;

  const TomznLive({
    this.energyKwh = 0, this.voltageV = 0, this.currentA = 0,
    this.powerW = 0, this.frequencyHz = 50,
    this.isOnline = true, this.switchOn = true, this.faultCode = 0,
    this.isLive = true,
  });

  TomznLive copyWith({double? powerW, double? currentA}) => TomznLive(
        energyKwh: energyKwh, voltageV: voltageV, currentA: currentA ?? this.currentA,
        powerW: powerW ?? this.powerW, frequencyHz: frequencyHz,
        isOnline: isOnline, switchOn: switchOn, faultCode: faultCode, isLive: isLive,
      );
}

class MeterState {
  final String id; // meter1 | meter2
  final String label; // Meter 1 (Analog)
  final bool isDigital;
  final double reading; // kWh
  final double remainingUnits;
  final double targetUnits;
  final double todayUsage;
  final double projectedDaysLeft;
  final double projectedMonthly;
  final double healthScore; // 0-100
  final double averageDaily;
  final double lastLoggedReading;
  final int lastLoggedAt; // epoch seconds (0 = never)

  const MeterState({
    required this.id, required this.label, required this.isDigital,
    required this.reading, required this.remainingUnits, required this.targetUnits,
    required this.todayUsage, required this.projectedDaysLeft, required this.projectedMonthly,
    required this.healthScore, required this.averageDaily,
    this.lastLoggedReading = 0, this.lastLoggedAt = 0,
  });
}

class ManualLog {
  final String id;
  final int timestamp; // epoch seconds
  final String meterId;
  final double reading;
  final String? notes;

  const ManualLog({required this.id, required this.timestamp, required this.meterId, required this.reading, this.notes});
}

class HomeState {
  final double todayUsage; // units
  final double averageDaily;
  final double projectedMonthly;
  final double confidencePercent;
  final String trend; // increasing | decreasing | stable
  final double? yesterdayUsage;
  final double? usageChangePercent;
  final String loadStatus; // Low | Normal | High
  final double normalDrawKw;
  final double combinedDaysLeft;
  final double? lastMonthTotal;
  final double? vsLastMonthPercent;
  final double periodDay, periodNight, periodMorningEvening;

  const HomeState({
    this.todayUsage = 0, this.averageDaily = 0, this.projectedMonthly = 0,
    this.confidencePercent = 0, this.trend = 'stable',
    this.yesterdayUsage, this.usageChangePercent, this.loadStatus = 'Normal',
    this.normalDrawKw = 0, this.combinedDaysLeft = 0,
    this.lastMonthTotal, this.vsLastMonthPercent,
    this.periodDay = 0, this.periodNight = 0, this.periodMorningEvening = 0,
  });
}

class EnergyToday {
  final double solarKwh, homeKwh, gridKwh;
  const EnergyToday({this.solarKwh = 0, this.homeKwh = 0, this.gridKwh = 0});
}

class FlowPoint {
  final int timestamp; // epoch seconds
  final double? solarKw, gridKw, loadKw;
  const FlowPoint({required this.timestamp, this.solarKw, this.gridKw, this.loadKw});
}
