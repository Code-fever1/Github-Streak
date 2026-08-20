import 'dart:math';

import 'package:flutter/material.dart';

import '../data/energy_scope.dart';
import '../models/energy.dart';
import '../scene/scene.dart';
import '../theme/app_colors.dart';
import '../widgets/gauges.dart';
import '../widgets/glass_card.dart';
import '../widgets/scene_background.dart';

class MetersPage extends StatelessWidget {
  const MetersPage({super.key});

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    final m1 = p.meter('meter1');
    final m2 = p.meter('meter2');
    final home = p.home;
    final active = p.activeMeter == 'meter1' ? m1 : m2;
    const totalTarget = 400.0;
    final totalRemaining = m1.remainingUnits + m2.remainingUnits;
    final totalUsed = (m1.targetUnits - m1.remainingUnits) +
        (m2.targetUnits - m2.remainingUnits);
    final overBudget = (home.projectedMonthly - totalTarget).round();
    final isOver = overBudget > 0;

    return Stack(
      children: [
        SceneBackground(scene: p.scene),
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 120),
          children: [
            const _PageHeader(
                title: 'Energy',
                subtitle:
                    'Meter tracking, usage comparison & changeover control'),
            const SizedBox(height: 16),

            // ── Active meter selector ───────────────────────────────
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                                color: active.isDigital
                                    ? AppColors.grid
                                    : AppColors.home,
                                shape: BoxShape.circle)),
                        const SizedBox(width: 8),
                        Text('Active Meter',
                            style: AppType.inter(10,
                                color: AppColors.textSecondary)),
                        const SizedBox(width: 8),
                        Text(active.label,
                            style: AppType.inter(10.5,
                                color: AppColors.textPrimary,
                                weight: FontWeight.w700)),
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
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
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
                Expanded(
                    child: _MeterCard(
                        meter: m1,
                        isActive: p.activeMeter == 'meter1',
                        scene: p.scene)),
                const SizedBox(width: 12),
                Expanded(
                    child: _MeterCard(
                        meter: m2,
                        isActive: p.activeMeter == 'meter2',
                        scene: p.scene)),
              ],
            ),
            const SizedBox(height: 12),

            // ── Forecast & budget — Solar prediction-hero style ──────
            GlassCard(
              scene: p.scene,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Card header
                  Row(
                    children: [
                      const Icon(Icons.auto_awesome_rounded,
                          size: 13, color: AppColors.purple),
                      const SizedBox(width: 6),
                      Text('AI Forecast & Budget',
                          style: AppType.inter(12.5,
                              color: AppColors.textPrimary,
                              weight: FontWeight.w700,
                              letterSpacing: -0.3)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.purpleSoft,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                            '${home.confidencePercent.round()}% Confidence',
                            style: AppType.inter(8.5,
                                color: AppColors.purple,
                                weight: FontWeight.w700)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // ── Prediction hero (dark green overlay, Solar-style) ──
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E3A28),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Eyebrow
                        Row(
                          children: [
                            Container(
                                width: 5,
                                height: 5,
                                decoration: BoxDecoration(
                                    color: AppColors.success,
                                    borderRadius:
                                        BorderRadius.circular(2.5))),
                            const SizedBox(width: 5),
                            Text('PROJECTED MONTHLY USAGE',
                                style: AppType.mono(8.5,
                                    color: const Color(0xFFB5D7BD),
                                    letterSpacing: 0.9,
                                    weight: FontWeight.w600)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        // Hero value
                        Text.rich(
                          TextSpan(
                            text: home.projectedMonthly.round().toString(),
                            style: const TextStyle(
                                fontFamily: 'Outfit',
                                fontSize: 32,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                                letterSpacing: -0.8,
                                height: 1.1),
                            children: [
                              TextSpan(
                                  text: '  units',
                                  style: AppType.inter(11,
                                      color: const Color(0xFFD3E4D4),
                                      weight: FontWeight.w600)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 4),
                        // Subtitle
                        Text(
                            '${(home.combinedDaysLeft ?? 0).round()} days remaining at your current pace',
                            style: AppType.inter(10,
                                color: const Color(0xFFD3E4D4))),
                        const SizedBox(height: 18),
                        // Progress line — budget consumed
                        ClipRRect(
                          borderRadius: BorderRadius.circular(5),
                          child: Stack(
                            children: [
                              Container(
                                  height: 5,
                                  color: const Color(0xFF50735D)),
                              FractionallySizedBox(
                                widthFactor: (totalUsed / totalTarget)
                                    .clamp(0.0, 1.0),
                                child: Container(
                                    height: 5,
                                    color: isOver
                                        ? AppColors.danger
                                        : const Color(0xFF9DD98B)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        // 3-column prediction stats with dividers
                        IntrinsicHeight(
                          child: Row(
                            children: [
                              Expanded(
                                child: _PredictionStat(
                                  value: home.averageDaily.toStringAsFixed(1),
                                  label: 'Daily units',
                                ),
                              ),
                              Container(
                                  width: 1,
                                  color: const Color(0xFF557661)),
                              Expanded(
                                child: _PredictionStat(
                                  value: home.projectedMonthly.round().toString(),
                                  label: 'Monthly units',
                                ),
                              ),
                              Container(
                                  width: 1,
                                  color: const Color(0xFF557661)),
                              Expanded(
                                child: _PredictionStat(
                                  value:
                                      '${(home.outerRingScore ?? 0).round()}',
                                  label: 'Health score',
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Budget status row ──
                  Row(
                    children: [
                      Icon(
                          isOver
                              ? Icons.trending_up_rounded
                              : Icons.trending_down_rounded,
                          size: 13,
                          color: isOver
                              ? AppColors.danger
                              : AppColors.success),
                      const SizedBox(width: 4),
                      Text(
                        isOver
                            ? '+$overBudget units over budget'
                            : '${overBudget.abs()} units under budget',
                        style: AppType.inter(9.5,
                            color: isOver
                                ? AppColors.danger
                                : AppColors.success,
                            weight: FontWeight.w700),
                      ),
                      const Spacer(),
                      if (home.lastMonthTotal != null) ...[
                        Text('vs last month ',
                            style: AppType.inter(8.5,
                                color: AppColors.textMuted)),
                        Text(
                            '${home.vsLastMonthPercent! >= 0 ? '+' : ''}${home.vsLastMonthPercent!.round()}%',
                            style: AppType.mono(9,
                                color: home.vsLastMonthPercent! <= 0
                                    ? AppColors.success
                                    : AppColors.danger,
                                weight: FontWeight.w700)),
                      ],
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: AppColors.border, height: 1),
                  const SizedBox(height: 16),

                  // ── Cumulative usage chart ──
                  Row(
                    children: [
                      const _LegendDot(color: AppColors.home, label: 'Actual'),
                      const SizedBox(width: 10),
                      const _LegendDot(
                          color: AppColors.warning, label: 'Forecast'),
                      const Spacer(),
                      Text('CUMULATIVE USAGE',
                          style: AppType.mono(7.5,
                              color: AppColors.textMuted,
                              letterSpacing: 0.9)),
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
                      Text('28th',
                          style: TextStyle(
                              fontFamily: 'JetBrainsMono',
                              fontSize: 8,
                              color: AppColors.textMuted)),
                      Text('4th',
                          style: TextStyle(
                              fontFamily: 'JetBrainsMono',
                              fontSize: 8,
                              color: AppColors.textMuted)),
                      Text('12th',
                          style: TextStyle(
                              fontFamily: 'JetBrainsMono',
                              fontSize: 8,
                              color: AppColors.textMuted)),
                      Text('20th',
                          style: TextStyle(
                              fontFamily: 'JetBrainsMono',
                              fontSize: 8,
                              color: AppColors.textMuted)),
                      Text('28th',
                          style: TextStyle(
                              fontFamily: 'JetBrainsMono',
                              fontSize: 8,
                              color: AppColors.textMuted)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: AppColors.border, height: 1),
                  const SizedBox(height: 16),

                  // ── Meter gauges row — Meter 1 | Total | Meter 2 ──
                  IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Meter 1
                        Expanded(
                          child: _GaugeColumn(
                            meter: m1,
                            color: AppColors.home,
                            title: 'Meter 1 (Analog)',
                          ),
                        ),
                        // Divider — full-height, Solar-style subtle neutral
                        Container(width: 1, color: AppColors.border),
                        // Middle — Total Remaining
                        Expanded(
                          child: _TotalRemainingColumn(
                            totalRemaining: totalRemaining,
                            totalTarget: totalTarget,
                            totalUsed: totalUsed,
                            estDaysLeft: (home.combinedDaysLeft ?? 0).round(),
                          ),
                        ),
                        // Divider — full-height, Solar-style subtle neutral
                        Container(width: 1, color: AppColors.border),
                        // Meter 2
                        Expanded(
                          child: _GaugeColumn(
                            meter: m2,
                            color: AppColors.grid,
                            title: 'Meter 2 (Digital)',
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // ── Smart tips ──────────────────────────────────────────
            GlassCard(
              scene: p.scene,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.show_chart_rounded,
                          size: 13, color: AppColors.purple),
                      const SizedBox(width: 6),
                      Text('Smart Tips',
                          style: AppType.inter(12.5,
                              color: AppColors.textPrimary,
                              weight: FontWeight.w700,
                              letterSpacing: -0.3)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const _Tip(
                    icon: Icons.wb_sunny_rounded,
                    color: AppColors.solar,
                    title: 'Meter 1 (Analog) is more efficient.',
                    body: 'Saving ~15% units (4.5 units/month) vs Meter 2.',
                  ),
                  const Divider(color: AppColors.border, height: 20),
                  const _Tip(
                    icon: Icons.speed_rounded,
                    color: AppColors.info,
                    title: 'Usage pace is on target.',
                    body:
                        'You are on track to stay within this cycle\u2019s 400-unit budget.',
                  ),
                ],
              ),
            ),
          ],
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
        Text('VOLTIX',
            style: AppType.mono(9.5,
                color: AppColors.textSecondary, letterSpacing: 1.6)),
        const SizedBox(height: 5),
        Text(title,
            style: const TextStyle(
                fontFamily: 'Outfit',
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
                letterSpacing: -0.6)),
        const SizedBox(height: 3),
        Text(subtitle,
            style: AppType.inter(10.5, color: AppColors.textSecondary)),
      ],
    );
  }
}

class _MeterCard extends StatelessWidget {
  final MeterState meter;
  final bool isActive;
  final HeroSceneId scene;

  const _MeterCard(
      {required this.meter, required this.isActive, required this.scene});

  @override
  Widget build(BuildContext context) {
    final accent = meter.isDigital ? AppColors.grid : AppColors.home;
    final typeLabel = meter.isDigital ? 'Digital' : 'Analog';
    final remainingPct =
        (meter.remainingUnits / meter.targetUnits * 100).round().clamp(0, 100);
    final lastReading = meter.lastLoggedReading;
    final todayUsage = meter.todayUsage;
    final healthColor = meter.healthScore >= 80
        ? AppColors.success
        : meter.healthScore >= 60
            ? AppColors.warning
            : AppColors.danger;

    return GlassCard(
      scene: scene,
      radius: 14,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header: Active/Inactive pill + Meter title + type pill ──
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (isActive)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('Active',
                      style: AppType.inter(8,
                          color: accent, weight: FontWeight.w700)),
                )
              else
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.textMuted.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('Inactive',
                      style: AppType.inter(8,
                          color: AppColors.textMuted, weight: FontWeight.w700)),
                ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Meter ${meter.id == 'meter1' ? '1' : '2'}',
                      style: AppType.inter(13,
                          color: AppColors.textPrimary,
                          weight: FontWeight.w700)),
                  const SizedBox(width: 6),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(typeLabel,
                        style: AppType.inter(8,
                            color: accent, weight: FontWeight.w600)),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),

          // ── Current Reading — HERO ──
          Row(
            children: [
              Container(
                  width: 5,
                  height: 5,
                  decoration: BoxDecoration(
                      color: accent, borderRadius: BorderRadius.circular(2.5))),
              const SizedBox(width: 4),
              Text('CURRENT READING',
                  style: AppType.inter(8,
                      color: AppColors.textSecondary,
                      weight: FontWeight.w600,
                      letterSpacing: 0.3)),
            ],
          ),
          const SizedBox(height: 3),
          Text.rich(
            TextSpan(
              text: _fmt(meter.reading),
              style: const TextStyle(
                  fontFamily: 'Outfit',
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.5,
                  height: 1.15),
              children: [
                TextSpan(
                    text: ' kWh',
                    style: AppType.inter(12,
                        color: AppColors.textMuted, weight: FontWeight.w500)),
              ],
            ),
          ),
          if (lastReading != null) ...[
            const SizedBox(height: 3),
            Text.rich(
              TextSpan(
                text: 'Last ',
                style: AppType.inter(8, color: AppColors.textMuted),
                children: [
                  TextSpan(
                      text: _fmt(lastReading),
                      style: AppType.inter(8,
                          color: AppColors.textSecondary,
                          weight: FontWeight.w600)),
                  TextSpan(
                      text: ' · ${_timeAgo(meter.lastLoggedAt ?? 0)}',
                      style: AppType.inter(8, color: AppColors.textMuted)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),

          // ── Today's Usage — compact row with overlay bg ──
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.textPrimary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Today',
                    style: AppType.inter(8, color: AppColors.textSecondary)),
                Text.rich(
                  TextSpan(
                    text: todayUsage.toStringAsFixed(2),
                    style: AppType.inter(13,
                        color: accent, weight: FontWeight.w700),
                    children: [
                      TextSpan(
                          text: ' u',
                          style: AppType.inter(8, color: AppColors.textMuted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // ── Remaining Budget — horizontal bar with overlay bg ──
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.textPrimary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Remaining Budget',
                        style:
                            AppType.inter(8, color: AppColors.textSecondary)),
                    Text('$remainingPct%',
                        style: AppType.inter(10,
                            color: AppColors.textPrimary,
                            weight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: Stack(
                    children: [
                      Container(
                          height: 4,
                          color: AppColors.textPrimary.withValues(alpha: 0.06)),
                      FractionallySizedBox(
                        widthFactor: (remainingPct / 100).clamp(0.0, 1.0),
                        child: Container(
                            height: 4,
                            color: CircularGauge.gaugeColor(
                                meter.remainingUnits, accent)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                Text.rich(
                  TextSpan(
                    text: '',
                    style: AppType.inter(9, color: AppColors.textMuted),
                    children: [
                      TextSpan(
                          text: '${meter.remainingUnits.round()}',
                          style: AppType.inter(9,
                              color: accent, weight: FontWeight.w700)),
                      TextSpan(
                          text:
                              ' units left · ${meter.projectedDaysLeft.round()} days',
                          style: AppType.inter(9, color: AppColors.textMuted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // ── Forecast mini-row — Projected | Health ──
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.textPrimary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Projected',
                            style:
                                AppType.inter(8, color: AppColors.textMuted)),
                        const SizedBox(height: 2),
                        Text('${meter.projectedMonthly.round()} units',
                            style: AppType.inter(11,
                                color: AppColors.textPrimary,
                                weight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  const VerticalDivider(
                    width: 1,
                    color: AppColors.border,
                    indent: 0,
                    endIndent: 0,
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Health',
                              style:
                                  AppType.inter(8, color: AppColors.textMuted)),
                          const SizedBox(height: 2),
                          Text('${meter.healthScore.round()}/100',
                              style: AppType.inter(11,
                                  color: healthColor, weight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
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

  String _timeAgo(int ts) {
    if (ts == 0) return '';
    final diff = DateTime.now().millisecondsSinceEpoch - ts * 1000;
    if (diff < 0) return 'just now';
    final mins = diff ~/ 60000;
    if (mins < 60) return '${mins}m ago';
    final hrs = mins ~/ 60;
    if (hrs < 24) return '${hrs}h ago';
    final days = hrs ~/ 24;
    return '${days}d ago';
  }
}

/// 3-column prediction stat — matches Solar's prediction-stats grid.
/// Used inside the dark-green prediction hero overlay.
class _PredictionStat extends StatelessWidget {
  final String value;
  final String label;
  const _PredictionStat({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14, top: 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value,
              style: const TextStyle(
                  fontFamily: 'Outfit',
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.4)),
          const SizedBox(height: 2),
          Text(label,
              style: AppType.inter(8.5, color: const Color(0xFFB5D5BD))),
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
        Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
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

  const _CumulativeChart(
      {required this.used,
      required this.projected,
      required this.target,
      required this.daysLeft});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _CumulativePainter(
          used: used, projected: projected, target: target, daysLeft: daysLeft),
      size: Size.infinite,
    );
  }
}

class _CumulativePainter extends CustomPainter {
  final double used, projected, target;
  final int daysLeft;

  _CumulativePainter(
      {required this.used,
      required this.projected,
      required this.target,
      required this.daysLeft});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final top = 6.0, bottom = h - 4;
    final yMax = target * 1.05;
    double yOf(double v) => bottom - (v / yMax) * (bottom - top);

    // Grid lines: 0, half, target
    final grid = Paint()
      ..strokeWidth = 1
      ..color = AppColors.border.withValues(alpha: 0.5);
    for (final v in [0.0, target / 2, target]) {
      canvas.drawLine(Offset(0, yOf(v)), Offset(w, yOf(v)), grid);
    }

    // Actual: linear from 0 → used at (elapsed = 22/30)
    const elapsedFrac = 22 / 30;
    final actual = Path()
      ..moveTo(0, yOf(0))
      ..lineTo(w * elapsedFrac, yOf(used));
    canvas.drawPath(
        actual,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.8
          ..strokeCap = StrokeCap.round
          ..color = AppColors.home);
    canvas.drawCircle(
        Offset(w * elapsedFrac, yOf(used)), 3, Paint()..color = AppColors.home);

    // Forecast: dashed from current → projected (amber, per Solar reference)
    final dash = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..color = AppColors.warning;
    for (var x = w * elapsedFrac; x < w; x += 6) {
      final f0 = (x - w * elapsedFrac) / (w - w * elapsedFrac);
      final f1 = min(1.0, f0 + 3 / max(1, w - w * elapsedFrac));
      canvas.drawLine(
        Offset(x, yOf(used + (projected - used) * f0)),
        Offset(x + (w - w * elapsedFrac) * (f1 - f0),
            yOf(used + (projected - used) * f1)),
        dash,
      );
    }

    // Today marker
    final marker = Paint()
      ..strokeWidth = 1
      ..color = AppColors.textMuted.withValues(alpha: 0.6);
    canvas.drawLine(
        Offset(w * elapsedFrac, top), Offset(w * elapsedFrac, bottom), marker);

    // Target line label
    final tp = TextPainter(
      text: TextSpan(
          text: '${target.round()} target',
          style: AppType.mono(7, color: AppColors.textMuted)),
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
  final String title;
  const _GaugeColumn(
      {required this.meter, required this.color, required this.title});

  @override
  Widget build(BuildContext context) {
    final used = meter.targetUnits - meter.remainingUnits;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        children: [
          // Title
          Text(title,
              textAlign: TextAlign.center,
              style: AppType.inter(9.5,
                  color: AppColors.textPrimary, weight: FontWeight.w700)),
          const SizedBox(height: 6),
          // Circular gauge — 240° arc matching Solar SVG
          CircularGauge(
            value: meter.remainingUnits / meter.targetUnits,
            color: color,
            size: 88,
            strokeWidth: 8,
            remainingUnits: meter.remainingUnits,
            arcSweep: 240,
            startAngle: 240,
            center: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(meter.remainingUnits.round().toString(),
                    style: const TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.5)),
                Text('units left',
                    style: AppType.inter(7.5, color: AppColors.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Total Used stat
          Text('Total Used',
              style: AppType.inter(8, color: AppColors.textSecondary)),
          const SizedBox(height: 2),
          Text.rich(
            TextSpan(
              text: used.toStringAsFixed(2),
              style: AppType.inter(11,
                  color: AppColors.textPrimary, weight: FontWeight.w700),
              children: [
                TextSpan(
                    text: ' units',
                    style: AppType.inter(8, color: AppColors.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Today pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.textPrimary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Today  ',
                    style: AppType.inter(8, color: AppColors.textSecondary)),
                Text('${meter.todayUsage.toStringAsFixed(2)} units',
                    style: AppType.inter(8.5,
                        color: AppColors.textPrimary, weight: FontWeight.w700)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Middle column — Total Remaining ring (270° arc, purple).
class _TotalRemainingColumn extends StatelessWidget {
  final double totalRemaining;
  final double totalTarget;
  final double totalUsed;
  final int estDaysLeft;

  const _TotalRemainingColumn({
    required this.totalRemaining,
    required this.totalTarget,
    required this.totalUsed,
    required this.estDaysLeft,
  });

  @override
  Widget build(BuildContext context) {
    final budgetPct =
        ((totalRemaining / totalTarget) * 100).clamp(0, 100) / 100;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        children: [
          // Title
          Text('TOTAL REMAINING',
              textAlign: TextAlign.center,
              style: AppType.inter(8,
                  color: AppColors.textSecondary,
                  weight: FontWeight.w600,
                  letterSpacing: 0.5)),
          const SizedBox(height: 6),
          // Circular gauge — 270° arc matching Solar SVG
          CircularGauge(
            value: budgetPct,
            color: AppColors.purple,
            size: 96,
            strokeWidth: 10,
            remainingUnits: totalRemaining,
            arcSweep: 270,
            startAngle: 225,
            center: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(totalRemaining.round().toString(),
                    style: const TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.5)),
                Text('units left',
                    style: AppType.inter(7.5, color: AppColors.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text('≈ $estDaysLeft days remaining',
              style: AppType.inter(8.5, color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          Text('Total Used',
              style: AppType.inter(8, color: AppColors.textSecondary)),
          const SizedBox(height: 2),
          Text.rich(
            TextSpan(
              text: totalUsed.toStringAsFixed(2),
              style: AppType.inter(11,
                  color: AppColors.textPrimary, weight: FontWeight.w700),
              children: [
                TextSpan(
                    text: ' units',
                    style: AppType.inter(8, color: AppColors.textSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tip extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title, body;
  const _Tip(
      {required this.icon,
      required this.color,
      required this.title,
      required this.body});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 16, color: color),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: AppType.inter(10.5,
                      color: AppColors.textPrimary, weight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(body,
                  style: AppType.inter(9.5,
                      color: AppColors.textSecondary, height: 1.4)),
            ],
          ),
        ),
      ],
    );
  }
}
