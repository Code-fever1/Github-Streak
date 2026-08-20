// Data models mirroring the Voltix backend contract (/api/solar/dashboard
// and /api/solar/live). Parsed from the same JSON the React Native app consumes.

typedef MeterId = String; // 'meter1' | 'meter2'
typedef QueueStatus = String; // 'ACTIVE' | 'NEXT' | 'QUEUED'

double _d(Map<String, dynamic> j, String k, [double v = 0]) =>
    (j[k] as num?)?.toDouble() ?? v;
int _i(Map<String, dynamic> j, String k, [int v = 0]) =>
    (j[k] as num?)?.toInt() ?? v;
bool _b(Map<String, dynamic> j, String k, [bool v = false]) =>
    j[k] as bool? ?? v;
String _s(Map<String, dynamic> j, String k, [String v = '']) =>
    (j[k] as String?) ?? v;

class GridFlow {
  final String mode; // hybrid | on-grid | bypass | night
  final String direction; // import | export | idle
  final double homeW;
  final double gridExchangeW; // + import, - export
  final double solarW;
  final double loadW;
  final bool? ups;
  final MeterId? activeMeter;

  const GridFlow({
    this.mode = 'hybrid',
    this.direction = 'idle',
    this.homeW = 0,
    this.gridExchangeW = 0,
    this.solarW = 0,
    this.loadW = 0,
    this.ups,
    this.activeMeter,
  });

  factory GridFlow.fromJson(Map<String, dynamic> j) => GridFlow(
        mode: _s(j, 'mode', 'hybrid'),
        direction: _s(j, 'direction', 'idle'),
        homeW: _d(j, 'homeW'),
        gridExchangeW: _d(j, 'gridExchangeW'),
        solarW: _d(j, 'solarW'),
        loadW: _d(j, 'loadW'),
        ups: j['ups'] as bool?,
        activeMeter: j['activeMeter'] as MeterId?,
      );
}

class LiveTelemetry {
  final double gridKw;
  final double solarKw, homeKw;
  final double currentAmp, voltage, frequency, powerFactor;

  const LiveTelemetry({
    this.gridKw = 0,
    this.solarKw = 0,
    this.homeKw = 0,
    this.currentAmp = 0,
    this.voltage = 0,
    this.frequency = 50,
    this.powerFactor = 0,
  });

  factory LiveTelemetry.fromJson(Map<String, dynamic> j) => LiveTelemetry(
        gridKw: _d(j, 'gridKw'),
        solarKw: _d(j, 'solarKw'),
        homeKw: _d(j, 'homeKw'),
        currentAmp: _d(j, 'currentAmp'),
        voltage: _d(j, 'voltage'),
        frequency: _d(j, 'frequency', 50),
        powerFactor: _d(j, 'powerFactor'),
      );
}

class InverterTelemetry {
  final double solarW, solarV, solarA;
  final double pv1V, pv1A, pv1W;
  final double pv2V, pv2A, pv2W;
  final double gridW, gridWRaw, gridV, gridHz;
  final bool gridConnected;
  final String gridDirection; // import | export
  final double loadW, loadVa, loadPercent;
  final double acOutV, acOutHz;
  final String inverterMode, inverterFault;
  final double temperatureC, ratedOutputW;
  final double? signal;
  final String? firmware, sourceTime;
  final String fetchedAt;
  final bool isLive, isOnline;

  const InverterTelemetry({
    this.solarW = 0, this.solarV = 0, this.solarA = 0,
    this.pv1V = 0, this.pv1A = 0, this.pv1W = 0,
    this.pv2V = 0, this.pv2A = 0, this.pv2W = 0,
    this.gridW = 0, this.gridWRaw = 0, this.gridV = 0, this.gridHz = 0,
    this.gridConnected = false, this.gridDirection = 'import',
    this.loadW = 0, this.loadVa = 0, this.loadPercent = 0,
    this.acOutV = 0, this.acOutHz = 0,
    this.inverterMode = 'unknown', this.inverterFault = 'UNKNOWN',
    this.temperatureC = 0, this.ratedOutputW = 0,
    this.signal, this.firmware, this.sourceTime,
    this.fetchedAt = '', this.isLive = false, this.isOnline = false,
  });

