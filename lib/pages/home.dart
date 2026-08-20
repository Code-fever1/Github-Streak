import 'dart:math';

import 'package:flutter/material.dart';

import '../data/energy_scope.dart';
import '../theme/app_colors.dart';
import '../widgets/glass_card.dart';
import '../widgets/isometric_house.dart';
import '../widgets/solar_panel.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    final inv = p.inverter;
    final tomzn = p.tomzn;
    final offline = !inv.isOnline || !tomzn.isOnline;

    final solarW = offline ? 0.0 : inv.solarW;
    final gridW = offline ? 0.0 : (tomzn.powerW);
    final homeW = offline ? 0.0 : inv.loadW;
    final total = p.energyToday.solarKwh + p.home.todayUsage;
    final solarShare = total > 0 ? (p.energyToday.solarKwh / total * 100).round() : 0;

    final status = solarW > 20 ? 'Charging' : offline ? 'Offline' : 'Standby';
    final statusColor = solarW > 20 ? AppColors.success : offline ? AppColors.danger : AppColors.warning;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      children: [
        // ── Header ──────────────────────────────────────────────────
        Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('My Home', style: AppType.inter(22, color: AppColors.textPrimary, weight: FontWeight.w700)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(width: 6, height: 6, decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: statusColor.withValues(alpha: 0.6), blurRadius: 6)])),
                    const SizedBox(width: 6),
                    Text(status, style: AppType.inter(12, color: statusColor, weight: FontWeight.w600)),
                  ],
                ),
              ],
            ),
            const Spacer(),
            Container(
              width: 38, height: 38,
              decoration: BoxDecoration(color: AppColors.surfaceAlt, shape: BoxShape.circle,
                border: Border.all(color: AppColors.border)),
              child: const Icon(Icons.person_rounded, color: AppColors.textSecondary, size: 18),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // ── Solar Panel card ────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Solar Panel', style: AppType.inter(16, color: AppColors.textPrimary, weight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text('High energy generating', style: AppType.inter(12, color: AppColors.textSecondary)),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Icon(Icons.battery_full_rounded, size: 16, color: AppColors.success),
                        const SizedBox(width: 6),
                        Text('$solarShare% Solar', style: AppType.inter(13, color: AppColors.textPrimary, weight: FontWeight.w700)),
                      ],
                    ),
                  ],
                ),
              ),
              const SolarPanelIllustration(size: 90),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── Two metric cards ────────────────────────────────────────
        Row(
          children: [
            Expanded(
              child: _MetricCard(
                icon: Icons.bolt_rounded,
                iconColor: AppColors.success,
                label: 'Current Power',
                sublabel: 'Generation',
                value: _fmtPower(solarW),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _MetricCard(
                icon: Icons.cell_tower_rounded,
                iconColor: AppColors.grid,
                label: 'Current Grid',
                sublabel: 'Power supply',
                value: _fmtPower(gridW),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // ── Isometric home hero ─────────────────────────────────────
        Container(
          height: 240,
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.border),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: IsometricHouse(solarW: solarW, gridW: gridW, homeW: homeW),
          ),
        ),
        const SizedBox(height: 14),

        // ── Bottom three metric chips ───────────────────────────────
        Row(
          children: [
            Expanded(child: _BottomChip(
              icon: Icons.water_drop_outlined,
              color: AppColors.success,
              label: 'Load',
              value: _fmtPower(homeW),
            )),
            const SizedBox(width: 10),
            Expanded(child: _BottomChip(
              icon: Icons.cell_tower_rounded,
              color: AppColors.grid,
              label: 'Grid',
              value: _fmtPower(gridW),
            )),
            const SizedBox(width: 10),
            Expanded(child: _BottomChip(
              icon: Icons.wb_sunny_rounded,
              color: AppColors.solar,
              label: 'Solar',
              value: _fmtPower(solarW),
            )),
          ],
        ),
        const SizedBox(height: 18),

        // ── Live status rail (clean) ────────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _StatusDot('Solar', solarW > 20 ? AppColors.success : AppColors.warning),
            _StatusDot('Inverter', inv.inverterFault == 'NO' ? AppColors.success : AppColors.danger),
            _StatusDot('Grid', tomzn.isOnline ? AppColors.info : AppColors.danger),
            _StatusDot(p.activeMeter == 'meter1' ? 'Meter 1' : 'Meter 2', AppColors.textSecondary),
          ],
        ),
      ],
    );
  }

  String _fmtPower(double w) {
    final abs = w.abs();
    if (abs >= 1000) return '${(abs / 1000).toStringAsFixed(2)} kW';
    return '${abs.round()} W';
  }
}

class _MetricCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label, sublabel, value;

  const _MetricCard({
    required this.icon, required this.iconColor,
    required this.label, required this.sublabel, required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(color: iconColor.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 16, color: iconColor),
          ),
          const SizedBox(height: 12),
          Text(label, style: AppType.inter(12, color: AppColors.textSecondary)),
          Text(sublabel, style: AppType.inter(11, color: AppColors.textMuted)),
          const SizedBox(height: 8),
          Text(value, style: AppType.inter(18, color: AppColors.textPrimary, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _BottomChip extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label, value;

  const _BottomChip({required this.icon, required this.color, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 8),
          Text(label, style: AppType.inter(10, color: AppColors.textSecondary, weight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text(value, style: AppType.inter(13, color: AppColors.textPrimary, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusDot(this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 5)])),
        const SizedBox(height: 6),
        Text(label, style: AppType.inter(10, color: AppColors.textSecondary, weight: FontWeight.w600)),
      ],
    );
  }
}
