import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../models/energy.dart';

/// Mock live-data provider. Simulates the backend polling loop (live tick
/// every 2s, 24h flow history). Frontend-only — swap for API calls later.
class EnergyProvider extends ChangeNotifier {
  static const _tick = Duration(seconds: 2);
  static const _historyWindow = 24 * 60 * 60; // seconds
  static const _bucket = 5 * 60; // seconds

  final Random _rng = Random(7);
  Timer? _timer;
  double _phase = 0;

  // ── Live state ────────────────────────────────────────────────────
  InverterTelemetry inverter = const InverterTelemetry(
    solarW: 1240, solarV: 121, solarA: 10.2,
    pv1V: 121, pv1A: 6.3, pv1W: 762,
    pv2V: 120, pv2A: 4.0, pv2W: 478,
    gridW: -120, gridV: 222, gridHz: 50.0,
    gridConnected: true, gridDirection: 'export',
    loadW: 1120, loadVa: 1180, loadPercent: 37,
    acOutV: 230, acOutHz: 50.0,
    inverterMode: 'Hybrid', inverterFault: 'NO',
    temperatureC: 45.2, ratedOutputW: 3000,
    signal: -65, firmware: 'VERFW:1.2.3',
    isOnline: true, isLive: true,
  );
  TomznLive tomzn = const TomznLive(
    energyKwh: 59460.6, voltageV: 220.4, currentA: 1.9, powerW: 420,
    frequencyHz: 50.0, isOnline: true, switchOn: true, faultCode: 0,
  );

  List<FlowPoint> flowHistory = [];
  EnergyToday energyToday = const EnergyToday(solarKwh: 8.32, homeKwh: 12.41, gridKwh: 4.09);
  HomeState home = const HomeState(
    todayUsage: 12.41, averageDaily: 12.45, projectedMonthly: 345,
    confidencePercent: 87, trend: 'decreasing',
    yesterdayUsage: 13.23, usageChangePercent: -6.2,
    loadStatus: 'Normal', normalDrawKw: 1.2, combinedDaysLeft: 22,
    lastMonthTotal: 378, vsLastMonthPercent: -8.7,
    periodDay: 38, periodNight: 34, periodMorningEvening: 28,
  );

  List<MeterState> meters = const [
    MeterState(
      id: 'meter1', label: 'Meter 1 (Analog)', isDigital: false,
      reading: 59460.6, remainingUnits: 139.4, targetUnits: 200,
      todayUsage: 6.02, projectedDaysLeft: 13, projectedMonthly: 185,
      healthScore: 86, averageDaily: 6.1,
      lastLoggedReading: 59460.6, lastLoggedAt: 1755739800,
    ),
    MeterState(
      id: 'meter2', label: 'Meter 2 (Digital)', isDigital: true,
      reading: 10282.4, remainingUnits: 142.6, targetUnits: 200,
      todayUsage: 6.39, projectedDaysLeft: 14, projectedMonthly: 160,
      healthScore: 91, averageDaily: 6.35,
      lastLoggedReading: 10282.4, lastLoggedAt: 1755739800,
    ),
  ];

  String activeMeter = 'meter1';
  bool overlayEnabled = false;

  List<ManualLog> logs = const [
    ManualLog(id: 'l1', timestamp: 1755739800, meterId: 'meter1', reading: 59460.6),
    ManualLog(id: 'l2', timestamp: 1755739800, meterId: 'meter2', reading: 10282.4),
    ManualLog(id: 'l3', timestamp: 1755653400, meterId: 'meter1', reading: 59454.2, notes: 'Evening check'),
    ManualLog(id: 'l4', timestamp: 1755567000, meterId: 'meter2', reading: 10276.1),
  ];