  factory InverterTelemetry.fromJson(Map<String, dynamic> j) =>
      InverterTelemetry(
        solarW: _d(j, 'solarW'), solarV: _d(j, 'solarV'), solarA: _d(j, 'solarA'),
        pv1V: _d(j, 'pv1V'), pv1A: _d(j, 'pv1A'), pv1W: _d(j, 'pv1W'),
        pv2V: _d(j, 'pv2V'), pv2A: _d(j, 'pv2A'), pv2W: _d(j, 'pv2W'),
        gridW: _d(j, 'gridW'), gridWRaw: _d(j, 'gridWRaw'),
        gridV: _d(j, 'gridV'), gridHz: _d(j, 'gridHz'),
        gridConnected: _b(j, 'gridConnected'),
        gridDirection: _s(j, 'gridDirection', 'import'),
        loadW: _d(j, 'loadW'), loadVa: _d(j, 'loadVa'),
        loadPercent: _d(j, 'loadPercent'),
        acOutV: _d(j, 'acOutV'), acOutHz: _d(j, 'acOutHz'),
        inverterMode: _s(j, 'inverterMode', 'unknown'),
        inverterFault: _s(j, 'inverterFault', 'UNKNOWN'),
        temperatureC: _d(j, 'temperatureC'), ratedOutputW: _d(j, 'ratedOutputW'),
        signal: (j['signal'] as num?)?.toDouble(),
        firmware: j['firmware'] as String?,
        sourceTime: j['sourceTime'] as String?,
        fetchedAt: _s(j, 'fetchedAt'),
        isLive: _b(j, 'isLive'), isOnline: _b(j, 'isOnline'),
      );
}

class TomznLive {
  final double energyKwh, voltageV, currentA, powerW, frequencyHz;
  final String powerDisplay;
  final bool isOnline, switchOn;
  final int faultCode;
  final String fetchedAt;
  final bool isLive;
  final int? timestamp;
  final MeterId? activeMeter;

  const TomznLive({
    this.energyKwh = 0, this.voltageV = 0, this.currentA = 0,
    this.powerW = 0, this.powerDisplay = '-- W', this.frequencyHz = 50,
    this.isOnline = false, this.switchOn = false, this.faultCode = 0,
    this.fetchedAt = '', this.isLive = false,
    this.timestamp, this.activeMeter,
  });

  factory TomznLive.fromJson(Map<String, dynamic> j) => TomznLive(
        energyKwh: _d(j, 'energyKwh'), voltageV: _d(j, 'voltageV'),
        currentA: _d(j, 'currentA'), powerW: _d(j, 'powerW'),
        powerDisplay: _s(j, 'powerDisplay', '-- W'),
        frequencyHz: _d(j, 'frequencyHz', 50),
        isOnline: _b(j, 'isOnline'), switchOn: _b(j, 'switchOn'),
        faultCode: _i(j, 'faultCode'), fetchedAt: _s(j, 'fetchedAt'),
        isLive: _b(j, 'isLive'),
        timestamp: (j['timestamp'] as num?)?.toInt(),
        activeMeter: j['activeMeter'] as MeterId?,
      );

  TomznLive copyWith({
    double? energyKwh, double? powerW, bool? isOnline, bool? isLive,
    String? powerDisplay,
  }) =>
      TomznLive(
        energyKwh: energyKwh ?? this.energyKwh,
        voltageV: voltageV, currentA: currentA,
        powerW: powerW ?? this.powerW,
        powerDisplay: powerDisplay ?? this.powerDisplay,
        frequencyHz: frequencyHz,
        isOnline: isOnline ?? this.isOnline,
        switchOn: switchOn, faultCode: faultCode,
        fetchedAt: fetchedAt, isLive: isLive ?? this.isLive,
        timestamp: timestamp, activeMeter: activeMeter,
      );
}

class WeatherState {
  final int code;
  final bool isDay;
  final double cloudCover, precipitation, temperatureC;
  final String? sunrise, sunset;
  final String fetchedAt;
  final bool isLive;

  const WeatherState({
    this.code = 0, this.isDay = true, this.cloudCover = 0,
    this.precipitation = 0, this.temperatureC = 0,
    this.sunrise, this.sunset, this.fetchedAt = '', this.isLive = false,
  });

  factory WeatherState.fromJson(Map<String, dynamic> j) => WeatherState(
        code: _i(j, 'code'),
        isDay: _b(j, 'isDay', true),
        cloudCover: _d(j, 'cloudCover'),
        precipitation: _d(j, 'precipitation'),
        temperatureC: _d(j, 'temperatureC'),
        sunrise: j['sunrise'] as String?,
        sunset: j['sunset'] as String?,
        fetchedAt: _s(j, 'fetchedAt'),
        isLive: _b(j, 'isLive'),
      );
}

