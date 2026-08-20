// Offline estimation engine — pure-Dart port of the RN app's
// src/utils/offline-dashboard.ts + src/utils/calculations.ts.
//
// When the backend is unreachable the provider keeps the last known
// snapshot alive by imputing drift: meter readings walk forward at their
// averageDaily pace, tomzn energy accumulates at the last seen power,
// and the home "expected draw now" follows a weekly usage pattern
// (Pakistan +05:00).
//
// All functions are pure: they take a snapshot (plus optional now) and
// return a new one. No timers, no I/O.

import 'dart:math' as math;

import '../models/energy.dart';

// ── Pakistan time (+05:00, no DST) ──────────────────────────────────────

/// Fixed +5h offset — mirrors `PAKISTAN_OFFSET` in the RN codebase.
const Duration kPakistanOffset = Duration(hours: 5);

/// Epoch-milliseconds shifted into Pakistan local time.
int _pakistanMs(int epochMs) => epochMs + kPakistanOffset.inMilliseconds;

/// Hours since the Monday 00:00 in Pakistan time, 0..167.
///
/// Mirrors the RN `hourOfWeek` helper: used for patterned usage curves
/// (weekday vs weekend, Friday prayer loads).
double hourOfWeek([int? epochMs]) {
  final ms = epochMs ?? DateTime.now().millisecondsSinceEpoch;
  final p = _pakistanMs(ms) ~/ 1000; // seconds in Pak time
  final days = p ~/ 86400;
  final weekday = (days + 4) % 7; // 1970-01-01 was a Thursday
  return weekday * 24 + (p % 86400) / 3600.0;
}

/// True when the given hour-of-week lands on Friday midday
/// (index 5, 12:00-15:00 Pak time).
bool isFridayHour(double how) =>
    how >= 5 * 24 && how < 6 * 24 && how % 24 >= 12 && how % 24 < 15;

// ── Weekly usage pattern ────────────────────────────────────────────────

/// Expected normalized draw per clock hour (0..23). 1.0 = average load for
/// this household. Approximates the RN `HOUR_WEIGHTS` table: overnight
/// base ~0.55, morning + evening peaks ~1.6-1.9, midday solar-gap ~1.2,
/// Friday 12:30-15:00 prayer bump.
const List<double> kWeekdayWeights = [
  0.52, 0.50, 0.48, 0.47, 0.49, 0.55, // 0-5   overnight base
  0.75, 1.15, 1.45, 1.35, 1.20, 1.15, // 6-11  morning peak
  1.20, 1.25, 1.30, 1.40, 1.55, 1.70, // 12-17 midday → evening ramp
  1.85, 1.90, 1.80, 1.65, 1.30, 0.85, // 18-23 evening peak → settle
];

const List<double> kWeekendWeights = [
  0.55, 0.52, 0.50, 0.48, 0.50, 0.60, // nights stay up later
  0.85, 1.30, 1.50, 1.40, 1.35, 1.30, // later, busier mornings
  1.45, 1.55, 1.50, 1.45, 1.50, 1.60, // full-day dwelling
  1.80, 1.85, 1.75, 1.60, 1.35, 0.90,
];

/// Normalized expected draw at [epochMs]. Friday 12:30-15:00 gets a bump
/// (prayer-time heavy cooking), same as the RN pattern engine.
double patternedUsage([int? epochMs]) {
  final how = hourOfWeek(epochMs);
  final hour = how % 24;
  final isWeekend = (how ~/ 24) >= 5;
  var w = isWeekend ? kWeekendWeights[hour.toInt()] : kWeekdayWeights[hour.toInt()];
  if (isFridayHour(how)) w *= 1.18;
  return w;
}

/// Interpolated weekly pattern lookup returning an absolute kW figure when
/// given a reference daily total. Mirrors RN `patternedDrawKw`.
double patternedDrawKw({required double averageDailyKwh, int? epochMs}) =>
    _fast(patternedUsage(epochMs) * averageDailyKwh / 24, 2);

// ── Drift helpers ───────────────────────────────────────────────────────

double _fast(double v, int digits) {
  final f = math.pow(10, digits).toDouble();
  return (v * f).round() / f;
}

