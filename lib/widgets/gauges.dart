import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Circular remaining-units gauge — draws a partial arc (not a full circle)
/// matching the Solar native app's SVG rings.
///
/// Meter gauges: 240° arc, start at 240° (gap centered at bottom).
/// Middle total ring: 270° arc, start at 225° (gap centered at bottom).
///
/// Color stays at base above 20 units and interpolates yellow → red below 20.
class CircularGauge extends StatelessWidget {
  final double value; // 0..1 remaining fraction
  final Color color;
  final double size;
  final double strokeWidth;
  final Widget? center;
  final double remainingUnits;

  /// Arc sweep in degrees (240 for meter gauges, 270 for the middle ring).
  final double arcSweep;

  /// Start angle in degrees (240 for meter gauges, 225 for the middle ring).
  final double startAngle;

  const CircularGauge({
    super.key,
    required this.value,
    required this.color,
    this.size = 72,
    this.strokeWidth = 7,
    this.center,
    this.remainingUnits = 0,
    this.arcSweep = 240,
    this.startAngle = 240,
  });

  static Color gaugeColor(double remaining, Color base) {
    if (remaining >= 20) return base;
    final t = (max(0, remaining) / 20).clamp(0.0, 1.0);
    // #F8C653 (248,198,83) → #EF4C4C (239,76,76)
    return Color.fromARGB(
      255,
      (248 * t + 239 * (1 - t)).round(),
      (198 * t + 76 * (1 - t)).round(),
      (83 * t + 76 * (1 - t)).round(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = gaugeColor(remainingUnits, color);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: size,
            height: size,
            child: CustomPaint(
              painter: _ArcGaugePainter(
                value.clamp(0.0, 1.0),
                c,
                strokeWidth,
                arcSweep,
                startAngle,
              ),
            ),
          ),
          if (center != null) center!,
        ],
      ),
    );
  }
}

class _ArcGaugePainter extends CustomPainter {
  final double value;
  final Color color;
  final double strokeWidth;
  final double arcSweep; // degrees
  final double startAngle; // degrees

  _ArcGaugePainter(
    this.value,
    this.color,
    this.strokeWidth,
    this.arcSweep,
    this.startAngle,
  );

  @override
  void paint(Canvas canvas, Size size) {
    final radius = size.width / 2 - strokeWidth / 2;
    final rect = Rect.fromCircle(
      center: Offset(size.width / 2, size.height / 2),
      radius: radius,
    );
    // Convert degrees → radians. SVG rotate(150) means the arc starts at 150°
    // measured clockwise from 3 o'clock. In Canvas, 0° is at 3 o'clock and
    // angles increase clockwise. We offset by -90° so 0° is at 12 o'clock, then
    // add the SVG start angle.
    final start = (startAngle - 90) * pi / 180;
    final sweep = arcSweep * pi / 180;

    // Track (full arc background)
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = color.withValues(alpha: 0.15);
    canvas.drawArc(rect, start, sweep, false, track);

    // Fill (value fraction of the arc)
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = color;
    canvas.drawArc(rect, start, sweep * value, false, arc);
  }

  @override
  bool shouldRepaint(_ArcGaugePainter old) =>
      old.value != value ||
      old.color != color ||
      old.strokeWidth != strokeWidth ||
      old.arcSweep != arcSweep ||
      old.startAngle != startAngle;
}

/// Horizontal load gauge with idle / normal / high zones.
class LoadGauge extends StatelessWidget {
  final double loadW;
  final double maxW;
  final String status; // Low | Normal | High

  const LoadGauge(
      {super.key,
      required this.loadW,
      required this.maxW,
      required this.status});

  @override
  Widget build(BuildContext context) {
    final pct = (loadW / maxW).clamp(0.0, 1.0);
    final color = status == 'High'
        ? AppColors.danger
        : status == 'Low'
            ? AppColors.textMuted
            : AppColors.success;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(builder: (context, constraints) {
          final w = constraints.maxWidth;
          final idle = w * 0.30, normal = w * 0.36, high = w * 0.34;
          return SizedBox(
            height: 14,
            child: Stack(
              children: [
                Positioned(
                    left: 0,
                    width: idle,
                    height: 14,
                    child: _zone(AppColors.textMuted.withValues(alpha: 0.16),
                        BorderRadius.horizontal(left: Radius.circular(7)))),
                Positioned(
                    left: idle,
                    width: normal,
                    height: 14,
                    child: _zone(AppColors.home.withValues(alpha: 0.16),
                        BorderRadius.zero)),
                Positioned(
                    left: idle + normal,
                    width: high,
                    height: 14,
                    child: _zone(AppColors.danger.withValues(alpha: 0.16),
                        BorderRadius.horizontal(right: Radius.circular(7)))),
                Positioned(
                  left: 0,
                  width: max(8, w * pct),
                  height: 14,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [color.withValues(alpha: 0.55), color],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                      borderRadius: BorderRadius.circular(7),
                    ),
                  ),
                ),
                Positioned(
                  left: (w * pct - 4).clamp(0.0, w - 8),
                  top: 2,
                  width: 10,
                  height: 10,
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.textPrimary,
                      shape: BoxShape.circle,
                      border: Border.all(color: color, width: 2),
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 6),
        Row(
          children: [
            Text('0', style: AppType.mono(9)),
            const Spacer(),
            Text('1 kW', style: AppType.mono(9)),
            const Spacer(),
            Text('2.5 kW', style: AppType.mono(9)),
          ],
        ),
      ],
    );
  }

  Widget _zone(Color color, BorderRadius radius) => DecoratedBox(
      decoration: BoxDecoration(color: color, borderRadius: radius));
}

/// Small segmented progress bar (solar/grid shares, day windows).
class SegmentBar extends StatelessWidget {
  final List<(double, Color)> segments; // fraction + color
  final double height;

  const SegmentBar({super.key, required this.segments, this.height = 6});

  @override
  Widget build(BuildContext context) {
    final total = segments.fold<double>(0, (s, e) => s + e.$1);
    return ClipRRect(
      borderRadius: BorderRadius.circular(height / 2),
      child: Row(
        children: [
          for (final (f, c) in segments)
            Expanded(
              flex: max(1, (f / total * 1000).round()),
              child: Container(height: height, color: c),
            ),
        ],
      ),
    );
  }
}

/// Donut chart (custom painter) for time-of-day breakdown.
class DonutChart extends StatelessWidget {
  final List<(double, Color)> segments; // value + color
  final double size;
  final double strokeWidth;

  const DonutChart(
      {super.key,
      required this.segments,
      this.size = 84,
      this.strokeWidth = 13});

  @override
  Widget build(BuildContext context) {
    final total = segments.fold<double>(0, (s, e) => s + e.$1);
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _DonutPainter(segments, total, strokeWidth),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  final List<(double, Color)> segments;
  final double total;
  final double strokeWidth;
  _DonutPainter(this.segments, this.total, this.strokeWidth);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCircle(
      center: Offset(size.width / 2, size.height / 2),
      radius: size.width / 2 - strokeWidth / 2,
    );
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = AppColors.border;
    canvas.drawArc(rect, -pi / 2, 2 * pi, false, track);

    var start = -pi / 2;
    for (final (v, c) in segments) {
      if (v <= 0) continue;
      final sweep = 2 * pi * (v / total);
      final p = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt
        ..color = c;
      canvas.drawArc(rect, start, sweep - 0.03, false, p);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      !listEquals(segments, old.segments) || total != old.total;
}