class EnergyToday {
  final double solarKwh, homeKwh, gridKwh;
  const EnergyToday({this.solarKwh = 0, this.homeKwh = 0, this.gridKwh = 0});

  factory EnergyToday.fromJson(Map<String, dynamic> j) => EnergyToday(
        solarKwh: _d(j, 'solarKwh'), homeKwh: _d(j, 'homeKwh'),
        gridKwh: _d(j, 'gridKwh'),
      );
}

class EnergyFlowPoint {
  final int timestamp; // epoch ms
  final double? solarKw, gridKw, loadKw; // null = source offline

  const EnergyFlowPoint({required this.timestamp, this.solarKw, this.gridKw, this.loadKw});

  factory EnergyFlowPoint.fromJson(Map<String, dynamic> j) => EnergyFlowPoint(
        timestamp: _i(j, 'timestamp'),
        solarKw: (j['solarKw'] as num?)?.toDouble(),
        gridKw: (j['gridKw'] as num?)?.toDouble(),
        loadKw: (j['loadKw'] as num?)?.toDouble(),
      );
}

class DailyUsagePoint {
  final int timestamp;
  final String label;
  final double usage;

  const DailyUsagePoint({required this.timestamp, required this.label, required this.usage});

  factory DailyUsagePoint.fromJson(Map<String, dynamic> j) => DailyUsagePoint(
        timestamp: _i(j, 'timestamp'),
        label: _s(j, 'label'),
        usage: _d(j, 'usage'),
      );
}

class HourlyUsagePoint {
  final int timestamp;
  final double usage;

  const HourlyUsagePoint({required this.timestamp, required this.usage});

  factory HourlyUsagePoint.fromJson(Map<String, dynamic> j) => HourlyUsagePoint(
        timestamp: _i(j, 'timestamp'),
        usage: _d(j, 'usage'),
      );
}

class HomeState {
  final double todayUsage, averageDaily, expectedDrawNow;
  final double projectedMonthly, confidencePercent;
  final String trend; // increasing | decreasing | stable
  final String primaryPattern;
  final String explanation;
  final double? yesterdayUsage, usageChangePercent;
  final List<DailyUsagePoint> dailyUsage;
  final List<HourlyUsagePoint> hourlyUsage;
  final double? periodDay, periodNight, periodMorningEvening;
  final double? usageTrendPercent, usageTrendDelta;
  final double? normalDrawKw;
  final String? loadStatus, paceStatus;
  final double? outerRingScore, combinedDaysLeft, daysBuffer, combinedTarget;
  final double? lastMonthTotal, vsLastMonthPercent;

  const HomeState({
    this.todayUsage = 0, this.averageDaily = 0, this.expectedDrawNow = 0,
    this.projectedMonthly = 0, this.confidencePercent = 0,
    this.trend = 'stable', this.primaryPattern = 'transition',
    this.explanation = '',
    this.yesterdayUsage, this.usageChangePercent,
    this.dailyUsage = const [], this.hourlyUsage = const [],
    this.periodDay, this.periodNight, this.periodMorningEvening,
    this.usageTrendPercent, this.usageTrendDelta,
    this.normalDrawKw, this.loadStatus, this.paceStatus,
    this.outerRingScore, this.combinedDaysLeft, this.daysBuffer,
    this.combinedTarget, this.lastMonthTotal, this.vsLastMonthPercent,
  });