/// Minutes elapsed between the snapshot's generation time and now.
/// Defaults to 0 when the timestamp is missing (defensive).
int _elapsedMinutes(DashboardSnapshot snap, DateTime now) {
  final gen = snap.generatedAt;
  if (gen == null || gen.isEmpty) return 0;
  final parsed = DateTime.tryParse(gen);
  if (parsed == null) return 0;
  final diff = now.difference(parsed).inMinutes;
  return diff < 0 ? 0 : diff;
}

/// Clamps a value to zero when it would otherwise go slightly negative
/// (rounding noise from drift).
double _nonNegative(double v) => v < 0 ? 0 : v;

// ── Snapshot estimation ─────────────────────────────────────────────────

/// Estimates the current dashboard state given the last known [prev]
/// snapshot and the wall-clock time. Clamps drift so estimates never go
/// backwards. Never mutates [prev].
DashboardSnapshot estimateOfflineDashboard(
  DashboardSnapshot prev, {
  DateTime? now,
  int? latestEpochMs,
}) {
  final t = now ?? DateTime.now();
  final epochMs = latestEpochMs ?? t.millisecondsSinceEpoch;
  final mins = _elapsedMinutes(prev, t);
  if (mins <= 0) return prev;

  final days = mins / (24 * 60);
  final hours = mins / 60.0;
  final pattern = patternedUsage(epochMs);

  // ── tomzn: energy accumulates at last-seen power ─────────────────
  final tomzn = prev.tomznLive;
  final driftKwh = tomzn.isLive && tomzn.powerW > 0
      ? (tomzn.powerW / 1000) * hours
      : prev.home.averageDaily / 24 * hours;
  var energy = tomzn.energyKwh + driftKwh;

  // ── meters: readings walk forward at averageDaily pace ────────────
  final meters = <MeterId, MeterState>{};
  prev.meters.forEach((id, m) {
    final avgDaily = m.averageDaily > 0 ? m.averageDaily : 1.0;
    final drift = avgDaily * days;
    final reading = m.reading + drift;
    final remaining = _nonNegative(m.remainingUnits - drift);
    meters[id] = m.copyWith(
      reading: _fast(reading, 1),
      remainingUnits: _fast(remaining, 1),
      projectedDaysLeft: m.projectedDaysLeft > 0
          ? _fast(math.max(0.0, m.projectedDaysLeft - days), 1)
          : m.projectedDaysLeft,
      projectedMonthly: m.projectedMonthly > 0
          ? m.projectedMonthly * (1 + 0.02 * days) // slight uncertainty creep
          : m.projectedMonthly,
      confidencePercent: m.confidencePercent > 40
          ? _fast(m.confidencePercent - 0.35 * days, 0)
          : m.confidencePercent,
      predictionConfidence: m.predictionConfidence > 40
          ? _fast(m.predictionConfidence - 0.35 * days, 0)
          : m.predictionConfidence,
      todayUsage: _fast(_nonNegative(m.todayUsage + avgDaily * days), 2),
      recentDailyAvg: m.recentDailyAvg > 0 ? m.recentDailyAvg : avgDaily,
      expectedDrawNow: _fast(patternedDrawKw(
        averageDailyKwh: m.recentDailyAvg > 0 ? m.recentDailyAvg : avgDaily,
        epochMs: epochMs,
      ) * 1000, 0),
    );
  });

  // ── home: usage + pattern-based expected draw ─────────────────────
  final avgDaily = prev.home.averageDaily > 0 ? prev.home.averageDaily : 12.0;
  final today = prev.home.todayUsage + avgDaily * days;
  final home = prev.home.copyWith(
    todayUsage: _fast(today, 2),
    expectedDrawNow: _fast(patternedDrawKw(
      averageDailyKwh: avgDaily, epochMs: epochMs,
    ) * 1000, 0),
    projectedMonthly: prev.home.projectedMonthly > 0
        ? _fast(prev.home.projectedMonthly + (avgDaily * days) * 30.4 / 30.0,
            1)
        : prev.home.projectedMonthly,
    confidencePercent: prev.home.confidencePercent > 40
        ? _fast(prev.home.confidencePercent - 0.3 * days, 0)
        : prev.home.confidencePercent,
  );

  // ── flow history: append a backfilled point per elapsed hour ──────
  final flowHistory = [...prev.flowHistory];
  final solarRef = prev.inverter?.solarW ?? (prev.energyToday?.solarKwh ?? 0) * 1000 / 6;
  final gridRef = tomzn.isLive ? tomzn.powerW : prev.live.gridKw * 1000;
  final loadRef = prev.live.homeKw * 1000 > 0
      ? prev.live.homeKw * 1000
      : (prev.live.gridKw + (solarRef / 1000)) * 1000;
  for (var i = 1; i <= hours.floor(); i++) {
    final ts = (epochMs / 1000).floor() - (hours.floor() - i) * 3600;
    if (flowHistory.isNotEmpty && ts <= flowHistory.last.timestamp) break;
    flowHistory.add(EnergyFlowPoint(
      timestamp: ts * 1000,
      solarKw: _fast(solarRef / 1000, 3),
      gridKw: _fast(gridRef / 1000, 3),
      loadKw: _fast(loadRef / 1000, 3),
    ));
  }

  // ── energyToday: scale up by elapsed decimal-day fraction ─────────
  final e = prev.energyToday;
  final energyToday = e == null
      ? null
      : EnergyToday(
          solarKwh: _fast(e.solarKwh + (e.solarKwh * (pattern / 1.0)) * hours / 24, 2),
          homeKwh: _fast(e.homeKwh + avgDaily * hours / 24, 2),
          gridKwh: _fast(
              _nonNegative(e.gridKwh + (gridRef / 1000) * hours / 24), 2),
        );

  // ── live: hold last known, mark as stale ──────────────────────────
  final live = LiveTelemetry(
    gridKw: gridRef / 1000,
    solarKw: solarRef / 1000,
    homeKw: loadRef / 1000,
    voltage: prev.live.voltage,
    currentAmp: prev.live.currentAmp,
    frequency: prev.live.frequency,
    powerFactor: prev.live.powerFactor,
  );

  return prev.copyWith(
    generatedAt: t.toIso8601String(),
    tomznLive: TomznLive(
      energyKwh: _fast(energy, 1),
      voltageV: tomzn.voltageV,
      currentA: tomzn.isLive && tomzn.powerW > 0 && tomzn.voltageV > 0
          ? _fast(tomzn.powerW / tomzn.voltageV, 2)
          : tomzn.currentA,
      powerW: tomzn.powerW,
      powerDisplay: tomzn.isLive ? tomzn.powerDisplay : '-- W',
      frequencyHz: tomzn.frequencyHz,
      isOnline: false,
      switchOn: tomzn.switchOn,
      faultCode: tomzn.faultCode,
      fetchedAt: tomzn.fetchedAt,
      isLive: false,
      timestamp: tomzn.timestamp,
      activeMeter: tomzn.activeMeter,
    ),
    inverter: prev.inverter == null
        ? null
        : InverterTelemetry(
            solarW: prev.inverter!.solarW, solarV: prev.inverter!.solarV,
            solarA: prev.inverter!.solarA,
            pv1V: prev.inverter!.pv1V, pv1A: prev.inverter!.pv1A,
            pv1W: prev.inverter!.pv1W,
            pv2V: prev.inverter!.pv2V, pv2A: prev.inverter!.pv2A,
            pv2W: prev.inverter!.pv2W,
            gridW: prev.inverter!.gridW, gridWRaw: prev.inverter!.gridWRaw,
            gridV: prev.inverter!.gridV, gridHz: prev.inverter!.gridHz,
            gridConnected: false,
            gridDirection: prev.inverter!.gridDirection,
            loadW: prev.inverter!.loadW, loadVa: prev.inverter!.loadVa,
            loadPercent: prev.inverter!.loadPercent,
            acOutV: prev.inverter!.acOutV, acOutHz: prev.inverter!.acOutHz,
            inverterMode: prev.inverter!.inverterMode,
            inverterFault: prev.inverter!.inverterFault,
            temperatureC: prev.inverter!.temperatureC,
            ratedOutputW: prev.inverter!.ratedOutputW,
            signal: prev.inverter!.signal, firmware: prev.inverter!.firmware,
            sourceTime: prev.inverter!.sourceTime,
            fetchedAt: prev.inverter!.fetchedAt,
            isLive: false, isOnline: false,
          ),
    weather: prev.weather,
    energyToday: energyToday,
    flowHistory: flowHistory,
    live: live,
    gridFlow: prev.gridFlow,
    home: home,
    meters: meters,
    manualLogs: prev.manualLogs,
    ups: prev.ups,
  );
}

