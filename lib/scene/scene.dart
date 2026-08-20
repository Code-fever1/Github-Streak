// Scene system — direct port of src/overlay/{types,heroScenes,wireStyles,
// pathUtils} from the React Native app. Overlay configs are bundled JSON
// assets (assets/overlays/*.json), same files the RN app uses.

import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/services.dart' show rootBundle;

import '../models/energy.dart';

enum HeroSceneId {
  night('night'),
  rainLight('rain-light'),
  cloudsDark('clouds-dark'),
  fog('fog'),
  evening('evening'),
  morningCloud('morning-cloud');

  const HeroSceneId(this.id);
  final String id;

  static HeroSceneId fromId(String id) => HeroSceneId.values.firstWhere(
        (s) => s.id == id,
        orElse: () => HeroSceneId.morningCloud,
      );
}

class OverlayPoint {
  final double x, y;
  const OverlayPoint(this.x, this.y);

  factory OverlayPoint.fromJson(Map<String, dynamic> j) =>
      OverlayPoint((j['x'] as num?)?.toDouble() ?? 0,
          (j['y'] as num?)?.toDouble() ?? 0);
}

class OverlayViewBox {
  final double width, height;
  const OverlayViewBox(this.width, this.height);
}

class OverlayLabelPosition {
  final double x, y;
  final String? anchor; // left | center | right
  const OverlayLabelPosition(this.x, this.y, this.anchor);
}

enum WireKind { solar, grid, inverterOutput }

class OverlayWireStyle {
  final Color? conduitColor;
  final double? conduitOpacity, conduitWidth, strokeWidth, glowWidth;
  final String? dashArray, glowDashArray;
  final double? dashTravel;
  final int? particleCount;
  final double? minDurationMs, maxDurationMs, powerCeilingW;
  final double? minParticleRadius, maxParticleRadius;
  final double? activeOpacityFloor, activeOpacityCeiling, idleOpacity;

  const OverlayWireStyle({
    this.conduitColor,
    this.conduitOpacity,
    this.conduitWidth,
    this.strokeWidth,
    this.glowWidth,
    this.dashArray,
    this.glowDashArray,
    this.dashTravel,
    this.particleCount,
    this.minDurationMs,
    this.maxDurationMs,
    this.powerCeilingW,
    this.minParticleRadius,
    this.maxParticleRadius,
    this.activeOpacityFloor,
    this.activeOpacityCeiling,
    this.idleOpacity,
  });

  factory OverlayWireStyle.fromJson(Map<String, dynamic> j) =>
      OverlayWireStyle(
        conduitColor: _parseColor(j['conduitColor'] as String?),
        conduitOpacity: (j['conduitOpacity'] as num?)?.toDouble(),
        conduitWidth: (j['conduitWidth'] as num?)?.toDouble(),
        strokeWidth: (j['strokeWidth'] as num?)?.toDouble(),
        glowWidth: (j['glowWidth'] as num?)?.toDouble(),
        dashArray: j['dashArray'] as String?,
        glowDashArray: j['glowDashArray'] as String?,
        dashTravel: (j['dashTravel'] as num?)?.toDouble(),
        particleCount: (j['particleCount'] as num?)?.toInt(),
        minDurationMs: (j['minDurationMs'] as num?)?.toDouble(),
        maxDurationMs: (j['maxDurationMs'] as num?)?.toDouble(),
        powerCeilingW: (j['powerCeilingW'] as num?)?.toDouble(),
        minParticleRadius: (j['minParticleRadius'] as num?)?.toDouble(),
        maxParticleRadius: (j['maxParticleRadius'] as num?)?.toDouble(),
        activeOpacityFloor: (j['activeOpacityFloor'] as num?)?.toDouble(),
        activeOpacityCeiling: (j['activeOpacityCeiling'] as num?)?.toDouble(),
        idleOpacity: (j['idleOpacity'] as num?)?.toDouble(),
      );

