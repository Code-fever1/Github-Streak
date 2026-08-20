import 'dart:math';

import 'package:flutter/material.dart';

import '../data/energy_scope.dart';
import '../models/energy.dart';
import '../theme/app_colors.dart';
import '../widgets/gauges.dart';
import '../widgets/glass_card.dart';

class MetersPage extends StatelessWidget {
  const MetersPage({super.key});

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    final m1 = p.meter('meter1');
    final m2 = p.meter('meter2');
    final home = p.home;
    final active = p.activeMeter == 'meter1' ? m1 : m2;
    final totalTarget = 400.0;
    final totalRemaining = m1.remainingUnits + m2.remainingUnits;
    final totalUsed = (m1.targetUnits - m1.remainingUnits) + (m2.targetUnits - m2.remainingUnits);
    final overBudget = (home.projectedMonthly - totalTarget).round();
    final isOver = overBudget > 0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
      children: [
        _PageHeader(title: 'Energy', subtitle: 'Meter tracking, usage comparison & changeover control'),
        const SizedBox(height: 16),

        // ── Active meter selector ───────────────────────────────
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Container(width: 6, height: 6,
                      decoration: BoxDecoration(color: active.isDigital ? AppColors.grid : AppColors.home, shape: BoxShape.circle)),
                    const SizedBox(width: 8),
                    Text('Active Meter', style: AppType.inter(10, color: AppColors.textSecondary)),
                    const SizedBox(width: 8),
                    Text(active.label, style: AppType.inter(10.5, color: AppColors.textPrimary, weight: FontWeight.w700)),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            OutlinedButton.icon(
              onPressed: p.changeover,
              icon: const Icon(Icons.swap_horiz_rounded, size: 15),
              label: const Text('Changeover'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.info,
                side: const BorderSide(color: AppColors.info, width: 1.2),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                textStyle: AppType.inter(10.5, weight: FontWeight.w700),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // ── Meter cards ─────────────────────────────────────────
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _MeterCard(meter: m1, isActive: p.activeMeter == 'meter1')),
            const SizedBox(width: 12),
            Expanded(child: _MeterCard(meter: m2, isActive: p.activeMeter == 'meter2')),
          ],
        ),
        const SizedBox(height: 12),

