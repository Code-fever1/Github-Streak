// REST + SSE client for the Voltix backend (/api/solar/*).
// Mirrors the RN EnergyContext API usage: full dashboard on open, SSE live
// stream for instant updates, delta sync for the 30s poll.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/energy.dart';

/// Same base URL the React Native app uses.
const String kApiBaseUrl = 'http://104.43.56.204:3001/api/solar';

/// Live payload pushed over SSE and returned by /live.
class LivePayload {
  final TomznLive tomznLive;
  final InverterTelemetry inverter;
  final GridFlow? gridFlow;
  final UpsState? ups;
  final WeatherState? weather;
  final LiveTelemetry? live;

  const LivePayload({
    required this.tomznLive,
    required this.inverter,
    this.gridFlow,
    this.ups,
    this.weather,
    this.live,
  });

  factory LivePayload.fromJson(Map<String, dynamic> j) => LivePayload(
        tomznLive: TomznLive.fromJson(
            (j['tomznLive'] as Map<String, dynamic>?) ?? {}),
        inverter: InverterTelemetry.fromJson(
            (j['inverter'] as Map<String, dynamic>?) ?? {}),
        gridFlow: j['gridFlow'] == null
            ? null
            : GridFlow.fromJson(j['gridFlow'] as Map<String, dynamic>),
        ups: j['ups'] == null
            ? null
            : UpsState.fromJson(j['ups'] as Map<String, dynamic>),
        weather: j['weather'] == null
            ? null
            : WeatherState.fromJson(j['weather'] as Map<String, dynamic>),
        live: j['live'] == null
            ? null
            : LiveTelemetry.fromJson(j['live'] as Map<String, dynamic>),
      );
}

class ApiException implements Exception {
  final String message;
  final int? status;
  const ApiException(this.message, [this.status]);
  @override
  String toString() => 'ApiException($status): $message';
}

class ApiClient {
  final String baseUrl;
  final Duration timeout;
  final http.Client _http;

  ApiClient({
    this.baseUrl = kApiBaseUrl,
    this.timeout = const Duration(seconds: 15),
  }) : _http = http.Client();

  Map<String, String> get _headers => {'Content-Type': 'application/json'};

  dynamic _decode(String body) {
    try {
      return jsonDecode(body);
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  Future<Map<String, dynamic>> getJson(String path,
      [Map<String, String>? query]) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final resp = await _http.get(uri, headers: _headers).timeout(timeout);
    if (resp.statusCode >= 400) {
      throw ApiException('GET $path failed (${resp.statusCode})',
          resp.statusCode);
    }
    return (_decode(resp.body) as Map<String, dynamic>?) ?? {};
  }

  Future<Map<String, dynamic>> postJson(
      String path, Map<String, dynamic> body,
      [Map<String, String>? query]) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final resp = await _http
        .post(uri, headers: _headers, body: jsonEncode(body))
        .timeout(timeout);
    if (resp.statusCode >= 400) {
      throw ApiException('POST $path failed (${resp.statusCode})',
          resp.statusCode);
    }
    return (_decode(resp.body) as Map<String, dynamic>?) ?? {};
  }

  Future<void> deleteJson(String path) async {
    final resp = await _http
        .delete(Uri.parse('$baseUrl$path'), headers: _headers)
        .timeout(timeout);
    if (resp.statusCode >= 400) {
      throw ApiException('DELETE $path failed (${resp.statusCode})',
          resp.statusCode);
    }
  }

  // ── Endpoints (mirror backend/unified_solar_routes.js) ────────────────

  Future<DashboardSnapshot> fetchDashboard() async {
    final j = await getJson('/dashboard');
    return DashboardSnapshot.fromJson(j);
  }

  Future<LivePayload> fetchLive({bool force = false}) async {
    final j = await getJson('/live', force ? {'force': 'true'} : null);
    return LivePayload.fromJson(j);
  }

  /// Delta sync — returns live hero fields when nothing changed, else the
  /// full dashboard. [sinceVersion] is the client's last dataVersion.
  Future<((bool changed, int dataVersion), DashboardSnapshot? dashboard,
      LivePayload? live)> sync(String sinceVersion) async {
    final j = await getJson('/dashboard/sync', {'since': sinceVersion});
    final changed = j['changed'] as bool? ?? false;
    final version = (j['dataVersion'] as num?)?.toInt() ?? 0;
    if (changed && j['dashboard'] != null) {
      return (
        (true, version),
        DashboardSnapshot.fromJson(
            j['dashboard'] as Map<String, dynamic>),
        _liveFromPartial(j),
      );
    }
    return ((false, version), null, _liveFromPartial(j));
  }

  LivePayload _liveFromPartial(Map<String, dynamic> j) {
    final tomzn = j['tomznLive'] == null
        ? null
        : TomznLive.fromJson(j['tomznLive'] as Map<String, dynamic>);
    final inverter = j['inverter'] == null
        ? null
        : InverterTelemetry.fromJson(j['inverter'] as Map<String, dynamic>);
    if (tomzn == null && inverter == null) {
      throw const ApiException('sync response missing live data');
    }
    return LivePayload(
      tomznLive: tomzn ??
          const TomznLive(
              isOnline: false, isLive: false, powerDisplay: '-- W'),
      inverter: inverter ??
          const InverterTelemetry(isOnline: false, isLive: false),
      gridFlow: j['gridFlow'] == null
          ? null
          : GridFlow.fromJson(j['gridFlow'] as Map<String, dynamic>),
      ups: j['ups'] == null
          ? null
          : UpsState.fromJson(j['ups'] as Map<String, dynamic>),
      weather: j['weather'] == null
          ? null
          : WeatherState.fromJson(j['weather'] as Map<String, dynamic>),
    );
  }

