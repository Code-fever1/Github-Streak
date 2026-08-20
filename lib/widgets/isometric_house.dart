import 'dart:math';

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Animated isometric home illustration with solar panels, car, and
/// flowing energy dots (solar → house / grid).
class IsometricHouse extends StatefulWidget {
  final double solarW;
  final double gridW;
  final double homeW;

  const IsometricHouse({
    super.key,
    required this.solarW,
    required this.gridW,
    required this.homeW,
  });

  @override
  State<IsometricHouse> createState() => _IsometricHouseState();
}

class _IsometricHouseState extends State<IsometricHouse>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 3),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => CustomPaint(
        painter: _HousePainter(
          progress: _controller.value,
          solarW: widget.solarW,
          gridW: widget.gridW,
          homeW: widget.homeW,
        ),
        size: Size.infinite,
      ),
    );
  }
}

class _HousePainter extends CustomPainter {
  final double progress;
  final double solarW, gridW, homeW;

  _HousePainter({
    required this.progress,
    required this.solarW,
    required this.gridW,
    required this.homeW,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final groundY = h * 0.82;
    final center = w * 0.5;

    // Ground platform
    _drawGround(canvas, center, groundY, w, h);

    // House
    final houseBase = Offset(center - 6, groundY - 8);
    _drawHouse(canvas, houseBase);

    // Car
    _drawCar(canvas, Offset(center + w * 0.22, groundY + 5));

    // Tree
    _drawTree(canvas, Offset(center - w * 0.30, groundY - 8));

    // Energy flows
    if (solarW > 10) _drawFlow(canvas, _lineSolarToRoof(center, groundY), AppColors.success, solarW, true);
    if (gridW.abs() > 10) _drawFlow(canvas, _lineToGrid(center, groundY), AppColors.grid, gridW.abs(), gridW < 0);
    if (homeW > 10) _drawFlow(canvas, _lineToHome(center, groundY), AppColors.success, homeW, true);

    // Glowing accents on house windows and car
    _drawGlimmers(canvas, center, groundY);
  }

  void _drawGround(Canvas canvas, double cx, double groundY, double w, double h) {
    final ground = Path()
      ..moveTo(cx - w * 0.42, groundY)
      ..lineTo(cx + w * 0.45, groundY)
      ..lineTo(cx + w * 0.38, groundY + h * 0.10)
      ..lineTo(cx - w * 0.35, groundY + h * 0.10)
      ..close();
    canvas.drawPath(ground, Paint()
      ..color = const Color(0xFF1A1D26)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6));
    canvas.drawPath(ground, Paint()..color = const Color(0xFF181A21));
  }