        // ── Forecast & budget ───────────────────────────────────
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.auto_awesome_rounded, size: 13, color: AppColors.purple),
                  const SizedBox(width: 6),
                  Text('AI Forecast & Budget', style: AppType.inter(12.5, color: AppColors.textPrimary, weight: FontWeight.w700, letterSpacing: -0.3)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.purpleSoft,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('${home.confidencePercent.round()}% Confidence',
                        style: AppType.inter(8.5, color: AppColors.purple, weight: FontWeight.w700)),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Left column
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text.rich(
                          TextSpan(
                            text: home.projectedMonthly.round().toString(),
                            style: const TextStyle(fontFamily: 'Outfit', fontSize: 34, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -1),
                            children: [
                              TextSpan(text: '  units', style: AppType.inter(10.5, color: AppColors.textSecondary, weight: FontWeight.w600)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text('predicted by the 28th', style: AppType.inter(9, color: AppColors.textMuted)),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Icon(isOver ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                                size: 13, color: isOver ? AppColors.danger : AppColors.success),
                            const SizedBox(width: 4),
                            Text(
                              isOver ? '+${overBudget} units over budget' : '${overBudget.abs()} units under budget',
                              style: AppType.inter(9.5, color: isOver ? AppColors.danger : AppColors.success, weight: FontWeight.w700),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _MiniStat(label: 'THIS MONTH', value: '${home.projectedMonthly.round()} u'),
                        const SizedBox(height: 7),
                        _MiniStat(
                          label: 'LAST MONTH',
                          value: home.lastMonthTotal == null
                              ? 'Set in settings'
                              : '${home.lastMonthTotal!.round()} u',
                          accent: home.vsLastMonthPercent != null && home.vsLastMonthPercent! < 0
                              ? AppColors.success
                              : home.vsLastMonthPercent != null && home.vsLastMonthPercent! > 0
                                  ? AppColors.danger
                                  : null,
                          delta: home.vsLastMonthPercent == null
                              ? null
                              : '${home.vsLastMonthPercent! >= 0 ? '+' : ''}${home.vsLastMonthPercent!.round()}%',
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            _BudgetChip(color: AppColors.success, label: '${home.combinedDaysLeft.round()} days buffer'),
                            const SizedBox(width: 8),
                            const _BudgetChip(color: AppColors.purple, label: 'On pace'),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  // Right column — cumulative chart
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('CUMULATIVE USAGE', style: AppType.mono(7.5, color: AppColors.textMuted, letterSpacing: 0.9)),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            _LegendDot(color: AppColors.home, label: 'Actual'),
                            const SizedBox(width: 10),
                            _LegendDot(color: AppColors.solar, label: 'Forecast'),
                          ],
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 110,
                          child: _CumulativeChart(
                            used: totalUsed,
                            projected: home.projectedMonthly,
                            target: totalTarget,
                            daysLeft: 8,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('28th', style: TextStyle(fontFamily: 'JetBrainsMono', fontSize: 8, color: AppColors.textMuted)),
                            Text('4th', style: TextStyle(fontFamily: 'JetBrainsMono', fontSize: 8, color: AppColors.textMuted)),
                            Text('12th', style: TextStyle(fontFamily: 'JetBrainsMono', fontSize: 8, color: AppColors.textMuted)),
                            Text('20th', style: TextStyle(fontFamily: 'JetBrainsMono', fontSize: 8, color: AppColors.textMuted)),
                            Text('28th', style: TextStyle(fontFamily: 'JetBrainsMono', fontSize: 8, color: AppColors.textMuted)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 16),

              // ── Meter gauges row ──────────────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: _GaugeColumn(meter: m1, color: AppColors.home)),
                  Expanded(
                    child: Column(
                      children: [
                        CircularGauge(
                          value: totalRemaining / totalTarget,
                          color: AppColors.purple,
                          size: 84,
                          strokeWidth: 8,
                          remainingUnits: totalRemaining,
                          center: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(totalRemaining.round().toString(),
                                  style: const TextStyle(fontFamily: 'Outfit', fontSize: 19, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.5)),
                              Text('units', style: AppType.mono(7.5, color: AppColors.textMuted)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text('≈ ${home.combinedDaysLeft.round()} days remaining',
                            style: AppType.inter(9, color: AppColors.textSecondary)),
                        const SizedBox(height: 2),
                        Text('${totalUsed.round()} units used', style: AppType.mono(8, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                  Expanded(child: _GaugeColumn(meter: m2, color: AppColors.grid)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // ── Smart tips ──────────────────────────────────────────
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.show_chart_rounded, size: 13, color: AppColors.purple),
                  const SizedBox(width: 6),
                  Text('Smart Tips', style: AppType.inter(12.5, color: AppColors.textPrimary, weight: FontWeight.w700, letterSpacing: -0.3)),
                ],
              ),
              const SizedBox(height: 12),
              _Tip(
                icon: Icons.wb_sunny_rounded,
                color: AppColors.solar,
                title: 'Meter 1 (Analog) is more efficient.',
                body: 'Saving ~15% units (4.5 units/month) vs Meter 2.',
              ),
              const Divider(color: AppColors.border, height: 20),
              _Tip(
                icon: Icons.speed_rounded,
                color: AppColors.info,
                title: 'Usage pace is on target.',
                body: 'You are on track to stay within this cycle\u2019s 400-unit budget.',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PageHeader extends StatelessWidget {
  final String title, subtitle;
  const _PageHeader({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('VOLTIX', style: AppType.mono(9.5, color: AppColors.textSecondary, letterSpacing: 1.6)),
        const SizedBox(height: 5),
        Text(title, style: const TextStyle(fontFamily: 'Outfit', fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.6)),
        const SizedBox(height: 3),
        Text(subtitle, style: AppType.inter(10.5, color: AppColors.textSecondary)),
      ],
    );
  }
}

class _MeterCard extends StatelessWidget {
  final MeterState meter;
  final bool isActive;

  const _MeterCard({required this.meter, required this.isActive});

  @override
  Widget build(BuildContext context) {
    final color = meter.isDigital ? AppColors.grid : AppColors.home;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: isActive ? color.withValues(alpha: 0.5) : AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusPill(color: isActive ? AppColors.success : AppColors.textMuted,
                  label: isActive ? 'Active' : 'Inactive', filled: isActive),
              const Spacer(),
              Text(meter.isDigital ? 'DIGITAL' : 'ANALOG', style: AppType.mono(7.5, color: color, letterSpacing: 0.9)),
            ],
          ),
          const SizedBox(height: 10),
          Text(meter.label, style: AppType.inter(12, color: AppColors.textPrimary, weight: FontWeight.w700, letterSpacing: -0.2)),
          const SizedBox(height: 10),
          Text('CURRENT READING', style: AppType.mono(7.5, color: AppColors.textMuted, letterSpacing: 0.9)),
          const SizedBox(height: 2),
          Text.rich(
            TextSpan(
              text: _fmt(meter.reading),
              style: const TextStyle(fontFamily: 'Outfit', fontSize: 21, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.5),
              children: [TextSpan(text: '  kWh', style: AppType.inter(9, color: AppColors.textSecondary, weight: FontWeight.w600))],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('TODAY', style: AppType.mono(7.5, color: AppColors.textMuted, letterSpacing: 0.9)),
              Text('${meter.todayUsage.toStringAsFixed(2)} u', style: AppType.inter(9.5, color: AppColors.textPrimary, weight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Text('Remaining', style: AppType.inter(8.5, color: AppColors.textSecondary)),
              const Spacer(),
              Text('${meter.remainingUnits.round()}%', style: AppType.mono(8.5, color: AppColors.textSecondary)),
            ],
          ),
          const SizedBox(height: 5),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: Stack(
              children: [
                Container(height: 6, color: AppColors.border),
                FractionallySizedBox(
                  widthFactor: (meter.remainingUnits / meter.targetUnits).clamp(0.0, 1.0),
                  child: Container(height: 6, color: CircularGauge.gaugeColor(meter.remainingUnits, color)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text('${meter.remainingUnits.toStringAsFixed(1)} units left · ${meter.projectedDaysLeft.round()} days',
              style: AppType.mono(8, color: AppColors.textMuted)),
          const SizedBox(height: 10),
          Row(
            children: [
              Text('Projected', style: AppType.inter(8.5, color: AppColors.textSecondary)),
              const Spacer(),
              Text('${meter.projectedMonthly.round()} units', style: AppType.inter(9.5, color: AppColors.textPrimary, weight: FontWeight.w700)),
              const SizedBox(width: 8),
              Text('${meter.healthScore.round()}/100', style: AppType.mono(8.5, color: meter.healthScore >= 80 ? AppColors.success : meter.healthScore >= 60 ? AppColors.warning : AppColors.danger)),
            ],
          ),
        ],
      ),
    );
  }

  String _fmt(double v) {
    final s = v.toStringAsFixed(1);
    final parts = s.split('.');
    final buf = StringBuffer();
    for (var i = 0; i < parts[0].length; i++) {
      if (i > 0 && (parts[0].length - i) % 3 == 0) buf.write(',');
      buf.write(parts[0][i]);
    }
    return '$buf.${parts[1]}';
  }
}

class _MiniStat extends StatelessWidget {
  final String label, value;
  final String? delta;
  final Color? accent;
  const _MiniStat({required this.label, required this.value, this.delta, this.accent});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(label, style: AppType.mono(7.5, color: AppColors.textMuted, letterSpacing: 0.9)),
        const Spacer(),
        Text(value, style: AppType.inter(10, color: AppColors.textPrimary, weight: FontWeight.w700)),
        if (delta != null) ...[
          const SizedBox(width: 6),
          Text(delta!, style: AppType.mono(9, color: accent ?? AppColors.textSecondary)),
        ],
      ],
    );
  }
}

class _BudgetChip extends StatelessWidget {
  final Color color;
  final String label;
  const _BudgetChip({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 5, height: 5, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(label, style: AppType.inter(8.5, color: color, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: AppType.inter(8.5, color: AppColors.textSecondary)),
      ],
    );
  }
}

/// Cumulative actual (green) vs forecast (amber dashed) line chart.
class _CumulativeChart extends StatelessWidget {
  final double used, projected, target;
  final int daysLeft;

  const _CumulativeChart({required this.used, required this.projected, required this.target, required this.daysLeft});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _CumulativePainter(used: used, projected: projected, target: target, daysLeft: daysLeft),
      size: Size.infinite,
    );
  }
}

class _CumulativePainter extends CustomPainter {
  final double used, projected, target;
  final int daysLeft;

  _CumulativePainter({required this.used, required this.projected, required this.target, required this.daysLeft});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final top = 6.0, bottom = h - 4;
    final yMax = target * 1.05;
    double yOf(double v) => bottom - (v / yMax) * (bottom - top);

    // Grid lines: 0, half, target
    final grid = Paint()..strokeWidth = 1 ..color = AppColors.border.withValues(alpha: 0.5);
    for (final v in [0.0, target / 2, target]) {
      canvas.drawLine(Offset(0, yOf(v)), Offset(w, yOf(v)), grid);
    }

    // Actual: linear from 0 → used at (elapsed = 22/30)
    final elapsedFrac = 22 / 30;
    final actual = Path()
      ..moveTo(0, yOf(0))
      ..lineTo(w * elapsedFrac, yOf(used));
    canvas.drawPath(actual, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..color = AppColors.home);
    canvas.drawCircle(Offset(w * elapsedFrac, yOf(used)), 3, Paint()..color = AppColors.home);

    // Forecast: dashed from current → projected
    final dash = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..color = AppColors.solar;
    for (var x = w * elapsedFrac; x < w; x += 6) {
      final f0 = (x - w * elapsedFrac) / (w - w * elapsedFrac);
      final f1 = min(1.0, f0 + 3 / max(1, w - w * elapsedFrac));
      canvas.drawLine(
        Offset(x, yOf(used + (projected - used) * f0)),
        Offset(x + (w - w * elapsedFrac) * (f1 - f0), yOf(used + (projected - used) * f1)),
        dash,
      );
    }

    // Today marker
    final marker = Paint()..strokeWidth = 1 ..color = AppColors.textMuted.withValues(alpha: 0.6);
    canvas.drawLine(Offset(w * elapsedFrac, top), Offset(w * elapsedFrac, bottom), marker);

    // Target line label
    final tp = TextPainter(
      text: TextSpan(text: '${target.round()} target', style: AppType.mono(7, color: AppColors.textMuted)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(0, yOf(target) - tp.height - 2));
  }

  @override
  bool shouldRepaint(_CumulativePainter old) =>
      old.used != used || old.projected != projected || old.target != target;
}

class _GaugeColumn extends StatelessWidget {
  final MeterState meter;
  final Color color;
  const _GaugeColumn({required this.meter, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        CircularGauge(
          value: meter.remainingUnits / meter.targetUnits,
          color: color,
          size: 84,
          strokeWidth: 8,
          remainingUnits: meter.remainingUnits,
          center: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(meter.remainingUnits.round().toString(),
                  style: const TextStyle(fontFamily: 'Outfit', fontSize: 19, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.5)),
              Text('units', style: AppType.mono(7.5, color: AppColors.textMuted)),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text('${(meter.targetUnits - meter.remainingUnits).round()} units used',
            style: AppType.mono(8, color: AppColors.textMuted)),
        const SizedBox(height: 3),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text('Today ${meter.todayUsage.toStringAsFixed(2)} units',
              style: AppType.inter(8, color: color, weight: FontWeight.w700)),
        ),
      ],
    );
  }
}

class _Tip extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title, body;
  const _Tip({required this.icon, required this.color, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 16, color: color),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppType.inter(10.5, color: AppColors.textPrimary, weight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(body, style: AppType.inter(9.5, color: AppColors.textSecondary, height: 1.4)),
            ],
          ),
        ),
      ],
    );
  }
}
