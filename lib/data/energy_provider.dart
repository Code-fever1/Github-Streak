// EnergyProvider — real-data engine for the dashboard.
//
// Data flow mirrors the RN app's EnergyContext:
//   1. Full dashboard fetch on startup (GET /api/solar/dashboard).
//   2. Instant updates via SSE  (/api/solar/live/stream).
//   3. 30s recovery poll (fetchDashboard) so a dead SSE never wedges us.
//   4. When the backend is unreachable the provider drops into offline
//      mode and imputes drift with the offline estimator every 60s,
//      retrying the poll until connectivity returns.
//
// The public surface the pages already consume (inverter, tomzn,
// flowHistory, energyToday, home, meters, activeMeter, logs, meter(),
// changeover(), logReading(), deleteLog(), setLastMonthTotal(),
// setOverlay()) is preserved; `snapshot`, `gridFlow`, `ups`, `weather`,
// `live`, `source`, `lastSync` and `errorMessage` are the new additions.

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../models/energy.dart';
import '../scene/scene.dart'
    show HeroSceneId, HeroOverlayConfig, resolveHeroSceneId, loadOverlayConfig;
import 'api_client.dart';
import 'offline_estimator.dart';
import 'overlay_overrides.dart';

/// Where the current dashboard data comes from.
enum EnergyDataSource { loading, live, offline }

class EnergyProvider extends ChangeNotifier {
  final ApiClient _api;
  final Duration pollInterval;

  static const _offlineTick = Duration(seconds: 60);

  Timer? _poll;
  Timer? _offline;
  StreamSubscription<LivePayload>? _sse;
  bool _disposed = false;

  // ── Source state ────────────────────────────────────────────────────
  EnergyDataSource source = EnergyDataSource.loading;
  DateTime? lastSync;
  String? errorMessage;
  DashboardSnapshot? _snapshot;

  /// Latest authoritative snapshot (live or estimated). Used by the
  /// offline estimator as the drift base.
  DashboardSnapshot? get snapshot => _snapshot;