  Future<List<EnergyFlowPoint>> fetchFlowHistory() async {
    final j = await getJson('/flow-history');
    final list = (j['points'] as List?) ??
        (j['flowHistory'] as List?) ??
        const [];
    return list
        .map((e) => EnergyFlowPoint.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<DashboardSnapshot> postChangeover(String meterId,
      {int? timestamp}) async {
    final j = await postJson('/changeover', {
      'meterId': meterId,
      if (timestamp != null) 'timestamp': timestamp,
    });
    return DashboardSnapshot.fromJson(j);
  }

  Future<DashboardSnapshot> postManualReading(
      String meterId, double reading,
      {int? timestamp, String? notes, bool isBaseline = false}) async {
    final j = await postJson('/manual-readings', {
      'meterId': meterId,
      'reading': reading,
      if (timestamp != null) 'timestamp': timestamp,
      if (notes != null) 'notes': notes,
      if (isBaseline) 'baseline': true,
    });
    return DashboardSnapshot.fromJson(j);
  }

  Future<void> deleteManualReading(String id) =>
      deleteJson('/manual-readings/$id');

  Future<DashboardSnapshot> postBaseline(
      String meterId, double reading, int cycleStartTs) async {
    final j = await postJson('/baselines', {
      'meterId': meterId,
      'reading': reading,
      'cycleStartTs': cycleStartTs,
    });
    return DashboardSnapshot.fromJson(j);
  }

  Future<void> postLastMonthTotal(double total) async {
    await postJson('/last-month-total', {'total': total});
  }

  Future<DashboardSnapshot> refreshAll({bool force = true}) async {
    final j = await postJson('/refresh', {}, force ? {'force': 'true'} : null);
    return DashboardSnapshot.fromJson(
        (j['dashboard'] as Map<String, dynamic>?) ?? {});
  }

  Future<DashboardSnapshot> refreshTomzn({bool force = true}) async {
    final j = await postJson(
        '/refresh/tomzn', {}, force ? {'force': 'true'} : null);
    return DashboardSnapshot.fromJson(
        (j['dashboard'] as Map<String, dynamic>?) ?? {});
  }

  Future<DashboardSnapshot> refreshInverter({bool force = true}) async {
    final j = await postJson(
        '/refresh/inverter', {}, force ? {'force': 'true'} : null);
    return DashboardSnapshot.fromJson(
        (j['dashboard'] as Map<String, dynamic>?) ?? {});
  }

  // ── SSE stream (dart:io — no EventSource in Dart) ─────────────────────

  /// Subscribe to /live/stream. Fires for each `data:` event. Handles
  /// `:ping` keep-alive comments and auto-reconnects after ~3s on any
  /// disconnect (mirrors react-native-sse pollingInterval). Stops when the
  /// subscription is cancelled.
  Stream<LivePayload> liveStream() {
    var cancelled = false;
    late void Function() schedule;
    late final StreamController<LivePayload> controller;

    void connect() {
      if (cancelled) return;
      final client = HttpClient()
        ..connectionTimeout = const Duration(seconds: 10);
      client
          .getUrl(Uri.parse('$baseUrl/live/stream'))
          .then((request) {
            request.headers.set('Accept', 'text/event-stream');
            request.headers.set('Cache-Control', 'no-cache');
            return request.close();
          })
          .then((response) async {
            if (response.statusCode != 200) {
              throw HttpException('SSE status ${response.statusCode}');
            }
            var buffer = StringBuffer();
            response
                .transform(utf8.decoder)
                .listen((chunk) {
                  buffer.write(chunk);
                  // SSE events are separated by blank lines.
                  final parts = buffer.toString().split('\n\n');
                  buffer.clear();
                  buffer.write(parts.removeLast());
                  for (final raw in parts) {
                    final data = raw
                        .split('\n')
                        .where((l) => l.startsWith('data:'))
                        .map((l) => l.substring(5).trimLeft())
                        .join('\n');
                    if (data.isEmpty) continue;
                    try {
                      final parsed = jsonDecode(data);
                      if (parsed is Map<String, dynamic>) {
                        controller.add(LivePayload.fromJson(parsed));
                      }
                    } catch (_) {}
                  }
                }, onError: (Object _) {
                  client.close(force: true);
                  schedule();
                }, onDone: () {
                  client.close(force: true);
                  schedule();
                });
          })
          .catchError((Object _) {
            client.close(force: true);
            schedule();
          });
    }

schedule = () {
      if (cancelled) return;
      Timer(const Duration(seconds: 3), connect);
    };

    controller = StreamController<LivePayload>(
      onListen: connect,
      onCancel: () {
        cancelled = true;
      },
    );
    return controller.stream;
  }

  void dispose() {
    _http.close();
  }
}