  factory HomeState.fromJson(Map<String, dynamic> j) => HomeState(
        todayUsage: _d(j, 'todayUsage'), averageDaily: _d(j, 'averageDaily'),
        expectedDrawNow: _d(j, 'expectedDrawNow'),
        projectedMonthly: _d(j, 'projectedMonthly'),
        confidencePercent: _d(j, 'confidencePercent'),
        trend: _s(j, 'trend', 'stable'),
        primaryPattern: _s(j, 'primaryPattern', 'transition'),
        explanation: _s(j, 'explanation'),
        yesterdayUsage: (j['yesterdayUsage'] as num?)?.toDouble(),
        usageChangePercent: (j['usageChangePercent'] as num?)?.toDouble(),
        dailyUsage: ((j['dailyUsage'] as List?) ?? const [])
            .map((e) => DailyUsagePoint.fromJson(e as Map<String, dynamic>))
            .toList(),
        hourlyUsage: ((j['hourlyUsage'] as List?) ?? const [])
            .map((e) => HourlyUsagePoint.fromJson(e as Map<String, dynamic>))
            .toList(),
        periodDay: (j['periodDay'] as num?)?.toDouble(),
        periodNight: (j['periodNight'] as num?)?.toDouble(),
        periodMorningEvening: (j['periodMorningEvening'] as num?)?.toDouble(),
        usageTrendPercent: (j['usageTrendPercent'] as num?)?.toDouble(),
        usageTrendDelta: (j['usageTrendDelta'] as num?)?.toDouble(),
        normalDrawKw: (j['normalDrawKw'] as num?)?.toDouble(),
        loadStatus: j['loadStatus'] as String?,
        paceStatus: j['paceStatus'] as String?,
        outerRingScore: (j['outerRingScore'] as num?)?.toDouble(),
        combinedDaysLeft: (j['combinedDaysLeft'] as num?)?.toDouble(),
        daysBuffer: (j['daysBuffer'] as num?)?.toDouble(),
        combinedTarget: (j['combinedTarget'] as num?)?.toDouble(),
        lastMonthTotal: (j['lastMonthTotal'] as num?)?.toDouble(),
        vsLastMonthPercent: (j['vsLastMonthPercent'] as num?)?.toDouble(),
      );

  HomeState copyWith({
    double? todayUsage, double? averageDaily, double? expectedDrawNow,
    double? projectedMonthly, double? confidencePercent, String? trend,
    String? explanation, double? lastMonthTotal, double? vsLastMonthPercent,
    List<DailyUsagePoint>? dailyUsage,
  }) =>
      HomeState(
        todayUsage: todayUsage ?? this.todayUsage,
        averageDaily: averageDaily ?? this.averageDaily,
        expectedDrawNow: expectedDrawNow ?? this.expectedDrawNow,
        projectedMonthly: projectedMonthly ?? this.projectedMonthly,
        confidencePercent: confidencePercent ?? this.confidencePercent,
        trend: trend ?? this.trend,
        primaryPattern: primaryPattern,
        explanation: explanation ?? this.explanation,
        yesterdayUsage: yesterdayUsage,
        usageChangePercent: usageChangePercent,
        dailyUsage: dailyUsage ?? this.dailyUsage,
        hourlyUsage: hourlyUsage,
        periodDay: periodDay, periodNight: periodNight,
        periodMorningEvening: periodMorningEvening,
        usageTrendPercent: usageTrendPercent, usageTrendDelta: usageTrendDelta,
        normalDrawKw: normalDrawKw, loadStatus: loadStatus,
        paceStatus: paceStatus, outerRingScore: outerRingScore,
        combinedDaysLeft: combinedDaysLeft, daysBuffer: daysBuffer,
        combinedTarget: combinedTarget,
        lastMonthTotal: lastMonthTotal ?? this.lastMonthTotal,
        vsLastMonthPercent: vsLastMonthPercent ?? this.vsLastMonthPercent,
      );
}

class MeterState {
  final MeterId id;
  final String label;
  final bool isDigital;
  final double reading, remainingUnits;
  final double? cycleUsage;
  final double targetUnits, driftOffset, averageError;
  final int calibrationCount;
  final double? calibrationFactor, calibrationConfidence;
  final QueueStatus queueStatus;
  final double projectedDaysLeft, projectedSlabDate;
  final double? startsAfterDate;
  final double projectedMonthly;
  final int? lastLoggedAt; // epoch ms
  final double? lastLoggedReading;
  final double averageDaily, averageLast3Days, currentDaily, targetDaily;
  final double paceRatio;
  final String trendStatus; // improving | worsening | stable
  final double predictionConfidence, healthScore;
  final String healthColor, consumptionSpeedColor, remainingColor;
  final double consumptionSpeedScore;
  final double todayUsage, recentDailyAvg, expectedDrawNow;
  final String explanation;
  final double confidencePercent, minLikelyReading, maxLikelyReading;
  final String trend;