  // ── Live payload fields (instant SSE updates) ───────────────────────
  GridFlow? gridFlow;
  UpsState? ups;
  WeatherState? weather;
  LiveTelemetry live = const LiveTelemetry();

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
    powerDisplay: '420 W',
  );

  List<FlowPoint> flowHistory = [];
  EnergyToday energyToday =
      const EnergyToday(solarKwh: 8.32, homeKwh: 12.41, gridKwh: 4.09);
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

  /// Manually picked hero scene. Null = auto-resolve from weather/time.
  HeroSceneId? selectedScene;

  /// Current hero scene — manual pick, or resolved from live weather
  /// (or time-of-day when offline/unknown).
  HeroSceneId get scene {
    if (selectedScene != null) return selectedScene!;
    final w = weather;
    if (w != null) return resolveHeroSceneId(w);
    return switch (DateTime.now().hour) {
      >= 5 && < 18 => HeroSceneId.morningCloud,
      >= 18 && < 19 => HeroSceneId.evening,
      _ => HeroSceneId.night,
    };
  }

  void setScene(HeroSceneId? scene) {
    selectedScene = scene;
    notifyListeners();
  }

  // ── Overlay position overrides (dev-mode scene editor) ─────────────
  /// Per-scene editable overlay configs. When present, HeroEnergyScene
  /// applies these on top of the bundled JSON so positions are live-editable.
  final Map<HeroSceneId, EditableOverlayConfig> _overlayOverrides = {};

  /// Cached base configs (loaded once from bundled JSON).
  final Map<HeroSceneId, HeroOverlayConfig> _baseOverlayCache = {};

  /// Whether the overlay editor is active (shows debug handles on the scene).
  bool overlayEditorActive = false;

  Map<HeroSceneId, EditableOverlayConfig> get overlayOverrides =>
      _overlayOverrides;

  /// Returns the editable config for [scene], loading from the bundled JSON
  /// on first access.
  Future<EditableOverlayConfig> editableOverlay(HeroSceneId scene) async {
    if (_overlayOverrides[scene] != null) return _overlayOverrides[scene]!;
    final base = await _baseOverlay(scene);
    final editable = EditableOverlayConfig.fromConfig(scene, base);
    _overlayOverrides[scene] = editable;
    return editable;
  }

  /// Returns the merged config (overrides applied) for [scene], or the base
  /// config if no overrides exist yet. Uses cached base for sync access.
  Future<HeroOverlayConfig> resolvedOverlay(HeroSceneId scene) async {
    final base = await _baseOverlay(scene);
    final override = _overlayOverrides[scene];
    if (override == null) return base;
    return override.applyTo(base);
  }

  /// Synchronous resolved config — returns null if the base hasn't been
  /// loaded yet. Used by HeroEnergyScene to avoid FutureBuilder flicker.
  HeroOverlayConfig? resolvedOverlaySync(HeroSceneId scene) {
    final base = _baseOverlayCache[scene];
    if (base == null) return null;
    final override = _overlayOverrides[scene];
    if (override == null) return base;
    return override.applyTo(base);
  }

  Future<HeroOverlayConfig> _baseOverlay(HeroSceneId scene) async {
    if (_baseOverlayCache[scene] != null) return _baseOverlayCache[scene]!;
    final base = await loadOverlayConfig(scene);
    _baseOverlayCache[scene] = base;
    return base;
  }

  /// Called by the editor when a point/label/icon position changes.
  void notifyOverlayChanged() {
    notifyListeners();
  }

  /// Reset a scene's overrides back to the bundled JSON defaults.
  Future<void> resetOverlay(HeroSceneId scene) async {
    _overlayOverrides.remove(scene);
    notifyListeners();
  }

  void setOverlayEditorActive(bool value) {
    overlayEditorActive = value;
    notifyListeners();
  }

  List<ManualLog> logs = const [
    ManualLog(id: 'l1', timestamp: 1755739800, meterId: 'meter1', reading: 59460.6),
    ManualLog(id: 'l2', timestamp: 1755739800, meterId: 'meter2', reading: 10282.4),
    ManualLog(id: 'l3', timestamp: 1755653400, meterId: 'meter1', reading: 59454.2, notes: 'Evening check'),
    ManualLog(id: 'l4', timestamp: 1755567000, meterId: 'meter2', reading: 10276.1),
  ];

  EnergyProvider({ApiClient? client, this.pollInterval = const Duration(seconds: 30)})
      : _api = client ?? ApiClient() {
    _bootstrap();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  void _bootstrap() {
    _poll = Timer.periodic(pollInterval, (_) => _syncOnce());
    _syncOnce();
  }

  @override
  void dispose() {
    _disposed = true;
    _poll?.cancel();
    _offline?.cancel();
    _sse?.cancel();
    _api.dispose();
    super.dispose();
  }

  // ── Data ingestion ──────────────────────────────────────────────────

  /// Full-dashboard sync (startup, 30s poll, and recovery path).
  Future<void> _syncOnce() async {
    if (_disposed) return;
    try {
      final snap = await _api.fetchDashboard();
      if (_disposed) return;
      _applySnapshot(snap);
      source = EnergyDataSource.live;
      lastSync = DateTime.now();
      errorMessage = null;
      _leaveOffline();
      _ensureSse();
    } catch (e) {
      if (_disposed) return;
      _enterOffline();
    }
  }

  Future<void> refresh({bool force = false}) async {
    if (_disposed) return;
    try {
      final snap = force
          ? await _api.refreshAll(force: true)
          : await _api.fetchDashboard();
      if (_disposed) return;
      _applySnapshot(snap);
      source = EnergyDataSource.live;
      lastSync = DateTime.now();
      errorMessage = null;
      _leaveOffline();
      _ensureSse();
    } catch (e) {
      if (_disposed) return;
      errorMessage = 'Refresh failed: $e';
      _enterOffline();
    }
  }

  void _ensureSse() {
    if (_sse != null) return;
    _sse = _api.liveStream().listen(
      _onLive,
      onError: (_) {}, // stream auto-reconnects internally
    );
  }

  /// Instant updates pushed by the backend. When we were offline this is
  /// the first sign of life — jump back to live data.
  void _onLive(LivePayload payload) {
    if (_disposed) return;
    if (source == EnergyDataSource.offline) {
      _leaveOffline();
      source = EnergyDataSource.live;
      lastSync = DateTime.now();
    }
    if (payload.tomznLive.isLive || payload.tomznLive.isOnline) {
      tomzn = payload.tomznLive;
    }
    if (payload.inverter.isLive || payload.inverter.isOnline) {
      inverter = payload.inverter;
    }
    if (payload.gridFlow != null) gridFlow = payload.gridFlow;
    if (payload.ups != null) ups = payload.ups;
    if (payload.weather != null) weather = payload.weather;
    final pl = payload.live;
    if (pl != null) live = pl;
    _snapshot = _snapshot?.copyWith(
      tomznLive: payload.tomznLive,
      inverter: payload.inverter.isLive || payload.inverter.isOnline
          ? payload.inverter
          : null,
      gridFlow: gridFlow,
      ups: ups,
      weather: weather,
      live: payload.live ?? live,
    );
    notifyListeners();
  }

  void _applySnapshot(DashboardSnapshot snap) {
    _snapshot = snap;
    activeMeter = snap.activeMeter;
    tomzn = snap.tomznLive;
    if (snap.inverter != null) inverter = snap.inverter!;
    if (snap.gridFlow != null) gridFlow = snap.gridFlow;
    if (snap.ups != null) ups = snap.ups;
    if (snap.weather != null) weather = snap.weather;
    if (snap.energyToday != null) energyToday = snap.energyToday!;
    live = snap.live;
    home = snap.home;
    meters = snap.meters.values.toList()
      ..sort((a, b) => a.id.compareTo(b.id));
    flowHistory = _toFlowPoints(snap.flowHistory);
    logs = snap.manualLogs;
    notifyListeners();
  }

  // ── Offline mode ────────────────────────────────────────────────────

  void _enterOffline() {
    if (source == EnergyDataSource.offline) return;
    source = EnergyDataSource.offline;
    errorMessage = 'Backend unreachable — showing estimated values';
    _snapshot ??= _seedSnapshot();
    _applyLocal(_estimateNow());
    _offline ??= Timer.periodic(_offlineTick, (_) {
      if (_disposed || source != EnergyDataSource.offline) return;
      _applyLocal(_estimateNow());
    });
  }

  void _leaveOffline() {
    _offline?.cancel();
    _offline = null;
  }

  DashboardSnapshot _estimateNow() {
    final base = _snapshot ?? _seedSnapshot();
    return estimateOfflineDashboard(base);
  }

  /// Applies a snapshot without flipping the source (used by the offline
  /// engine while staying in offline mode).
  void _applyLocal(DashboardSnapshot snap) {
    _snapshot = snap;
    activeMeter = snap.activeMeter;
    tomzn = snap.tomznLive;
    if (snap.inverter != null) inverter = snap.inverter!;
    if (snap.gridFlow != null) gridFlow = snap.gridFlow;
    if (snap.ups != null) ups = snap.ups;
    if (snap.weather != null) weather = snap.weather;
    if (snap.energyToday != null) energyToday = snap.energyToday!;
    live = snap.live;
    home = snap.home;
    meters = snap.meters.values.toList()
      ..sort((a, b) => a.id.compareTo(b.id));
    flowHistory = _toFlowPoints(snap.flowHistory);
    logs = snap.manualLogs;
    notifyListeners();
  }

  // ── Actions (optimistic locally, authoritative via API) ─────────────

  /// Switches the changeover to the other meter. Applies instantly, then
  /// tells the backend. Falls back to a local apply when unreachable.
  Future<void> changeover([MeterId? to]) async {
    final next = to ?? (activeMeter == 'meter1' ? 'meter2' : 'meter1');
    final optimistic =
        (_snapshot ?? _seedSnapshot()).copyWith(
      changeover: ChangeoverState(activeMeter: next),
      activeMeter: next,
    );
    _applyLocal(optimistic);
    if (_disposed) return;
    try {
      final snap = await _api.postChangeover(next);
      if (_disposed) return;
      _applySnapshot(snap);
      source = EnergyDataSource.live;
      _leaveOffline();
      _ensureSse();
      errorMessage = null;
    } catch (e) {
      if (_disposed) return;
      _enterOffline();
    }
  }

  /// Stores a manual reading. Optimistic + API; fallback offline helper.
  Future<void> logReading(MeterId meterId, double reading,
      {String? notes, bool isBaseline = false}) async {
    final snap = _snapshot ?? _seedSnapshot();
    final applied = isBaseline
        ? applyOfflineBaseline(snap, meterId, reading,
            DateTime.now().millisecondsSinceEpoch ~/ 1000,
            timestamp: DateTime.now().millisecondsSinceEpoch)
        : applyOfflineManualReading(snap, meterId, reading,
            notes: notes,
            timestamp: DateTime.now().millisecondsSinceEpoch);
    _applyLocal(applied);
    if (_disposed) return;
    try {
      final resp = await _api.postManualReading(
        meterId, reading,
        notes: notes, isBaseline: isBaseline,
      );
      if (_disposed) return;
      _applySnapshot(resp);
      source = EnergyDataSource.live;
      _leaveOffline();
      errorMessage = null;
    } catch (e) {
      if (_disposed) return;
      _enterOffline();
    }
  }

  Future<void> deleteLog(String id) async {
    logs = logs.where((l) => l.id != id).toList();
    _snapshot = _snapshot?.copyWith(manualLogs: logs);
    notifyListeners();
    if (_disposed) return;
    try {
      await _api.deleteManualReading(id);
    } catch (_) {
      // best-effort: keep the local list as-is
    }
  }

  Future<void> setLastMonthTotal(double value) async {
    final snap = _snapshot ?? _seedSnapshot();
    _applyLocal(applyOfflineLastMonthTotal(snap, value));
    if (_disposed) return;
    try {
      await _api.postLastMonthTotal(value);
      errorMessage = null;
    } catch (_) {
      _enterOffline();
    }
  }

  void setOverlay(bool value) {
    overlayEnabled = value;
    notifyListeners();
  }

  MeterState meter(MeterId id) =>
      meters.firstWhere((m) => m.id == id, orElse: () => meters.first);

  // ── Helpers ─────────────────────────────────────────────────────────

  static List<FlowPoint> _toFlowPoints(List<EnergyFlowPoint> pts) => pts
      .map((p) => FlowPoint(
            timestamp: p.timestamp ~/ 1000,
            solarKw: p.solarKw,
            gridKw: p.gridKw,
            loadKw: p.loadKw,
          ))
      .toList();

  /// Builds a DashboardSnapshot from the seed mock values — the drift base
  /// used when the app starts with no backend and for the offline engine.
  DashboardSnapshot _seedSnapshot() {
    final now = DateTime.now();
    return DashboardSnapshot(
      generatedAt: now.toIso8601String(),
      activeMeter: activeMeter,
      changeover: ChangeoverState(activeMeter: activeMeter),
      tomznLive: tomzn,
      inverter: inverter,
      weather: weather,
      energyToday: energyToday,
      flowHistory: [
        for (var h = 23; h >= 0; h--)
          EnergyFlowPoint(
            timestamp: (now.millisecondsSinceEpoch ~/ 1000 - h * 3600) * 1000,
            solarKw: _seedSolarAt(now, h),
            gridKw: _seedGridAt(now, h),
            loadKw: _seedLoadAt(now, h),
          ),
        EnergyFlowPoint(
          timestamp: now.millisecondsSinceEpoch,
          solarKw: inverter.solarW / 1000,
          gridKw: tomzn.powerW / 1000,
          loadKw: inverter.loadW / 1000,
        ),
      ],
      live: live,
      gridFlow: gridFlow,
      home: home,
      meters: {
        for (final m in meters) m.id: m,
      },
      manualLogs: logs,
      ups: ups,
    );
  }

  // Deterministic seed-day shapes (bell-curve solar, twin-peak load).
  static double _seedSolarAt(DateTime now, int hoursAgo) {
    final t = now.subtract(Duration(hours: hoursAgo));
    final h = t.hour + t.minute / 60.0;
    if (h < 6 || h > 19) return 0;
    return 1.35 * math.exp(-math.pow((h - 13) / 3.6, 2));
  }

  static double _seedLoadAt(DateTime now, int hoursAgo) {
    final t = now.subtract(Duration(hours: hoursAgo));
    final h = t.hour + t.minute / 60.0;
    return 0.55 +
        (h >= 6 && h <= 10 ? 0.75 * math.exp(-math.pow((h - 8) / 1.8, 2)) : 0) +
        (h >= 17 && h <= 23 ? 1.1 * math.exp(-math.pow((h - 20) / 2.2, 2)) : 0) +
        (h >= 0 && h <= 5 ? 0.25 : 0);
  }

  static double _seedGridAt(DateTime now, int hoursAgo) {
    final t = now.subtract(Duration(hours: hoursAgo));
    final h = t.hour + t.minute / 60.0;
    final solar = _seedSolarAt(now, hoursAgo);
    final load = _seedLoadAt(now, hoursAgo);
    return math.max(0.0, load - solar) + (h >= 20 || h <= 4 ? 0.18 : 0.05);
  }
}