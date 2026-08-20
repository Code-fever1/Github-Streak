import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../models/energy.dart';
import '../theme/app_colors.dart';

/// Hero scene — clean energy flow diagram (solar → inverter hub → home / grid)
/// with softly animated particles whose speed follows live power.
class EnergyFlowScene extends StatefulWidget {
  final InverterTelemetry inverter;
  final TomznLive tomzn;
  final bool systemOffline;

  const EnergyFlowScene({
    super.key,
    required this.inverter,
    required this.tomzn,
    this.systemOffline = false,
  });

  @override
  State<EnergyFlowScene> createState() => _EnergyFlowSceneState();
}

class _EnergyFlowSceneState extends State<EnergyFlowScene>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: const Duration(seconds: 4))
        ..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _modeLabel {
    final i = widget.inverter;
    final t = widget.tomzn;
    if (widget.systemOffline) return 'System Offline';
    final solar = i.solarW > 5;
    final importing = t.isOnline && t.switchOn && t.powerW > 0;
    if (solar && importing) return 'Hybrid';
    if (solar) return 'Solar Only';
    if (importing) return 'Wapda Importing';
    if (t.isOnline) return 'Idle';
    return 'Wapda Offline';
  }

  Color get _modeColor => switch (_modeLabel) {
        'Hybrid' => AppColors.success,
        'Solar Only' => AppColors.solar,
        'Wapda Importing' => AppColors.info,
        'Idle' => AppColors.warning,
        'System Offline' || 'Wapda Offline' => AppColors.danger,
        _ => AppColors.textMuted,
      };

  @override
  Widget build(BuildContext context) {
    final i = widget.inverter;
    final t = widget.tomzn;
    final offline = widget.systemOffline;

    final solarW = offline ? 0.0 : i.solarW;
    final homeW = offline ? 0.0 : i.loadW;
    final exporting = !offline && t.isOnline && t.powerW == 0 && i.gridW < 0;
    final gridW = offline ? 0.0 : (exporting ? -i.gridW : t.powerW);

    return AspectRatio(
      aspectRatio: 1.85,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const RadialGradient(
            center: Alignment(0, 0.35),
            radius: 1.15,
            colors: [Color(0xFF151F31), Color(0xFF0D1320)],
          ),
          border: Border.all(color: AppColors.border),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(23),
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return CustomPaint(
                painter: _FlowPainter(
                  progress: _controller.value,
                  solarPower: solarW,
                  homePower: homeW,
                  gridPower: gridW,
                  gridReverse: exporting,
                  solarActive: solarW >= 20,
                  homeActive: homeW >= 10,
                  gridActive: gridW >= 10,
                ),
                child: _buildNodes(solarW, homeW, gridW),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildNodes(double solarW, double homeW, double gridW) {
    return LayoutBuilder(builder: (context, constraints) {
      final w = constraints.maxWidth;
      final h = constraints.maxHeight;
      final solarX = w * 0.17;
      final gridX = w * 0.83;
      final homeX = w * 0.50;
      final nodeY = h * 0.21;
      final labelY = h * 0.435;

      return Stack(
        children: [
          // Mode chip (top center)
          Positioned(
            top: h * 0.06,
            left: 0, right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _modeColor.withValues(alpha: 0.35)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 6, height: 6,
                      decoration: BoxDecoration(color: _modeColor, shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: _modeColor.withValues(alpha: 0.7), blurRadius: 5)])),
                    const SizedBox(width: 6),
                    Text(_modeLabel, style: AppType.inter(10, color: AppColors.textPrimary, weight: FontWeight.w700, letterSpacing: 0.5)),
                  ],
                ),
              ),
            ),
          ),

          // Solar node
          Positioned(left: solarX - 19, top: nodeY - 19,
            child: const _NodeIcon(icon: Icons.wb_sunny_rounded, color: AppColors.solar)),
          Positioned(left: solarX - 34, top: labelY,
            child: _PowerLabel(power: solarW, color: AppColors.solar)),

          // Grid node
          Positioned(left: gridX - 19, top: nodeY - 19,
            child: const _NodeIcon(icon: Icons.cell_tower_rounded, color: AppColors.grid)),
          Positioned(left: gridX - 34, top: labelY,
            child: _PowerLabel(power: gridW, color: AppColors.grid)),

          // Home node
          Positioned(left: homeX - 19, top: nodeY - 19,
            child: const _NodeIcon(icon: Icons.home_rounded, color: AppColors.home)),
          Positioned(left: homeX - 34, top: labelY,
            child: _PowerLabel(power: homeW, color: AppColors.home)),

          // Inverter hub label
          Positioned(
            left: 0, right: 0, bottom: h * 0.075,
            child: Center(
              child: Text('INVERTER', style: AppType.mono(8.5, color: AppColors.textMuted, letterSpacing: 1.6)),
            ),
          ),
        ],
      );
    });
  }
}

class _NodeIcon extends StatelessWidget {
  final IconData icon;
  final Color color;
  const _NodeIcon({required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38, height: 38,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        shape: BoxShape.circle,
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Icon(icon, size: 19, color: color),
    );
  }
}

class _PowerLabel extends StatelessWidget {
  final double power;
  final Color color;
  const _PowerLabel({required this.power, required this.color});