  const MeterState({
    required this.id, required this.label, this.isDigital = false,
    required this.reading, required this.remainingUnits,
    this.cycleUsage, required this.targetUnits,
    this.driftOffset = 0, this.averageError = 0, this.calibrationCount = 0,
    this.calibrationFactor, this.calibrationConfidence,
    this.queueStatus = 'QUEUED', this.projectedDaysLeft = 0,
    this.projectedSlabDate = 0, this.startsAfterDate,
    this.projectedMonthly = 0,
    this.lastLoggedAt, this.lastLoggedReading,
    this.averageDaily = 0, this.averageLast3Days = 0, this.currentDaily = 0,
    this.targetDaily = 0, this.paceRatio = 0, this.trendStatus = 'stable',
    this.predictionConfidence = 0, this.healthScore = 0,
    this.healthColor = '#64748B', this.consumptionSpeedScore = 0,
    this.consumptionSpeedColor = '#64748B', this.remainingColor = '#64748B',
    this.todayUsage = 0, this.recentDailyAvg = 0, this.expectedDrawNow = 0,
    this.explanation = '', this.confidencePercent = 0,
    this.minLikelyReading = 0, this.maxLikelyReading = 0,
    this.trend = 'stable',
  });

  factory MeterState.fromJson(Map<String, dynamic> j) => MeterState(
        id: _s(j, 'id', 'meter1'),
        label: _s(j, 'label', 'Meter'),
        isDigital: _b(j, 'isDigital'),
        reading: _d(j, 'reading'),
        remainingUnits: _d(j, 'remainingUnits'),
        cycleUsage: (j['cycleUsage'] as num?)?.toDouble(),
        targetUnits: _d(j, 'targetUnits', 200),
        driftOffset: _d(j, 'driftOffset'),
        averageError: _d(j, 'averageError'),
        calibrationCount: _i(j, 'calibrationCount'),
        calibrationFactor: (j['calibrationFactor'] as num?)?.toDouble(),
        calibrationConfidence: (j['calibrationConfidence'] as num?)?.toDouble(),
        queueStatus: _s(j, 'queueStatus', 'QUEUED'),
        projectedDaysLeft: _d(j, 'projectedDaysLeft'),
        projectedSlabDate: _d(j, 'projectedSlabDate'),
        startsAfterDate: (j['startsAfterDate'] as num?)?.toDouble(),
        projectedMonthly: _d(j, 'projectedMonthly'),
        lastLoggedAt: (j['lastLoggedAt'] as num?)?.toInt(),
        lastLoggedReading: (j['lastLoggedReading'] as num?)?.toDouble(),
        averageDaily: _d(j, 'averageDaily'),
        averageLast3Days: _d(j, 'averageLast3Days'),
        currentDaily: _d(j, 'currentDaily'),
        targetDaily: _d(j, 'targetDaily'),
        paceRatio: _d(j, 'paceRatio'),
        trendStatus: _s(j, 'trendStatus', 'stable'),
        predictionConfidence: _d(j, 'predictionConfidence'),
        healthScore: _d(j, 'healthScore'),
        healthColor: _s(j, 'healthColor', '#64748B'),
        consumptionSpeedScore: _d(j, 'consumptionSpeedScore'),
        consumptionSpeedColor: _s(j, 'consumptionSpeedColor', '#64748B'),
        remainingColor: _s(j, 'remainingColor', '#64748B'),
        todayUsage: _d(j, 'todayUsage'),
        recentDailyAvg: _d(j, 'recentDailyAvg'),
        expectedDrawNow: _d(j, 'expectedDrawNow'),
        explanation: _s(j, 'explanation'),
        confidencePercent: _d(j, 'confidencePercent'),
        minLikelyReading: _d(j, 'minLikelyReading'),
        maxLikelyReading: _d(j, 'maxLikelyReading'),
        trend: _s(j, 'trend', 'stable'),
      );

