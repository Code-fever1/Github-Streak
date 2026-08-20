import 'package:flutter/material.dart';

/// Illustration of a tilted solar panel, used on the home dashboard.
class SolarPanelIllustration extends StatelessWidget {
  final double size;

  const SolarPanelIllustration({super.key, this.size = 90});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        size: Size(size, size),
        painter: _SolarPanelPainter(),
      ),
    );
  }
}

class _SolarPanelPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final top = Offset(w * 0.15, h * 0.18);
    final right = Offset(w * 0.95, h * 0.32);
    final bottom = Offset(w * 0.82, h * 0.92);
    final left = Offset(w * 0.02, h * 0.78);

    // Panel frame
    final frame = Path()
      ..moveTo(top.dx, top.dy)
      ..lineTo(right.dx, right.dy)
      ..lineTo(bottom.dx, bottom.dy)
      ..lineTo(left.dx, left.dy)
      ..close();
    canvas.drawPath(frame, Paint()..color = const Color(0xFF1E293B));

    // Panel surface gradient
    final surface = Path()
      ..moveTo(top.dx + 2, top.dy + 2)
      ..lineTo(right.dx - 2, right.dy + 2)
      ..lineTo(bottom.dx - 2, bottom.dy - 2)
      ..lineTo(left.dx + 2, left.dy - 2)
      ..close();
    canvas.drawPath(surface, Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft, end: Alignment.bottomRight,
        colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
      ).createShader(Rect.fromLTWH(0, 0, w, h)));

    // Solar cells grid
    const rows = 4, cols = 3;
    final cellPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8
      ..color = const Color(0xFF3B82F6).withValues(alpha: 0.55);
    final fill = Paint()..color = const Color(0xFF1E40AF).withValues(alpha: 0.25);

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        final t0 = _lerp4(top, right, bottom, left, (c) / cols, (r) / rows);
        final t1 = _lerp4(top, right, bottom, left, (c + 1) / cols, (r) / rows);
        final b1 = _lerp4(top, right, bottom, left, (c + 1) / cols, (r + 1) / rows);
        final b0 = _lerp4(top, right, bottom, left, (c) / cols, (r + 1) / rows);
        final cell = Path()
          ..moveTo(t0.dx, t0.dy)
          ..lineTo(t1.dx, t1.dy)
          ..lineTo(b1.dx, b1.dy)
          ..lineTo(b0.dx, b0.dy)
          ..close();
        canvas.drawPath(cell, fill);
        canvas.drawPath(cell, cellPaint);
      }
    }

    // Specular highlight
    final specular = Path()
      ..moveTo(top.dx, top.dy)
      ..lineTo(right.dx * 0.6, right.dy * 0.6)
      ..lineTo(left.dx * 0.6, left.dy * 0.6)
      ..close();
    canvas.drawPath(specular, Paint()
      ..color = Colors.white.withValues(alpha: 0.08)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2));
  }

  Offset _lerp4(Offset a, Offset b, Offset c, Offset d, double u, double v) {
    final top = Offset.lerp(a, b, u)!;
    final bottom = Offset.lerp(d, c, u)!;
    return Offset.lerp(top, bottom, v)!;
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
