// HeroEnergyScene — port of the RN LiveEnergyScene + HeroOverlayEngine.
//
// Renders the scene's wallpaper, then animates the JSON-defined overlay:
// conduit + dash-travel core line + glow line for solar/grid/inverter
// wires, power-scaled particles, SOLAR/GRID/HOME labels with live power,
// inverter & db-box icons, and a glass footer with the mode chip.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../data/energy_provider.dart' show EnergyDataSource, EnergyProvider;
import '../data/energy_scope.dart';
import '../scene/scene.dart';
import '../theme/app_colors.dart';

/// Renders one wire of the overlay using the resolved wire style.
class HeroEnergyScene extends StatefulWidget {
  final HeroSceneId scene;
  final double solarW, gridW, homeW;
  final bool gridReverse;
  final bool showBypass;
  final String modeLabel;
  final Color modeColor;
  final bool systemOffline;
  final bool idle;

  /// When true the frames are driven by an internal ticker (default).
  final bool animate;

  /// Sync source shown in the footer chip (offline → amber "Estimated").
  final EnergyDataSource source;

  const HeroEnergyScene({
    super.key,
    required this.scene,
    this.solarW = 0,
    this.gridW = 0,
    this.homeW = 0,
    this.gridReverse = false,
    this.showBypass = false,
    this.modeLabel = 'Standby',
    this.modeColor = AppColors.textMuted,
    this.systemOffline = false,
    this.idle = false,
    this.animate = true,
    this.source = EnergyDataSource.loading,
  });

  @override
  State<HeroEnergyScene> createState() => _HeroEnergySceneState();
}