  MeterState copyWith({
    double? reading, double? remainingUnits, double? cycleUsage,
    double? projectedDaysLeft, double? projectedMonthly,
    double? todayUsage, double? currentDaily, double? confidencePercent,
    double? healthScore, double? predictionConfidence,
    double? consumptionSpeedScore, double? driftOffset, double? averageError,
    double? calibrationConfidence, String? healthColor,
    String? consumptionSpeedColor, String? remainingColor,
    String? trendStatus, String? trend, String? explanation,
    int? lastLoggedAt, double? lastLoggedReading,
    double? averageDaily, double? recentDailyAvg, double? expectedDrawNow,
    String? queueStatus,
  }) =>
      MeterState(
        id: id, label: label, isDigital: isDigital,
        reading: reading ?? this.reading,
        remainingUnits: remainingUnits ?? this.remainingUnits,
        cycleUsage: cycleUsage ?? this.cycleUsage,
        targetUnits: targetUnits,
        driftOffset: driftOffset ?? this.driftOffset,
        averageError: averageError ?? this.averageError,
        calibrationCount: calibrationCount,
        calibrationFactor: calibrationFactor,
        calibrationConfidence: calibrationConfidence ?? this.calibrationConfidence,
        queueStatus: queueStatus ?? this.queueStatus,
        projectedDaysLeft: projectedDaysLeft ?? this.projectedDaysLeft,
        projectedSlabDate: projectedSlabDate,
        startsAfterDate: startsAfterDate,
        projectedMonthly: projectedMonthly ?? this.projectedMonthly,
        lastLoggedAt: lastLoggedAt ?? this.lastLoggedAt,
        lastLoggedReading: lastLoggedReading ?? this.lastLoggedReading,
        averageDaily: averageDaily ?? this.averageDaily,
        averageLast3Days: averageLast3Days,
        currentDaily: currentDaily ?? this.currentDaily,
        targetDaily: targetDaily,
        paceRatio: paceRatio,
        trendStatus: trendStatus ?? this.trendStatus,
        predictionConfidence: predictionConfidence ?? this.predictionConfidence,
        healthScore: healthScore ?? this.healthScore,
        healthColor: healthColor ?? this.healthColor,
        consumptionSpeedScore: consumptionSpeedScore ?? this.consumptionSpeedScore,
        consumptionSpeedColor: consumptionSpeedColor ?? this.consumptionSpeedColor,
        remainingColor: remainingColor ?? this.remainingColor,
        todayUsage: todayUsage ?? this.todayUsage,
        recentDailyAvg: recentDailyAvg ?? this.recentDailyAvg,
        expectedDrawNow: expectedDrawNow ?? this.expectedDrawNow,
        explanation: explanation ?? this.explanation,
        confidencePercent: confidencePercent ?? this.confidencePercent,
        minLikelyReading: minLikelyReading,
        maxLikelyReading: maxLikelyReading,
        trend: trend ?? this.trend,
      );
}

class ManualLog {
  final String id;
  final int timestamp; // epoch ms
  final MeterId meterId;
  final double reading;
  final String? notes;

  const ManualLog({
    required this.id, required this.timestamp,
    required this.meterId, required this.reading, this.notes,
  });

  factory ManualLog.fromJson(Map<String, dynamic> j) => ManualLog(
        id: _s(j, 'id'),
        timestamp: _i(j, 'timestamp'),
        meterId: _s(j, 'meterId', 'meter1'),
        reading: _d(j, 'reading'),
        notes: j['notes'] as String?,
      );
}

class ManualBaseline {
  final double reading;
  final int cycleStartTs;

  const ManualBaseline({required this.reading, required this.cycleStartTs});

  factory ManualBaseline.fromJson(Map<String, dynamic> j) => ManualBaseline(
        reading: _d(j, 'reading'),
        cycleStartTs: _i(j, 'cycleStartTs'),
      );
}

class HistoryPoint {
  final String time;
  final double meter1, meter2, voltage;

  const HistoryPoint({
    required this.time, this.meter1 = 0, this.meter2 = 0, this.voltage = 0,
  });
}

class UpsState {
  final bool active;
  final String label;
  const UpsState({this.active = false, this.label = ''});

  factory UpsState.fromJson(Map<String, dynamic> j) =>
      UpsState(active: _b(j, 'active'), label: _s(j, 'label'));
}

/// Full dashboard snapshot — the shape of GET /api/solar/dashboard
/// (identical to CachedDashboardSnapshot in the RN app).
class DashboardSnapshot {
  final String? generatedAt;
  final MeterId activeMeter;
  final ChangeoverState changeover;
  final TomznLive tomznLive;
  final InverterTelemetry? inverter;
  final WeatherState? weather;
  final EnergyToday? energyToday;
  final List<EnergyFlowPoint> flowHistory;
  final LiveTelemetry live;
  final GridFlow? gridFlow;
  final HomeState home;
  final Map<MeterId, MeterState> meters;
  final List<ManualLog> manualLogs;
  final Map<String, dynamic>? meta;
  final UpsState? ups;