  OverlayWireStyle copyWith(OverlayWireStyle o) => OverlayWireStyle(
        conduitColor: o.conduitColor ?? conduitColor,
        conduitOpacity: o.conduitOpacity ?? conduitOpacity,
        conduitWidth: o.conduitWidth ?? conduitWidth,
        strokeWidth: o.strokeWidth ?? strokeWidth,
        glowWidth: o.glowWidth ?? glowWidth,
        dashArray: o.dashArray ?? dashArray,
        glowDashArray: o.glowDashArray ?? glowDashArray,
        dashTravel: o.dashTravel ?? dashTravel,
        particleCount: o.particleCount ?? particleCount,
        minDurationMs: o.minDurationMs ?? minDurationMs,
        maxDurationMs: o.maxDurationMs ?? maxDurationMs,
        powerCeilingW: o.powerCeilingW ?? powerCeilingW,
        minParticleRadius: o.minParticleRadius ?? minParticleRadius,
        maxParticleRadius: o.maxParticleRadius ?? maxParticleRadius,
        activeOpacityFloor: o.activeOpacityFloor ?? activeOpacityFloor,
        activeOpacityCeiling: o.activeOpacityCeiling ?? activeOpacityCeiling,
        idleOpacity: o.idleOpacity ?? idleOpacity,
      );

  static Color? _parseColor(String? s) {
    if (s == null) return null;
    return _rgba(s);
  }
}

class HeroOverlayConfig {
  final String id;
  final String background; // wallpaper file name in assets/scenes/
  final OverlayViewBox viewBox;
  final List<OverlayPoint> solarPath, gridPath, inverterOutputPath;
  final List<OverlayPoint>? gridBypassPath;
  final OverlayLabelPosition solarLabelPosition, gridLabelPosition,
      homeLabelPosition;
  final OverlayPoint inverterPosition, dbBoxPosition;
  final Map<String, OverlayWireStyle> wireStyles;

  const HeroOverlayConfig({
    required this.id,
    required this.background,
    required this.viewBox,
    required this.solarPath,
    required this.gridPath,
    required this.inverterOutputPath,
    this.gridBypassPath,
    required this.solarLabelPosition,
    required this.gridLabelPosition,
    required this.homeLabelPosition,
    required this.inverterPosition,
    required this.dbBoxPosition,
    this.wireStyles = const {},
  });

  factory HeroOverlayConfig.fromJson(Map<String, dynamic> j) {
    List<OverlayPoint> points(String key) =>
        ((j[key] as List?) ?? const [])
            .map((e) => OverlayPoint.fromJson(e as Map<String, dynamic>))
            .toList();
    OverlayLabelPosition label(String key) {
      final l = j[key] as Map<String, dynamic>? ?? {};
      return OverlayLabelPosition((l['x'] as num?)?.toDouble() ?? 0,
          (l['y'] as num?)?.toDouble() ?? 0, l['anchor'] as String?);
    }

    OverlayPoint point(String key) {
      final p = j[key] as Map<String, dynamic>? ?? {};
      return OverlayPoint((p['x'] as num?)?.toDouble() ?? 0,
          (p['y'] as num?)?.toDouble() ?? 0);
    }

    final vb = j['viewBox'] as Map<String, dynamic>? ?? {};
    final ws = j['wireStyles'] as Map<String, dynamic>? ?? {};
    return HeroOverlayConfig(
      id: j['id'] as String? ?? '',
      background: j['background'] as String? ?? '',
      viewBox: OverlayViewBox((vb['width'] as num?)?.toDouble() ?? 1000,
          (vb['height'] as num?)?.toDouble() ?? 800),
      solarPath: points('solarPath'),
      gridPath: points('gridPath'),
      inverterOutputPath: points('inverterOutputPath'),
      gridBypassPath: j['gridBypassPath'] == null
          ? null
          : points('gridBypassPath'),
      solarLabelPosition: label('solarLabelPosition'),
      gridLabelPosition: label('gridLabelPosition'),
      homeLabelPosition: label('homeLabelPosition'),
      inverterPosition: point('inverterPosition'),
      dbBoxPosition: point('dbBoxPosition'),
      wireStyles: ws.map((key, value) =>
          MapEntry(key, OverlayWireStyle.fromJson(value as Map<String, dynamic>))),
    );
  }
}