// ── Offline mutations (mirror the RN offline apply helpers) ─────────────

/// Applies a changeover locally when the backend is unreachable.
/// Switches [activeMeter] and records the switch time. Persisted by the
/// caller the next time the backend becomes reachable.
DashboardSnapshot applyOfflineChangeover(
  DashboardSnapshot snap,
  MeterId meterId, {
  int? timestamp,
}) {
  final ts = timestamp ?? DateTime.now().millisecondsSinceEpoch;
  return snap.copyWith(
    changeover: ChangeoverState(activeMeter: meterId, lastSwitchedAt: ts),
    activeMeter: meterId,
    tomznLive: TomznLive(
      energyKwh: snap.tomznLive.energyKwh, voltageV: snap.tomznLive.voltageV,
      currentA: snap.tomznLive.currentA, powerW: snap.tomznLive.powerW,
      powerDisplay: snap.tomznLive.powerDisplay,
      frequencyHz: snap.tomznLive.frequencyHz,
      isOnline: snap.tomznLive.isOnline, switchOn: snap.tomznLive.switchOn,
      faultCode: snap.tomznLive.faultCode,
      fetchedAt: snap.tomznLive.fetchedAt, isLive: snap.tomznLive.isLive,
      timestamp: snap.tomznLive.timestamp, activeMeter: meterId,
    ),
  );
}