class _HeroEnergySceneState extends State<HeroEnergyScene>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 4),
  )..repeat();

  @override
  void didUpdateWidget(HeroEnergyScene old) {
    super.didUpdateWidget(old);
    if (widget.animate && !widget.idle) {
      if (!_controller.isAnimating) _controller.repeat();
    } else if (_controller.isAnimating) {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Use the provider's resolved overlay (applies editor overrides on top
    // of the bundled JSON) so position edits are reflected live.
    final provider = EnergyScope.of(context);
    final syncConfig = provider.resolvedOverlaySync(widget.scene);
    if (syncConfig != null) {
      return _buildOverlay(syncConfig);
    }
    // First load — use FutureBuilder, then cache kicks in for subsequent
    // rebuilds (no flicker when editor sliders change).
    return FutureBuilder<HeroOverlayConfig>(
      future: provider.resolvedOverlay(widget.scene),
      builder: (context, snapshot) {
        final config = snapshot.data;
        if (config == null) {
          return const SizedBox.shrink();
        }
        return _buildOverlay(config);
      },
    );
  }

  Widget _buildOverlay(HeroOverlayConfig config) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // ── Animated overlay (wires, dashes, particles) ────
        LayoutBuilder(builder: (context, constraints) {
          final size = Size(constraints.maxWidth, constraints.maxHeight);
          final flows = _flows();
          return AnimatedBuilder(
            animation: _controller,
            builder: (context, _) => CustomPaint(
              painter: _OverlayPainter(
                config: config,
                size: size,
                progress: widget.idle ? 0 : _controller.value,
                solar: flows[WireKind.solar]!,
                grid: flows[WireKind.grid]!,
                inverter: flows[WireKind.inverterOutput]!,
                bypass: flows[WireKind.grid]!,
                showBypass: widget.showBypass,
              ),
            ),
          );
        }),
        // ── Node icons (inverter + db box) ──────────────────
        _configIcons(config),
        // ── Labels with live power ──────────────────────────
        _configLabels(config),
        // ── Glass footer: mode chip + source + time ─────────
        _glassFooter(),
      ],
    );
  }

  Map<WireKind, WireFlowState> _flows() {
    final idleOpacity = 0.0;
    return {
      WireKind.solar: WireFlowState(
        active: !widget.systemOffline && widget.solarW >= 20,
        power: widget.solarW,
        color: AppColors.solar,
        glowColor: const Color(0xFFFFD54F),
        idleOpacity: idleOpacity,
      ),
      WireKind.grid: WireFlowState(
        active: !widget.systemOffline && widget.gridW >= 8,
        power: widget.gridW.abs(),
        color: AppColors.grid,
        glowColor: const Color(0xFF82B1FF),
        idleOpacity: idleOpacity,
        reverse: widget.gridReverse,
      ),
      WireKind.inverterOutput: WireFlowState(
        active: !widget.systemOffline && widget.homeW >= 10,
        power: widget.homeW,
        color: AppColors.home,
        glowColor: const Color(0xFF69F0AE),
        idleOpacity: idleOpacity,
      ),
    };
  }

  /// Inverter + db-box icons anchored at the config positions.
  Widget _configIcons(HeroOverlayConfig config) {
    return LayoutBuilder(builder: (context, constraints) {
      final size = Size(constraints.maxWidth, constraints.maxHeight);
      final inv = scalePoint(config.inverterPosition, config.viewBox, size);
      final db = scalePoint(config.dbBoxPosition, config.viewBox, size);
      return Stack(
        children: [
          Positioned(
            left: inv.x - 15, top: inv.y - 15,
            child: Container(
              width: 30, height: 30,
              decoration: BoxDecoration(
                color: const Color(0xCC0D1320),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.info.withValues(alpha: 0.4)),
                boxShadow: const [
                  BoxShadow(color: Color(0x66000000), blurRadius: 8),
                ],
              ),
              child: Icon(Icons.bolt_rounded, size: 15, color: AppColors.info),
            ),
          ),
          Positioned(
            left: db.x - 13, top: db.y - 13,
            child: Container(
              width: 26, height: 26,
              decoration: BoxDecoration(
                color: const Color(0xCC0D1320),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.textMuted.withValues(alpha: 0.35)),
              ),
              child: Icon(Icons.grid_view_rounded, size: 13, color: AppColors.textMuted),
            ),
          ),
        ],
      );
    });
  }

  /// SOLAR / GRID / HOME labels with live kW values.
  Widget _configLabels(HeroOverlayConfig config) {
    return LayoutBuilder(builder: (context, constraints) {
      final size = Size(constraints.maxWidth, constraints.maxHeight);
      final fs = size.width / 1000;

      Widget label(OverlayLabelPosition pos, String title, String value, Color color) {
        final p = scalePoint(OverlayPoint(pos.x, pos.y), config.viewBox, size);
        final dx = switch (pos.anchor) {
          'center' => -45.0,
          'right' => -90.0,
          _ => 0.0,
        };
        return Positioned(
          left: p.x + dx,
          top: p.y,
          child: SizedBox(
            width: 90,
            child: Column(
              children: [
                Text(title,
                    style: TextStyle(
                      fontFamily: 'Outfit',
                      fontSize: math.max(8, fs * 13),
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                      color: Colors.white.withValues(alpha: 0.85),
                      shadows: const [
                        Shadow(color: Color(0xAA000000), blurRadius: 6),
                      ],
                    )),
                const SizedBox(height: 1),
                Text.rich(
                  TextSpan(
                    text: value,
                    style: TextStyle(
                      fontFamily: 'Outfit',
                      fontSize: math.max(10, fs * 18),
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                      color: color,
                      shadows: const [
                        Shadow(color: Color(0xAA000000), blurRadius: 8),
                      ],
                    ),
                    children: [
                      TextSpan(
                        text: value.endsWith('kW') ? '' : ' W',
                        style: TextStyle(
                          fontSize: math.max(8, fs * 11),
                          fontWeight: FontWeight.w600,
                          color: color.withValues(alpha: 0.9),
                        ),
                      ),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        );
      }

      return Stack(
        children: [
          label(config.solarLabelPosition, 'SOLAR',
              _fmtPower(widget.solarW), AppColors.solar),
          label(config.gridLabelPosition, 'GRID',
              _fmtSigned(widget.gridW, widget.gridReverse), AppColors.grid),
          label(config.homeLabelPosition, 'HOME',
              _fmtPower(widget.homeW), AppColors.home),
        ],
      );
    });
  }

  Widget _glassFooter() {
    final sourceLabel = switch (widget.source) {
      EnergyDataSource.live => 'LIVE',
      EnergyDataSource.offline => 'ESTIMATED',
      EnergyDataSource.loading => '...',
    };
    final sourceColor = switch (widget.source) {
      EnergyDataSource.live => AppColors.success,
      EnergyDataSource.offline => AppColors.warning,
      EnergyDataSource.loading => AppColors.textMuted,
    };
    return Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xB30D1320),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 7, height: 7,
                decoration: BoxDecoration(color: widget.modeColor, shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: widget.modeColor.withValues(alpha: 0.7), blurRadius: 6)])),
              const SizedBox(width: 7),
              Text(widget.modeLabel,
                  style: AppType.inter(10.5, color: Colors.white, weight: FontWeight.w700, letterSpacing: 0.4)),
              const SizedBox(width: 9),
              Container(width: 1, height: 12, color: Colors.white.withValues(alpha: 0.15)),
              const SizedBox(width: 9),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: sourceColor.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: sourceColor.withValues(alpha: 0.4)),
                ),
                child: Text(sourceLabel,
                    style: AppType.mono(8, color: sourceColor, letterSpacing: 1)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _fmtPower(double w) {
    if (w >= 1000) return '${(w / 1000).toStringAsFixed(2)}kW';
    if (w >= 10) return w.round().toString();
    return '<10';
  }

  static String _fmtSigned(double w, bool reverse) {
    if (w == 0) return '0';
    if (w >= 1000) return '${(w / 1000).toStringAsFixed(2)}kW';
    if (w >= 10) return w.round().toString();
    return reverse ? '≪' : '≫';
  }
}

// ── Overlay painter: conduit, dash-travel lines, glow, particles ───────

class _OverlayPainter extends CustomPainter {
  final HeroOverlayConfig config;
  final Size size;
  final double progress;
  final WireFlowState solar, grid, inverter;
  final WireFlowState bypass;
  final bool showBypass;

  _OverlayPainter({
    required this.config,
    required this.size,
    required this.progress,
    required this.solar,
    required this.grid,
    required this.inverter,
    required this.bypass,
    required this.showBypass,
  });

  @override
  void paint(Canvas canvas, Size size) {
    _drawWire(canvas, config.solarPath, solar, WireKind.solar);
    _drawWire(canvas, config.gridPath, grid, WireKind.grid);
    _drawWire(canvas, config.inverterOutputPath, inverter, WireKind.inverterOutput);
    if (showBypass && config.gridBypassPath != null) {
      _drawWire(canvas, config.gridBypassPath!, bypass, WireKind.grid);
    }
  }

  void _drawWire(Canvas canvas, List<OverlayPoint> raw, WireFlowState flow, WireKind kind) {
    if (raw.length < 2) return;
    final style = getOverlayWireStyle(config, kind);
    final path = pointsToPath(raw, config.viewBox, size);
    final active = flow.active;

    // 1. Conduit — wide soft underlay.
    final conduit = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = style.conduitWidth ?? 6
      ..strokeCap = StrokeCap.round
      ..color = (style.conduitColor ?? Colors.black45)
          .withValues(alpha: (style.conduitOpacity ?? 0.7) * (active ? 1 : 0.5));
    canvas.drawPath(path, conduit);

    final coreOpacity = wireOpacity(
      active, flow.power,
      style.idleOpacity ?? 0.12,
      style.powerCeilingW ?? 2500,
      style.activeOpacityFloor ?? 0.38,
      style.activeOpacityCeiling ?? 0.9,
    );

    // 2. Core line with dash travel (manual dash — PathEffects is
    //    unavailable in this SDK).
    final dash = parseDashArray(style.dashArray);
    final phase = -(progress * (style.dashTravel ?? 40));
    final core = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = style.strokeWidth ?? 2.4
      ..strokeCap = StrokeCap.round
      ..color = flow.color.withValues(alpha: coreOpacity);
    canvas.drawPath(_dashPath(path, dash, phase), core);

    // 3. Glow line — wider, blurred, slower dash.
    final glowDash = parseDashArray(style.glowDashArray);
    final glow = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = style.glowWidth ?? 5
      ..strokeCap = StrokeCap.round
      ..color = flow.glowColor.withValues(alpha: coreOpacity * 0.5)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
    canvas.drawPath(_dashPath(path, glowDash, phase * 0.6), glow);

    if (!active || flow.power < 8) return;

    // 4. Particles — count + speed scale with power.
    final count = style.particleCount ?? 3;
    final minMs = style.minDurationMs ?? 700;
    final maxMs = style.maxDurationMs ?? 3000;
    final ceiling = style.powerCeilingW ?? 2500;
    final durMs = flowDurationFromPower(flow.power, minMs, maxMs, ceiling);
    final refMs = 4000.0;
    final speed = refMs / durMs.clamp(200, 12000);

    for (var k = 0; k < count.clamp(1, 6); k++) {
      var t = (progress * speed + k / count) % 1.0;
      if (flow.reverse) t = 1 - t;
      final p = getPointOnPath(raw, t, config.viewBox, size);
      final fade = _fade(t);
      if (fade <= 0) continue;
      final r = (style.minParticleRadius ?? 1.0) +
          (flow.power / ceiling).clamp(0.0, 1.0) *
              ((style.maxParticleRadius ?? 1.6) - (style.minParticleRadius ?? 1.0));
      canvas.drawCircle(
          Offset(p.x, p.y),
          r * 3.2,
          Paint()
            ..color = flow.color.withValues(alpha: 0.14 * fade)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
      canvas.drawCircle(Offset(p.x, p.y), r, Paint()
        ..color = flow.glowColor.withValues(alpha: 0.95 * fade));
    }
  }

/// Builds a dashed variant of [source] using [pattern] (alternating
/// dash/gap lengths, starting with a dash) and [phase] start offset —
/// mirrors strokeDashoffset semantics; a growing |phase| marches the
/// dashes forward along the path.
static Path _dashPath(Path source, List<double> pattern, double phase) {
  final out = Path();
  if (pattern.isEmpty) return source;
  final total = pattern.reduce((a, b) => a + b);
  if (total <= 0) return source;
  var start = phase % total;
  if (start < 0) start += total;

  for (final metric in source.computeMetrics()) {
    final len = metric.length;
    if (len <= 0) continue;

    // Find the pattern segment that `start` lands in.
    var consumed = 0.0;
    var idx = 0;
    while (start >= consumed + pattern[idx]) {
      consumed += pattern[idx];
      idx = (idx + 1) % pattern.length;
    }
    var remainingInSegment = pattern[idx] - (start - consumed);
    var on = idx.isEven;
    var d = 0.0;

    while (d < len) {
      final end = math.min(d + remainingInSegment, len);
      if (on) out.addPath(metric.extractPath(d, end), Offset.zero);
      d = end;
      idx = (idx + 1) % pattern.length;
      remainingInSegment = pattern[idx];
      on = idx.isEven;
    }
  }
  return out;
}

  double _fade(double t) {
    if (t < 0.06) return t / 0.06;
    if (t > 0.92) return (1 - t) / 0.08;
    return 1;
  }

  @override
  bool shouldRepaint(_OverlayPainter old) =>
      old.progress != progress ||
      old.solar != solar || old.grid != grid ||
      old.inverter != inverter || old.bypass != bypass ||
      old.showBypass != showBypass ||
      old.config != config;
}