/// Wire flow animation state — mirrors WireFlowState in the RN overlay.
class WireFlowState {
  final bool active;
  final double power;
  final Color color;
  final Color glowColor;
  final double? idleOpacity;
  final bool reverse;

  const WireFlowState({
    required this.active,
    required this.power,
    required this.color,
    required this.glowColor,
    this.idleOpacity,
    this.reverse = false,
  });
}

/// Parse an rgba()/rgb()/hex color string (same parser as ColorInterpolation).
Color _rgba(String s) {
  final trimmed = s.trim();
  if (trimmed.startsWith('rgba(') || trimmed.startsWith('rgb(')) {
    final matches = RegExp(r'\d+(?:\.\d+)?').allMatches(trimmed).toList();
    if (matches.length >= 3) {
      return Color.fromRGBO(
        int.parse(matches[0].group(0)!),
        int.parse(matches[1].group(0)!),
        int.parse(matches[2].group(0)!),
        matches.length >= 4 ? double.parse(matches[3].group(0)!) : 1,
      );
    }
  }
  final hex = trimmed.replaceFirst('#', '');
  if (hex.length != 6) return const Color(0xFFFFFFFF);
  return Color(0xFF000000 |
      int.parse(hex.substring(0, 2), radix: 16) << 16 |
      int.parse(hex.substring(2, 4), radix: 16) << 8 |
      int.parse(hex.substring(4, 6), radix: 16));
}

/// withAlpha — color + alpha in 0..1.
Color withAlpha(Color c, double alpha) =>
    Color.fromARGB((alpha.clamp(0.0, 1.0) * 255).round(), c.r.toInt(),
        c.g.toInt(), c.b.toInt());

const Duration _kSceneLoadTimeout = Duration(seconds: 5);

/// Loads a scene's overlay config from bundled assets.
Future<HeroOverlayConfig> loadOverlayConfig(HeroSceneId scene) async {
  final raw = await rootBundle
      .loadString('assets/overlays/${scene.id}.json')
      .timeout(_kSceneLoadTimeout);
  return HeroOverlayConfig.fromJson(
      (raw.isEmpty) ? <String, dynamic>{} : jsonDecodeSafe(raw));
}

Map<String, dynamic> jsonDecodeSafe(String raw) {
  try {
    return (json.decode(raw) as Map<String, dynamic>);
  } catch (_) {
    return <String, dynamic>{};
  }
}

// -- Scene resolution (heroScenes.ts) -------------------------------------

const int _kEveningWindowMs = 20 * 60 * 1000;

/// WMO weather codes: fog, heavy rain, overcast/drizzle.
HeroSceneId resolveHeroSceneId(WeatherState weather) {
  final code = weather.code;
  final sunriseMs = weather.sunrise != null
      ? DateTime.tryParse(weather.sunrise!)?.millisecondsSinceEpoch
      : null;
  final sunsetMs = weather.sunset != null
      ? DateTime.tryParse(weather.sunset!)?.millisecondsSinceEpoch
      : null;
  final nowMs = DateTime.now().millisecondsSinceEpoch;
  final hour = DateTime.now().hour;

  String phase;
  if (sunriseMs != null && sunsetMs != null) {
    if (nowMs < sunriseMs) {
      phase = 'night';
    } else if (nowMs >= sunsetMs - _kEveningWindowMs &&
        nowMs < sunsetMs + _kEveningWindowMs) {
      phase = 'evening';
    } else if (nowMs >= sunsetMs + _kEveningWindowMs) {
      phase = 'night';
    } else {
      phase = 'day';
    }
  } else {
    if (hour >= 5 && hour < 18) {
      phase = 'day';
    } else if (hour >= 18 && hour < 19) {
      phase = 'evening';
    } else {
      phase = 'night';
    }
  }

  if (phase == 'night') return HeroSceneId.night;

  if (code == 45 || code == 48) return HeroSceneId.fog;
  if ((code >= 61 && code <= 67) ||
      (code >= 80 && code <= 82) ||
      (code >= 95 && code <= 99)) {
    return HeroSceneId.rainLight;
  }
  if (code == 3 || (code >= 51 && code <= 57)) return HeroSceneId.cloudsDark;

  if (phase == 'evening') return HeroSceneId.evening;
  return HeroSceneId.morningCloud;
}