/// Stores a manual reading offline, recomputes the meter's pace locally.
/// The reading is pushed to the backend once connectivity returns.
DashboardSnapshot applyOfflineManualReading(
  DashboardSnapshot snap,
  MeterId meterId,
  double reading, {
  int? timestamp,
  String? notes,
}) {
  final ts = timestamp ?? DateTime.now().millisecondsSinceEpoch;
  final m = snap.meters[meterId];
  if (m == null) return snap;

  final lastTs = m.lastLoggedAt ?? 0;
  final days = lastTs > 0 ? (ts - lastTs) / (24 * 3600 * 1000.0) : 0.0;
  final usedSinceLast = days > 0 && lastTs > 0
      ? (_fast(math.max(0.0, m.lastLoggedReading! - reading), 2))
      : 0.0;
  final avgDaily = days > 0 && lastTs > 0 ? usedSinceLast / days : m.averageDaily;

  final updated = m.copyWith(
    reading: reading,
    remainingUnits: _nonNegative(m.remainingUnits - usedSinceLast),
    lastLoggedAt: ts,
    lastLoggedReading: reading,
    averageDaily: avgDaily > 0 ? _fast(avgDaily, 2) : m.averageDaily,
    currentDaily: avgDaily > 0 ? _fast(avgDaily, 2) : m.currentDaily,
    recentDailyAvg: avgDaily > 0 ? _fast(avgDaily, 2) : m.recentDailyAvg,
    confidencePercent: m.confidencePercent,
  );

  final log = ManualLog(
    id: 'offline-$ts',
    timestamp: ts,
    meterId: meterId,
    reading: reading,
    notes: notes,
  );

  return snap.copyWith(
    meters: {...snap.meters, meterId: updated},
    manualLogs: [log, ...snap.manualLogs],
  );
}

/// Records a baseline (cycle start reading) offline, if one is not already
/// present for this cycle.
DashboardSnapshot applyOfflineBaseline(
  DashboardSnapshot snap,
  MeterId meterId,
  double reading,
  int cycleStartTs, {
  int? timestamp,
}) {
  final ts = timestamp ?? DateTime.now().millisecondsSinceEpoch;
  final log = ManualLog(
    id: 'baseline-offline-$cycleStartTs',
    timestamp: ts,
    meterId: meterId,
    reading: reading,
    notes: 'Baseline (cycle start)',
  );
  final m = snap.meters[meterId];
  return snap.copyWith(
    meters: m == null
        ? snap.meters
        : {
            ...snap.meters,
            meterId: m.copyWith(lastLoggedAt: ts, lastLoggedReading: reading),
          },
    manualLogs: [log, ...snap.manualLogs],
  );
}

/// Applies the last-month total locally (home card) when offline.
DashboardSnapshot applyOfflineLastMonthTotal(
  DashboardSnapshot snap,
  double total,
) {
  final old = snap.home.lastMonthTotal ?? total;
  final pct = old > 0 ? ((snap.home.projectedMonthly - total) / total) * 100 : 0.0;
  return snap.copyWith(
    home: snap.home.copyWith(
      lastMonthTotal: total,
      vsLastMonthPercent: _fast(pct, 1),
    ),
  );
}