  EnergyProvider() {
    _buildHistory();
    _timer = Timer.periodic(_tick, (_) => _step());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  // ── Live simulation ───────────────────────────────────────────────
  double _wave(double amp, double speed, double seed) =>
      sin(_phase * speed + seed) * amp + _rng.nextDouble() * amp * 0.25;

  void _step() {
    _phase += 0.35;
    final solarTarget = 1240.0 + _wave(180.0, 0.9, 1.7);
    final loadTarget = 1120.0 + _wave(260.0, 1.1, 4.2);
    final solarW = max(80.0, solarTarget);
    final loadW = max(180.0, loadTarget);
    final solarV = 121.0 + _wave(4.0, 0.7, 2.2);
    final solarA = solarW / solarV;
    final importW = max(0.0, loadW - solarW);
    final exportW = max(0.0, solarW - loadW);

    inverter = inverter.copyWith(
      solarW: solarW, solarV: solarV, solarA: solarA,
      loadW: loadW,
      gridW: importW > 0 ? importW : -exportW,
    );
    tomzn = tomzn.copyWith(
      powerW: importW,
      currentA: importW / 220.4,
    );

    // Update the trailing history point.
    if (flowHistory.isNotEmpty) {
      final last = flowHistory.last;
      flowHistory[flowHistory.length - 1] = FlowPoint(
        timestamp: last.timestamp,
        solarKw: solarW / 1000,
        gridKw: tomzn.powerW / 1000,
        loadKw: loadW / 1000,
      );
    }
    notifyListeners();
  }

  // ── 24h history (seeded, realistic day shapes) ────────────────────
  void _buildHistory() {
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final start = now - _historyWindow;
    final points = <FlowPoint>[];
    final r = Random(11);
    for (var ts = start; ts <= now; ts += _bucket) {
      final h = DateTime.fromMillisecondsSinceEpoch(ts * 1000).hour +
          DateTime.fromMillisecondsSinceEpoch(ts * 1000).minute / 60;
      // Solar: bell curve peaking ~13:00, zero at night.
      final solar = h >= 6 && h <= 19
          ? 1.35 * exp(-pow((h - 13) / 3.6, 2)) * (0.85 + r.nextDouble() * 0.3)
          : 0.0;
      // Home load: morning + evening peaks.
      final load = 0.55 +
          (h >= 6 && h <= 10 ? 0.75 * exp(-pow((h - 8) / 1.8, 2)) : 0) +
          (h >= 17 && h <= 23 ? 1.1 * exp(-pow((h - 20) / 2.2, 2)) : 0) +
          (h >= 0 && h <= 5 ? 0.25 : 0) +
          r.nextDouble() * 0.2;
      final grid = max(0.0, load - solar) + (h >= 20 || h <= 4 ? 0.18 : 0.05);
      points.add(FlowPoint(
        timestamp: ts,
        solarKw: solar,
        gridKw: grid,
        loadKw: load,
      ));
    }
    flowHistory = points;
  }

  // ── Actions (mock) ────────────────────────────────────────────────
  void changeover() {
    activeMeter = activeMeter == 'meter1' ? 'meter2' : 'meter1';
    notifyListeners();
  }

  void setOverlay(bool value) {
    overlayEnabled = value;
    notifyListeners();
  }

  MeterState meter(String id) => meters.firstWhere((m) => m.id == id);

  void logReading(String meterId, double reading) {
    final ts = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    logs = [
      ManualLog(
        id: 'l${DateTime.now().microsecondsSinceEpoch}',
        timestamp: ts, meterId: meterId, reading: reading,
      ),
      ...logs,
    ];
    meters = [
      for (final m in meters)
        if (m.id == meterId)
          MeterState(
            id: m.id, label: m.label, isDigital: m.isDigital,
            reading: reading, remainingUnits: m.remainingUnits,
            targetUnits: m.targetUnits, todayUsage: m.todayUsage,
            projectedDaysLeft: m.projectedDaysLeft,
            projectedMonthly: m.projectedMonthly, healthScore: m.healthScore,
            averageDaily: m.averageDaily,
            lastLoggedReading: reading, lastLoggedAt: ts,
          )
        else
          m,
    ];
    notifyListeners();
  }

  void deleteLog(String id) {
    logs = logs.where((l) => l.id != id).toList();
    notifyListeners();
  }

  void setLastMonthTotal(double value) {
    final old = home.lastMonthTotal ?? value;
    final pct = old > 0 ? ((home.projectedMonthly - value) / value) * 100 : 0.0;
    home = HomeState(
      todayUsage: home.todayUsage, averageDaily: home.averageDaily,
      projectedMonthly: home.projectedMonthly, confidencePercent: home.confidencePercent,
      trend: home.trend, yesterdayUsage: home.yesterdayUsage,
      usageChangePercent: home.usageChangePercent, loadStatus: home.loadStatus,
      normalDrawKw: home.normalDrawKw, combinedDaysLeft: home.combinedDaysLeft,
      lastMonthTotal: value, vsLastMonthPercent: pct,
      periodDay: home.periodDay, periodNight: home.periodNight,
      periodMorningEvening: home.periodMorningEvening,
    );
    notifyListeners();
  }
}