class SceneSheetGradient {
  final (double, double, double) seam, sky, mid;
  const SceneSheetGradient(this.seam, this.sky, this.mid);
}

/// Per-scene sheet gradient colors, sampled from each background image
/// (heroScenes.ts HERO_SCENE_SHEET_COLORS).
const Map<HeroSceneId, SceneSheetGradient> kSceneSheetColors = {
  HeroSceneId.night: SceneSheetGradient((26, 35, 53), (6, 21, 45), (16, 28, 49)),
  HeroSceneId.rainLight: SceneSheetGradient((83, 83, 83), (65, 70, 75), (75, 78, 80)),
  HeroSceneId.cloudsDark: SceneSheetGradient((75, 75, 78), (70, 75, 82), (72, 75, 80)),
  HeroSceneId.fog: SceneSheetGradient((155, 155, 160), (175, 185, 198), (165, 170, 178)),
  HeroSceneId.evening: SceneSheetGradient((120, 95, 80), (172, 144, 139), (146, 119, 109)),
  HeroSceneId.morningCloud: SceneSheetGradient((148, 142, 140), (125, 159, 198), (136, 150, 169)),
};

String wallpaperAssetFor(HeroSceneId scene) =>
    'assets/scenes/z-${scene.id}.jpeg';

// -- Wire styles (wireStyles.ts) -------------------------------------------

final Map<WireKind, OverlayWireStyle> kDefaultWireStyles = {
  WireKind.solar: const OverlayWireStyle(
    conduitColor: Color(0x94564314), // rgba(86,67,20,0.58)
    conduitOpacity: 0.8, conduitWidth: 7, strokeWidth: 2.6, glowWidth: 5.6,
    dashArray: '10 16', glowDashArray: '18 14', dashTravel: 64,
    particleCount: 3, minDurationMs: 700, maxDurationMs: 2800,
    powerCeilingW: 4000, minParticleRadius: 0.5, maxParticleRadius: 1.5,
    activeOpacityFloor: 0.38, activeOpacityCeiling: 0.82, idleOpacity: 0.14,
  ),
  WireKind.grid: const OverlayWireStyle(
    conduitColor: Color(0x9E2A4067), // rgba(42,64,103,0.62)
    conduitOpacity: 0.82, conduitWidth: 7.5, strokeWidth: 2.8, glowWidth: 5.8,
    dashArray: '9 15', glowDashArray: '16 14', dashTravel: 60,
    particleCount: 3, minDurationMs: 700, maxDurationMs: 3200,
    powerCeilingW: 2500, minParticleRadius: 1.0, maxParticleRadius: 1.5,
    activeOpacityFloor: 0.38, activeOpacityCeiling: 0.94, idleOpacity: 0.14,
  ),
  WireKind.inverterOutput: const OverlayWireStyle(
    conduitColor: Color(0x8F145130), // rgba(20,81,48,0.56)
    conduitOpacity: 0.8, conduitWidth: 6.4, strokeWidth: 2.2, glowWidth: 4.9,
    dashArray: '7 17', glowDashArray: '14 16', dashTravel: 52,
    particleCount: 2, minDurationMs: 600, maxDurationMs: 2500,
    powerCeilingW: 3000, minParticleRadius: 0.5, maxParticleRadius: 2.0,
    activeOpacityFloor: 0.42, activeOpacityCeiling: 0.95, idleOpacity: 0.12,
  ),
};

const Map<WireKind, String> kWireKindKey = {
  WireKind.solar: 'solar',
  WireKind.grid: 'grid',
  WireKind.inverterOutput: 'inverterOutput',
};

OverlayWireStyle getOverlayWireStyle(
    HeroOverlayConfig config, WireKind kind) {
  final style = config.wireStyles[kWireKindKey[kind]];
  if (style == null) return kDefaultWireStyles[kind]!;
  return kDefaultWireStyles[kind]!.copyWith(style);
}

// -- Path math (pathUtils.ts) ----------------------------------------------

