import 'dart:math';

import 'package:flutter/material.dart';

import '../models/energy.dart';
import '../theme/app_colors.dart';

/// 24h energy flow chart — solar / home / grid lines with a touch
/// inspector panel (mirrors the native app's FlowChart).
class FlowChart extends StatefulWidget {
  final List<FlowPoint> points;
  final int windowStart; // epoch seconds

  const FlowChart({super.key, required this.points, required this.windowStart});

  @override
  State<FlowChart> createState() => _FlowChartState();
}

class _FlowChartState extends State<FlowChart> {
  int? _selectedTs;
  static const _inspectorW = 92.0;
  static const _chartLeft = 30.0;
  static const _plotTop = 16.0;
  static const _plotBottom = 104.0;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final windowEnd = widget.windowStart + 24 * 3600;
    final end = min(now, windowEnd);

    return LayoutBuilder(builder: (context, constraints) {
      final plotW = constraints.maxWidth - _inspectorW - 12;
      final graphW = max(1.0, plotW - _chartLeft - 8);

      // Bucketize: last value per 5-min bucket (with null for gaps).
      final buckets = <int, FlowPoint>{};
      for (final p in widget.points) {
        if (p.timestamp < widget.windowStart || p.timestamp > end) continue;
        final b = p.timestamp - (p.timestamp % (5 * 60));
        buckets[b] = p;
      }
      final values = <FlowPoint>[];
      for (var ts = widget.windowStart; ts <= end; ts += 5 * 60) {
        values.add(buckets[ts] ??
            FlowPoint(timestamp: ts));
      }

      final maxKw = values.fold<double>(0.4, (m, p) =>
          max(m, max(p.solarKw ?? 0, max(p.gridKw ?? 0, p.loadKw ?? 0))));
      final niceMax = (maxKw * 10).ceil() / 10;

      double xOf(int ts) => _chartLeft + ((ts - widget.windowStart) / (24 * 3600)) * graphW;
      double yOf(double v) => _plotBottom - (v / niceMax) * (_plotBottom - _plotTop);

      // Selected point: default to the latest non-empty bucket.
      final selected = _selectedTs == null
          ? values.reversed.firstWhere(
              (p) => p.solarKw != null || p.gridKw != null || p.loadKw != null,
              orElse: () => values.last)
          : values.firstWhere((p) => p.timestamp == _selectedTs, orElse: () => values.last);

      void selectAt(double dx) {
        final hour = ((dx - _chartLeft) / graphW) * 24;
        if (hour < -0.2 || hour > 24.2) return;
        final target = widget.windowStart + (hour * 3600).round();
        FlowPoint nearest = values.first;
        var minDist = double.infinity;
        for (final p in values) {
          final d = (p.timestamp - target).abs().toDouble();
          if (d < minDist) { minDist = d; nearest = p; }
        }
        setState(() => _selectedTs = nearest.timestamp);
      }

      final rows = [
        ('Solar', AppColors.solar, selected.solarKw),
        ('Home', AppColors.home, selected.loadKw),
        ('Grid', AppColors.grid, selected.gridKw),
      ];

      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (e) => selectAt(e.localPosition.dx),
              onHorizontalDragUpdate: (e) => selectAt(e.localPosition.dx),
              child: SizedBox(
                height: 122,
                child: CustomPaint(
                  painter: _ChartPainter(
                    values: values,
                    niceMax: niceMax,
                    xOf: xOf, yOf: yOf,
                    selected: selected,
                    windowStart: widget.windowStart,
                    chartLeft: _chartLeft,
                    plotTop: _plotTop,
                    plotBottom: _plotBottom,
                    graphW: graphW,
                    plotW: plotW,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: _inspectorW,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _timeLabel(selected.timestamp),
                  style: AppType.inter(11, color: AppColors.textPrimary, weight: FontWeight.w700, letterSpacing: -0.2),
                ),
                const SizedBox(height: 1),
                Text('5 MIN', style: AppType.mono(7.5, color: AppColors.textMuted, letterSpacing: 0.8)),
                const SizedBox(height: 7),
                for (final (label, color, value) in rows) ...[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Container(width: 5, height: 5,
                          decoration: BoxDecoration(color: value == null ? AppColors.textMuted : color, shape: BoxShape.circle)),
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(label.toUpperCase(), style: AppType.mono(7.5, color: AppColors.textMuted, letterSpacing: 0.6)),
                            Text(
                              value == null ? 'Off' : _fmtKw(value),
                              style: AppType.inter(10.5, color: value == null ? AppColors.textMuted : AppColors.textPrimary, weight: FontWeight.w700, letterSpacing: -0.2),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                ],
              ],
            ),
          ),
        ],
      );
    });
  }

  String _timeLabel(int ts) {
    final d = DateTime.fromMillisecondsSinceEpoch(ts * 1000);
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final ampm = d.hour >= 12 ? 'PM' : 'AM';
    return '$h:${d.minute.toString().padLeft(2, '0')} $ampm';
  }

  String _fmtKw(double v) => v >= 1 ? '${v.toStringAsFixed(2)} kW' : '${(v * 1000).round()} W';
}