  const DashboardSnapshot({
    this.generatedAt,
    this.activeMeter = 'meter1',
    required this.changeover,
    required this.tomznLive,
    this.inverter,
    this.weather,
    this.energyToday,
    this.flowHistory = const [],
    required this.live,
    this.gridFlow,
    required this.home,
    required this.meters,
    this.manualLogs = const [],
    this.meta,
    this.ups,
  });

  factory DashboardSnapshot.fromJson(Map<String, dynamic> j) {
    Map<MeterId, MeterState> meters = {};
    final metersRaw = j['meters'] as Map<String, dynamic>? ?? {};
    metersRaw.forEach((key, value) {
      meters[key] = MeterState.fromJson(value as Map<String, dynamic>);
    });
    final changeoverRaw = j['changeover'] as Map<String, dynamic>? ?? {};
    final flowRaw = j['flowHistory'] as List? ?? const [];
    return DashboardSnapshot(
      generatedAt: j['generatedAt'] as String?,
      activeMeter: _s(j, 'activeMeter', 'meter1'),
      changeover: ChangeoverState(
        activeMeter: _s(changeoverRaw, 'activeMeter', _s(j, 'activeMeter', 'meter1')),
        lastSwitchedAt: _i(changeoverRaw, 'lastSwitchedAt'),
      ),
      tomznLive: TomznLive.fromJson(
          (j['tomznLive'] as Map<String, dynamic>?) ?? {}),
      inverter: j['inverter'] == null
          ? null
          : InverterTelemetry.fromJson(j['inverter'] as Map<String, dynamic>),
      weather: j['weather'] == null
          ? null
          : WeatherState.fromJson(j['weather'] as Map<String, dynamic>),
      energyToday: j['energyToday'] == null
          ? null
          : EnergyToday.fromJson(j['energyToday'] as Map<String, dynamic>),
      flowHistory: flowRaw
          .map((e) => EnergyFlowPoint.fromJson(e as Map<String, dynamic>))
          .toList(),
      live: LiveTelemetry.fromJson((j['live'] as Map<String, dynamic>?) ?? {}),
      gridFlow: j['gridFlow'] == null
          ? null
          : GridFlow.fromJson(j['gridFlow'] as Map<String, dynamic>),
      home: HomeState.fromJson((j['home'] as Map<String, dynamic>?) ?? {}),
      meters: meters,
      manualLogs: ((j['manualLogs'] as List?) ?? const [])
          .map((e) => ManualLog.fromJson(e as Map<String, dynamic>))
          .toList(),
      meta: j['meta'] as Map<String, dynamic>?,
      ups: j['ups'] == null
          ? null
          : UpsState.fromJson(j['ups'] as Map<String, dynamic>),
    );
  }

  DashboardSnapshot copyWith({
    String? generatedAt, MeterId? activeMeter, ChangeoverState? changeover,
    TomznLive? tomznLive, InverterTelemetry? inverter,
    WeatherState? weather, EnergyToday? energyToday,
    List<EnergyFlowPoint>? flowHistory, LiveTelemetry? live,
    GridFlow? gridFlow, HomeState? home,
    Map<MeterId, MeterState>? meters, List<ManualLog>? manualLogs,
    Map<String, dynamic>? meta, UpsState? ups,
  }) =>
      DashboardSnapshot(
        generatedAt: generatedAt ?? this.generatedAt,
        activeMeter: activeMeter ?? this.activeMeter,
        changeover: changeover ?? this.changeover,
        tomznLive: tomznLive ?? this.tomznLive,
        inverter: inverter ?? this.inverter,
        weather: weather ?? this.weather,
        energyToday: energyToday ?? this.energyToday,
        flowHistory: flowHistory ?? this.flowHistory,
        live: live ?? this.live,
        gridFlow: gridFlow ?? this.gridFlow,
        home: home ?? this.home,
        meters: meters ?? this.meters,
        manualLogs: manualLogs ?? this.manualLogs,
        meta: meta ?? this.meta,
        ups: ups ?? this.ups,
      );
}

class ChangeoverState {
  final MeterId activeMeter;
  final int lastSwitchedAt; // epoch ms
  const ChangeoverState({required this.activeMeter, this.lastSwitchedAt = 0});
}

class FlowPoint {
  final int timestamp; // epoch seconds
  final double? solarKw, gridKw, loadKw;
  const FlowPoint({required this.timestamp, this.solarKw, this.gridKw, this.loadKw});
}