  void _drawHouse(Canvas canvas, Offset base) {
    const wall = Color(0xFF232631);
    const roof = Color(0xFF2A2D3A);
    const roofPanel = Color(0xFF1E3A8A);

    // First floor
    final f1 = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(base.dx, base.dy - 48), width: 112, height: 62),
      const Radius.circular(6),
    );
    canvas.drawRRect(f1, Paint()..color = wall);

    // Second floor
    final f2 = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(base.dx, base.dy - 98), width: 96, height: 52),
      const Radius.circular(6),
    );
    canvas.drawRRect(f2, Paint()..color = wall);

    // Roof
    final roofPath = Path()
      ..moveTo(base.dx - 60, base.dy - 120)
      ..lineTo(base.dx + 60, base.dy - 120)
      ..lineTo(base.dx + 50, base.dy - 100)
      ..lineTo(base.dx - 50, base.dy - 100)
      ..close();
    canvas.drawPath(roofPath, Paint()..color = roof);

    // Solar panels on roof
    final panel = Path()
      ..moveTo(base.dx - 46, base.dy - 118)
      ..lineTo(base.dx + 46, base.dy - 118)
      ..lineTo(base.dx + 40, base.dy - 104)
      ..lineTo(base.dx - 40, base.dy - 104)
      ..close();
    canvas.drawPath(panel, Paint()..color = roofPanel);

    // Windows (first floor)
    for (var i = -1; i <= 1; i++) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset(base.dx + i * 34, base.dy - 52), width: 20, height: 22),
          const Radius.circular(3),
        ),
        Paint()..color = const Color(0xFFFEF3C7).withValues(alpha: 0.14),
      );
    }

    // Door
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(base.dx, base.dy - 22), width: 20, height: 28),
        const Radius.circular(3),
      ),
      Paint()..color = const Color(0xFF3B3F4D),
    );
  }

  void _drawCar(Canvas canvas, Offset pos) {
    final body = Path()
      ..moveTo(pos.dx - 26, pos.dy - 8)
      ..lineTo(pos.dx + 22, pos.dy - 8)
      ..lineTo(pos.dx + 26, pos.dy - 4)
      ..lineTo(pos.dx + 26, pos.dy + 3)
      ..lineTo(pos.dx - 26, pos.dy + 3)
      ..close();
    canvas.drawPath(body, Paint()..color = const Color(0xFFD1D5DB));

    final cabin = Path()
      ..moveTo(pos.dx - 12, pos.dy - 8)
      ..lineTo(pos.dx + 8, pos.dy - 8)
      ..lineTo(pos.dx + 10, pos.dy - 16)
      ..lineTo(pos.dx - 10, pos.dy - 16)
      ..close();
    canvas.drawPath(cabin, Paint()..color = const Color(0xFFE5E7EB));

    // Wheels
    canvas.drawCircle(Offset(pos.dx - 14, pos.dy + 3), 5, Paint()..color = const Color(0xFF111827));
    canvas.drawCircle(Offset(pos.dx + 14, pos.dy + 3), 5, Paint()..color = const Color(0xFF111827));
  }

  void _drawTree(Canvas canvas, Offset pos) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(pos.dx, pos.dy - 4), width: 6, height: 18),
        const Radius.circular(2),
      ),
      Paint()..color = const Color(0xFF4B5563),
    );
    canvas.drawCircle(Offset(pos.dx, pos.dy - 18), 12, Paint()..color = const Color(0xFF15803D));
  }

  List<Offset> _lineSolarToRoof(double cx, double groundY) {
    return [Offset(cx, groundY - 184), Offset(cx - 10, groundY - 128)];
  }

  List<Offset> _lineToGrid(double cx, double groundY) {
    return [Offset(cx - 40, groundY - 100), Offset(cx - 110, groundY - 110)];
  }

  List<Offset> _lineToHome(double cx, double groundY) {
    return [Offset(cx, groundY - 100), Offset(cx + 70, groundY - 60)];
  }

  void _drawFlow(Canvas canvas, List<Offset> pts, Color color, double power, bool forward) {
    final p = Path()
      ..moveTo(pts[0].dx, pts[0].dy)
      ..lineTo(pts[1].dx, pts[1].dy);
    canvas.drawPath(p, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = color.withValues(alpha: 0.22));

    final count = (1 + (power / 1200).floor()).clamp(1, 5);
    final duration = 2.5 - min(1.8, power / 5000 * 1.8);
    for (var i = 0; i < count; i++) {
      final t = (progress * duration + i / count) % 1.0;
      final pos = Offset.lerp(pts[0], pts[1], forward ? t : 1 - t)!;
      final alpha = t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1.0;
      canvas.drawCircle(pos, 3, Paint()..color = color.withValues(alpha: 0.55 * alpha));
      canvas.drawCircle(pos, 7, Paint()..color = color.withValues(alpha: 0.12 * alpha)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2));
    }
  }

  void _drawGlimmers(Canvas canvas, double cx, double groundY) {
    final glimmer = Paint()..color = const Color(0xFFFEF3C7).withValues(alpha: 0.18);
    for (final o in [Offset(cx - 34, groundY - 52), Offset(cx, groundY - 52), Offset(cx + 34, groundY - 52)]) {
      canvas.drawCircle(o, 10, glimmer..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));
    }
  }

  @override
  bool shouldRepaint(covariant _HousePainter old) =>
      old.progress != progress || old.solarW != solarW || old.gridW != gridW || old.homeW != homeW;
}