class _ChartPainter extends CustomPainter {
  final List<FlowPoint> values;
  final double niceMax;
  final double Function(int) xOf;
  final double Function(double) yOf;
  final FlowPoint selected;
  final int windowStart;
  final double chartLeft, plotTop, plotBottom, graphW, plotW;

  _ChartPainter({
    required this.values, required this.niceMax, required this.xOf, required this.yOf,
    required this.selected, required this.windowStart,
    required this.chartLeft, required this.plotTop, required this.plotBottom,
    required this.graphW, required this.plotW,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()
      ..strokeWidth = 1
      ..color = AppColors.border.withValues(alpha: 0.5);
    final axisText = AppType.mono(8, color: AppColors.textMuted);

    // Grid lines + y labels (max / half / 0)
    for (var i = 0; i <= 2; i++) {
      final y = plotTop + (plotBottom - plotTop) * i / 2;
      canvas.drawLine(Offset(chartLeft, y), Offset(plotW - 8, y), grid);
      final label = (niceMax - niceMax * i / 2).toStringAsFixed(1);
      final tp = TextPainter(
        text: TextSpan(text: label, style: axisText),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(1, y - 3.5));
    }

    // Peak home marker
    FlowPoint? peak;
    var peakV = -1.0;
    for (final p in values) {
      final l = p.loadKw ?? 0;
      if (l > peakV) { peakV = l; peak = p; }
    }
    if (peak != null && peak.loadKw != null) {
      final px = xOf(peak.timestamp), py = yOf(peak.loadKw!);
      canvas.drawCircle(Offset(px, py), 5, Paint()..color = AppColors.home.withValues(alpha: 0.16));
      canvas.drawCircle(Offset(px, py), 2.4, Paint()..color = AppColors.home);
    }

    // Series lines
    _drawSeries(canvas, (p) => p.solarKw, AppColors.solar);
    _drawSeries(canvas, (p) => p.loadKw, AppColors.home);
    _drawSeries(canvas, (p) => p.gridKw, AppColors.grid);

    // Now marker
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    if (now >= windowStart) {
      final nx = xOf(min(now, windowStart + 24 * 3600));
      final dashed = Paint()
        ..strokeWidth = 1
        ..color = AppColors.textMuted.withValues(alpha: 0.5);
      for (var y = plotTop; y <= plotBottom; y += 5) {
        canvas.drawLine(Offset(nx, y), Offset(nx, min(y + 2.5, plotBottom)), dashed);
      }
      canvas.drawCircle(Offset(nx, plotTop - 4), 2.2, Paint()..color = AppColors.textSecondary);
    }

    // Selection line + dots
    final sx = xOf(selected.timestamp);
    canvas.drawLine(Offset(sx, plotTop), Offset(sx, plotBottom),
        Paint()..strokeWidth = 1 ..color = AppColors.textSecondary.withValues(alpha: 0.45));
    for (final (key, color) in [('solarKw', AppColors.solar), ('loadKw', AppColors.home), ('gridKw', AppColors.grid)]) {
      final v = switch (key) {
        'solarKw' => selected.solarKw,
        'loadKw' => selected.loadKw,
        _ => selected.gridKw,
      };
      if (v != null) {
        canvas.drawCircle(Offset(sx, yOf(v)), 2.6, Paint()..color = color);
      }
    }
  }

  void _drawSeries(Canvas canvas, double? Function(FlowPoint) get, Color color) {
    final path = Path();
    var drawing = false;
    for (final p in values) {
      final v = get(p);
      if (v == null || v <= 0) { drawing = false; continue; }
      final x = xOf(p.timestamp), y = yOf(v);
      if (!drawing) { path.moveTo(x, y); drawing = true; }
      else { path.lineTo(x, y); }
    }
    canvas.drawPath(path, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color);
  }

  @override
  bool shouldRepaint(_ChartPainter old) =>
      old.niceMax != niceMax ||
      old.windowStart != windowStart ||
      old.selected.timestamp != selected.timestamp ||
      old.values.last.timestamp != values.last.timestamp ||
      old.values.last.loadKw != values.last.loadKw;
}
