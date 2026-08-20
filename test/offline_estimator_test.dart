import 'package:flutter_test/flutter_test.dart';

import 'package:voltix/data/offline_estimator.dart';

import 'package:voltix/models/energy.dart';

DashboardSnapshot _seed({String? generatedAt}) {
  final now = DateTime.now();
  return DashboardSnapshot(
    generatedAt: generatedAt ?? now.toIso8601String(),
    activeMeter: 'meter1',
    changeover: const ChangeoverState(activeMeter: 'meter1'),
    tomznLive: const TomznLive(
      energyKwh: 59460.6, voltageV: 220.4, currentA: 1.9, powerW: 420,
      frequencyHz: 50.0, isOnline: true, switchOn: true, faultCode: 0,
      isLive: true, powerDisplay: '420 W', activeMeter: 'meter1',
    ),
    inverter: const InverterTelemetry(
      solarW: 1240, loadW: 1120, isLive: true, isOnline: true,
    ),
    energyToday: const EnergyToday(solarKwh: 8.32, homeKwh: 12.41, gridKwh: 4.09),
    live: const LiveTelemetry(
      gridKw: 0.42, solarKw: 1.24, homeKw: 1.12, voltage: 220.4,
    ),
    home: const HomeState(
      todayUsage: 12.41, averageDaily: 10.0, projectedMonthly: 300,
      confidencePercent: 87,
    ),
    meters: {
      'meter1': const MeterState(
        id: 'meter1', label: 'Meter 1', reading: 59460.6,
        remainingUnits: 139.4, targetUnits: 200, averageDaily: 6.0,
        projectedDaysLeft: 20, confidencePercent: 80,
        predictionConfidence: 75, todayUsage: 6.02,
      ),
    },
    manualLogs: const [
      ManualLog(
          id: 'l1', timestamp: 1755739800, meterId: 'meter1', reading: 59460.6),
    ],
  );
}

void main() {
  group('patternedUsage', () {
    test('stays within sane bounds around the clock', () {
      for (var h = 0; h < 168; h++) {
        final ms = DateTime.utc(2026, 8, 17).millisecondsSinceEpoch +
            h * 3600 * 1000 -
            kPakistanOffset.inMilliseconds;
        final w = patternedUsage(ms);
        expect(w, greaterThan(0.4), reason: 'hour $h');
        expect(w, lessThan(2.2), reason: 'hour $h');
      }
    });

    test('is deterministic', () {
      final ms = DateTime.utc(2026, 8, 20, 12).millisecondsSinceEpoch;
      expect(patternedUsage(ms), patternedUsage(ms));
    });

    test('Friday midday gets the prayer bump', () {
      // Friday 13:00 Pak time.
      final friday =
          patternedUsage(DateTime.utc(2026, 8, 21, 8).millisecondsSinceEpoch);
      final monday =
          patternedUsage(DateTime.utc(2026, 8, 17, 8).millisecondsSinceEpoch);
      expect(friday, greaterThan(monday));
    });
  });

  group('estimateOfflineDashboard', () {
    test('drifts readings and energy forward only', () {
      final base = _seed(
          generatedAt: DateTime.now()
              .subtract(const Duration(hours: 41))
              .toIso8601String());
      final est = estimateOfflineDashboard(base);

      expect(est.tomznLive.energyKwh, greaterThan(base.tomznLive.energyKwh));
      expect(est.meters['meter1']!.reading, greaterThan(base.meters['meter1']!.reading));
      expect(est.meters['meter1']!.remainingUnits,
          lessThan(base.meters['meter1']!.remainingUnits));
      expect(est.home.todayUsage, greaterThan(base.home.todayUsage));
      expect(est.home.confidencePercent, lessThan(base.home.confidencePercent));
    });

    test('marks sources stale when offline', () {
      final est = estimateOfflineDashboard(
          _seed(generatedAt: DateTime.now()
              .subtract(const Duration(hours: 1))
              .toIso8601String()));
      expect(est.tomznLive.isLive, isFalse);
      expect(est.inverter!.isLive, isFalse);
      expect(est.inverter!.isOnline, isFalse);
    });

    test('backfills at least one flow point after a gap', () {
      final base = _seed(
          generatedAt: DateTime.now()
              .subtract(const Duration(hours: 3))
              .toIso8601String());
      final est = estimateOfflineDashboard(base);
      expect(est.flowHistory.length, greaterThan(base.flowHistory.length));
      expect(
        est.flowHistory.last.timestamp,
        greaterThanOrEqualTo(base.flowHistory.isEmpty
            ? 0
            : base.flowHistory.last.timestamp),
      );
    });

    test('returns the same snapshot when nothing elapsed', () {
      final base = _seed();
      final est = estimateOfflineDashboard(base);
      expect(est.tomznLive.energyKwh, base.tomznLive.energyKwh);
      expect(est.meters['meter1']!.reading, base.meters['meter1']!.reading);
    });
  });

  group('applyOfflineManualReading', () {
    test('updates the meter and prepends a log', () {
      final snap = applyOfflineManualReading(
          _seed(), 'meter1', 59470.0,
          timestamp: 1756000000000, notes: 'check');
      final m = snap.meters['meter1']!;
      expect(m.reading, 59470.0);
      expect(m.lastLoggedAt, 1756000000000);
      expect(snap.manualLogs.first.meterId, 'meter1');
      expect(snap.manualLogs.first.reading, 59470.0);
      expect(snap.manualLogs.first.notes, 'check');
    });
  });

  group('applyOfflineChangeover', () {
    test('switches active meter everywhere', () {
      final snap = applyOfflineChangeover(
          _seed(), 'meter2', timestamp: 1756000000000);
      expect(snap.activeMeter, 'meter2');
      expect(snap.changeover.activeMeter, 'meter2');
      expect(snap.changeover.lastSwitchedAt, 1756000000000);
      expect(snap.tomznLive.activeMeter, 'meter2');
    });
  });

  group('applyOfflineLastMonthTotal', () {
    test('recomputes month comparison', () {
      final snap = applyOfflineLastMonthTotal(_seed(), 400.0);
      expect(snap.home.lastMonthTotal, 400.0);
      expect(snap.home.vsLastMonthPercent, isNotNull);
    });
  });

  group('hourOfWeek', () {
    test('maps epochs into Pakistan local time', () {
      // 2026-08-20 22:00 UTC == 2026-08-21 03:00 PKT (Friday).
      final ms = DateTime.utc(2026, 8, 20, 22).millisecondsSinceEpoch;
      final how = hourOfWeek(ms);
      expect(how ~/ 24, 5); // Friday
      expect(how % 24, closeTo(3, 0.001));
    });
  });
}