OverlayPoint scalePoint(OverlayPoint p, OverlayViewBox vb, Size size) =>
    OverlayPoint((p.x / vb.width) * size.width, (p.y / vb.height) * size.height);

List<OverlayPoint> scalePoints(
        List<OverlayPoint> points, OverlayViewBox vb, Size size) =>
    points.map((p) => scalePoint(p, vb, size)).toList();

/// Build a Path polyline from unit-space points scaled to the viewport.
Path pointsToPath(List<OverlayPoint> points, OverlayViewBox vb, Size size) {
  final path = Path();
  if (points.isEmpty) return path;
  final scaled = scalePoints(points, vb, size);
  path.moveTo(scaled.first.x, scaled.first.y);
  for (final p in scaled.skip(1)) {
    path.lineTo(p.x, p.y);
  }
  return path;
}

class _Segment {
  final double x1, y1, x2, y2, length;
  const _Segment(this.x1, this.y1, this.x2, this.y2, this.length);
}

List<_Segment> _buildSegments(
    List<OverlayPoint> points, OverlayViewBox vb, Size size) {
  final scaled = scalePoints(points, vb, size);
  final segments = <_Segment>[];
  for (var i = 0; i < scaled.length - 1; i++) {
    final a = scaled[i];
    final b = scaled[i + 1];
    final dx = b.x - a.x;
    final dy = b.y - a.y;
    final length = math.sqrt(dx * dx + dy * dy);
    if (length > 0) segments.add(_Segment(a.x, a.y, b.x, b.y, length));
  }
  return segments;
}

/// Interpolated position along a polyline. t is 0..1.
({double x, double y}) getPointOnPath(
    List<OverlayPoint> points, double t, OverlayViewBox vb, Size size) {
  final segments = _buildSegments(points, vb, size);
  if (segments.isEmpty) return (x: 0, y: 0);
  final total = segments.fold<double>(0, (sum, s) => sum + s.length);
  if (total <= 0) return (x: segments.first.x1, y: segments.first.y1);
  final clamped = t.clamp(0.0, 1.0);
  var remaining = clamped * total;
  for (final seg in segments) {
    if (remaining <= seg.length) {
      final ratio = seg.length == 0 ? 0.0 : remaining / seg.length;
      return (
        x: seg.x1 + (seg.x2 - seg.x1) * ratio,
        y: seg.y1 + (seg.y2 - seg.y1) * ratio,
      );
    }
    remaining -= seg.length;
  }
  final last = segments.last;
  return (x: last.x2, y: last.y2);
}

double getPathLength(
        List<OverlayPoint> points, OverlayViewBox vb, Size size) =>
    _buildSegments(points, vb, size)
        .fold<double>(0, (sum, s) => sum + s.length);

/// Duration in ms — higher power → faster flow (sqrt power curve).
double flowDurationFromPower(
    double powerW, double minMs, double maxMs, double powerCeilingW) {
  final clamped = powerW.clamp(0.0, powerCeilingW);
  final ratio = clamped / powerCeilingW;
  final curved = math.sqrt(ratio);
  return maxMs - curved * (maxMs - minMs);
}

double wireOpacity(bool active, double powerW, double idleOpacity,
    double powerCeilingW, double activeFloor, double activeCeiling) {
  if (!active) return idleOpacity;
  final clamped = powerW.clamp(0.0, powerCeilingW);
  final span = (activeCeiling - activeFloor).clamp(0.0, 1e9);
  return activeFloor + (clamped / powerCeilingW) * span;
}

/// Parse "10 14" style dash arrays into [dash, gap].
List<double> parseDashArray(String? s, [String fallback = '6 18']) {
  final parts = (s ?? fallback)
      .trim()
      .split(RegExp(r'\s+'))
      .map(double.tryParse)
      .whereType<double>()
      .toList();
  return parts.length >= 2 ? parts : [6, 18];
}

/// Map screen coords back into viewBox space (config authoring).
OverlayPoint screenToViewBox(
    double x, double y, OverlayViewBox vb, Size size) =>
    OverlayPoint(
        ((x / size.width) * vb.width).roundToDouble(),
        ((y / size.height) * vb.height).roundToDouble());