  @override
  Widget build(BuildContext context) {
    final abs = power.abs();
    final value = abs >= 1000 ? (abs / 1000).toStringAsFixed(2) : abs.round().toString();
    final unit = abs >= 1000 ? 'kW' : 'W';
    return SizedBox(
      width: 68,
      child: Column(
        children: [
          Text.rich(
            TextSpan(
              text: value,
              style: const TextStyle(fontFamily: 'Outfit', fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.4),
              children: [
                TextSpan(text: ' $unit', style: TextStyle(fontFamily: 'Outfit', fontSize: 9, fontWeight: FontWeight.w600, color: color)),
              ],
            ),
            textAlign: TextAlign.center,
          ),
          if (power.abs() < 1)
            Text('standby', style: AppType.mono(8, color: AppColors.textMuted, letterSpacing: 0.8)),
        ],
      ),
    );
  }
}

// ── Painter: wires + particles ────────────────────────────────────────
class _FlowPainter extends CustomPainter {
  final double progress;
  final double solarPower, homePower, gridPower;
  final bool gridReverse;
  final bool solarActive, homeActive, gridActive;

  _FlowPainter({
    required this.progress,
    required this.solarPower,
    required this.homePower,
    required this.gridPower,
    required this.gridReverse,
    required this.solarActive,
    required this.homeActive,
    required this.gridActive,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final hub = Offset(w * 0.5, h * 0.80);

    // Node anchor points (bottom of each icon circle).
    final solarStart = Offset(w * 0.17, h * 0.21 + 19);
    final gridStart = Offset(w * 0.83, h * 0.21 + 19);
    final homeEnd = Offset(w * 0.50, h * 0.21 - 19);

    final solar = _FlowPath(
      p0: solarStart,
      c1: Offset(solarStart.dx, h * 0.55),
      c2: Offset(w * 0.38, hub.dy),
      p3: hub,
      color: AppColors.solar,
    );
    final grid = _FlowPath(
      p0: gridStart,
      c1: Offset(gridStart.dx, h * 0.55),
      c2: Offset(w * 0.62, hub.dy),
      p3: hub,
      color: AppColors.grid,
    );
    final home = _FlowPath(
      p0: hub,
      c1: Offset(w * 0.50, h * 0.62),
      c2: Offset(w * 0.50, h * 0.40),
      p3: homeEnd,
      color: AppColors.home,
    );

    _drawFlow(canvas, solar, solarActive, solarPower, reverse: false);
    _drawFlow(canvas, grid, gridActive, gridPower, reverse: gridReverse);
    _drawFlow(canvas, home, homeActive, homePower, reverse: false);

    // Inverter hub glow
    final hubPaint = Paint()..color = AppColors.info.withValues(alpha: 0.22);
    canvas.drawCircle(hub, 13, hubPaint..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7));
    canvas.drawCircle(hub, 4.2, Paint()..color = const Color(0xFFE0F8FF));
    canvas.drawCircle(hub, 8, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..color = AppColors.info.withValues(alpha: 0.5));
  }

  void _drawFlow(Canvas canvas, _FlowPath path, bool active, double power, {required bool reverse}) {
    final pathObj = Path()
      ..moveTo(path.p0.dx, path.p0.dy)
      ..cubicTo(path.c1.dx, path.c1.dy, path.c2.dx, path.c2.dy, path.p3.dx, path.p3.dy);

    // Glow pass (blurred, wide)
    canvas.drawPath(pathObj, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round
      ..color = path.color.withValues(alpha: active ? 0.10 : 0.04)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));

    // Core line (gradient along the path)
    canvas.drawPath(pathObj, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round
      ..shader = ui.Gradient.linear(path.p0, path.p3, [
          path.color.withValues(alpha: active ? 0.80 : 0.10),
          path.color.withValues(alpha: active ? 1.0 : 0.12),
        ]));

    if (!active || power < 10) return;

    // Particle count + speed scale with power.
    final count = (1 + (power / 1200).floor()).clamp(1, 5);
    final duration = 4.5 - min(2.6, power / 5000 * 2.6); // seconds per lap
    final phaseStep = 1 / count;

    for (var k = 0; k < count; k++) {
      final t = (progress * duration / 4.0 + k * phaseStep) % 1.0;
      final p = path.pointAt(reverse ? 1 - t : t);
      final fade = _fade(t);
      if (fade <= 0) continue;
      final r = 1.4 + min(1.2, power / 4000);
      canvas.drawCircle(p, r * 3, Paint()
        ..color = path.color.withValues(alpha: 0.16 * fade)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
      canvas.drawCircle(p, r, Paint()..color = path.color.withValues(alpha: 0.95 * fade));
    }
  }

  double _fade(double t) {
    if (t < 0.08) return t / 0.08;
    if (t > 0.9) return (1 - t) / 0.1;
    return 1;
  }

  @override
  bool shouldRepaint(_FlowPainter old) =>
      old.progress != progress ||
      old.solarPower != solarPower || old.homePower != homePower || old.gridPower != gridPower ||
      old.gridReverse != gridReverse ||
      old.solarActive != solarActive || old.homeActive != homeActive || old.gridActive != gridActive;
}

class _FlowPath {
  final Offset p0, c1, c2, p3;
  final Color color;
  const _FlowPath({required this.p0, required this.c1, required this.c2, required this.p3, required this.color});

  Offset pointAt(double t) {
    final u = 1 - t;
    return Offset(
      u * u * u * p0.dx + 3 * u * u * t * c1.dx + 3 * u * t * t * c2.dx + t * t * t * p3.dx,
      u * u * u * p0.dy + 3 * u * u * t * c1.dy + 3 * u * t * t * c2.dy + t * t * t * p3.dy,
    );
  }
}
