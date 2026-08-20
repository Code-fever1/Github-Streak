import 'dart:math';

import 'package:flutter/material.dart';

import '../data/energy_provider.dart';
import '../data/energy_scope.dart';
import '../models/energy.dart';
import '../theme/app_colors.dart';
import '../widgets/gauges.dart';
import '../widgets/glass_card.dart';
import '../widgets/scene_background.dart';

class SummaryPage extends StatefulWidget {
  const SummaryPage({super.key});

  @override
  State<SummaryPage> createState() => _SummaryPageState();
}

class _SummaryPageState extends State<SummaryPage> {
  int _tab = 0;
  static const _tabs = ['Usage', 'Inverter', 'Meter'];

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    return Stack(
      children: [
        SceneBackground(scene: p.scene),
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 120),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('VOLTIX',
                        style: AppType.mono(9.5,
                            color: AppColors.textSecondary,
                            letterSpacing: 1.6)),
                    const SizedBox(height: 5),
                    Text('Summary',
                        style: const TextStyle(
                            fontFamily: 'Outfit',
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.6)),
                    const SizedBox(height: 3),
                    Text('Complete device telemetry & usage analytics',
                        style: AppType.inter(10.5,
                            color: AppColors.textSecondary)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Segmented tab bar
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: List.generate(_tabs.length, (i) {
                  final selected = _tab == i;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _tab = i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        curve: Curves.easeOut,
                        padding: const EdgeInsets.symmetric(vertical: 9),
                        decoration: BoxDecoration(
                          color: selected
                              ? AppColors.surfaceAlt
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              i == 0
                                  ? Icons.show_chart_rounded
                                  : i == 1
                                      ? Icons.wb_sunny_rounded
                                      : Icons.memory_rounded,
                              size: 13,
                              color: selected
                                  ? AppColors.textPrimary
                                  : AppColors.textMuted,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _tabs[i],
                              style: AppType.inter(10.5,
                                  color: selected
                                      ? AppColors.textPrimary
                                      : AppColors.textMuted,
                                  weight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 12),

            if (_tab == 0)
              _UsageTab(home: p.home, confidence: p.home.confidencePercent),
            if (_tab == 1) _InverterTab(inv: p.inverter),
            if (_tab == 2) _MeterTab(p: p),
          ],
        ),
      ],
    );
  }
}

// ═══════════════════════ USAGE ═══════════════════════
class _UsageTab extends StatelessWidget {
  final HomeState home;
  final double confidence;
  const _UsageTab({required this.home, required this.confidence});

  @override
  Widget build(BuildContext context) {
    final days = [5.4, 5.1, 6.0, 5.7, 5.8, 6.2, home.todayUsage];
    final labels = const ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
    final avg = home.averageDaily;
    final maxV = days.fold<double>(0, (m, v) => max(m, v));
    final trendPct = home.trend == 'decreasing'
        ? -(home.usageChangePercent?.abs() ?? 8.5)
        : home.trend == 'increasing'
            ? (home.usageChangePercent?.abs() ?? 8.5)
            : null;

    return Column(
      children: [
        GlassCard(
          scene: EnergyScope.of(context).scene,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.show_chart_rounded,
                      size: 13, color: AppColors.purple),
                  const SizedBox(width: 6),
                  Text('USAGE SUMMARY',
                      style: AppType.mono(9,
                          color: AppColors.textSecondary, letterSpacing: 1.1)),
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                        color: AppColors.purpleSoft,
                        borderRadius: BorderRadius.circular(20)),
                    child: Text('${confidence.round()}% confidence',
                        style: AppType.inter(8.5,
                            color: AppColors.purple, weight: FontWeight.w700)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text('AVG DAILY USAGE',
                  style: AppType.mono(7.5,
                      color: AppColors.textMuted, letterSpacing: 1)),
              const SizedBox(height: 4),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text.rich(
                    TextSpan(
                      text: home.averageDaily.toStringAsFixed(2),
                      style: const TextStyle(
                          fontFamily: 'Outfit',
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.8),
                      children: [
                        TextSpan(
                            text: '  units / day',
                            style: AppType.inter(10,
                                color: AppColors.textSecondary,
                                weight: FontWeight.w600))
                      ],
                    ),
                  ),
                  const Spacer(),
                  if (trendPct != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color:
                            (trendPct <= 0 ? AppColors.home : AppColors.danger)
                                .withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        children: [
                          Icon(
                              trendPct <= 0
                                  ? Icons.arrow_downward_rounded
                                  : Icons.arrow_upward_rounded,
                              size: 11,
                              color: trendPct <= 0
                                  ? AppColors.home
                                  : AppColors.danger),
                          const SizedBox(width: 3),
                          Text('${trendPct.abs().toStringAsFixed(1)}%',
                              style: AppType.inter(9,
                                  color: trendPct <= 0
                                      ? AppColors.home
                                      : AppColors.danger,
                                  weight: FontWeight.w700)),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              SizedBox(
                height: 128,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: List.generate(7, (i) {
                    final v = days[i];
                    final isToday = i == 6;
                    final isAbove = v > avg * 1.05;
                    final isBelow = v < avg * 0.95;
                    final color = isToday
                        ? AppColors.info
                        : isAbove
                            ? AppColors.danger.withValues(alpha: 0.75)
                            : isBelow
                                ? AppColors.home.withValues(alpha: 0.75)
                                : AppColors.textMuted.withValues(alpha: 0.55);
                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 5),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Text(v.toStringAsFixed(1),
                                style: AppType.mono(7.5,
                                    color: AppColors.textMuted)),
                            const SizedBox(height: 4),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              height: (v / maxV) * 88,
                              decoration: BoxDecoration(
                                color: color,
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(labels[i],
                                style: AppType.mono(8,
                                    color: isToday
                                        ? AppColors.info
                                        : AppColors.textMuted)),
                          ],
                        ),
                      ),
                    );
                  }),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        GlassCard(
          scene: EnergyScope.of(context).scene,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('USAGE WINDOWS',
                  style: AppType.mono(9,
                      color: AppColors.textSecondary, letterSpacing: 1.1)),
              const SizedBox(height: 14),
              Row(
                children: [
                  DonutChart(
                    segments: [
                      (home.periodDay ?? 0, AppColors.todDay),
                      (home.periodMorningEvening ?? 0, AppColors.todTransition),
                      (home.periodNight ?? 0, AppColors.todNight),
                    ],
                    size: 96,
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      children: [
                        _WindowRow(
                            color: AppColors.todDay,
                            label: 'Day',
                            time: '9AM–6PM',
                            pct: home.periodDay ?? 0),
                        const SizedBox(height: 12),
                        _WindowRow(
                            color: AppColors.todTransition,
                            label: 'Transition',
                            time: '5–9AM & 6–10PM',
                            pct: home.periodMorningEvening ?? 0),
                        const SizedBox(height: 12),
                        _WindowRow(
                            color: AppColors.todNight,
                            label: 'Night',
                            time: '10PM–5AM',
                            pct: home.periodNight ?? 0),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _WindowRow extends StatelessWidget {
  final Color color;
  final String label, time;
  final double pct;
  const _WindowRow(
      {required this.color,
      required this.label,
      required this.time,
      required this.pct});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 7),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: AppType.inter(9.5,
                    color: AppColors.textPrimary, weight: FontWeight.w700)),
            Text(time, style: AppType.mono(7.5, color: AppColors.textMuted)),
          ],
        ),
        const Spacer(),
        Text('${pct.round()}%',
            style: AppType.mono(10, color: AppColors.textSecondary)),
      ],
    );
  }
}

// ═══════════════════════ INVERTER ═══════════════════════
class _InverterTab extends StatelessWidget {
  final InverterTelemetry inv;
  const _InverterTab({required this.inv});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _DeviceHeader(
          icon: Icons.wb_sunny_rounded,
          color: AppColors.solar,
          name: 'Fronus Inverter',
          subtitle: 'Solar inverter telemetry',
          live: inv.isOnline,
          lastFetched: 'just now',
        ),
        const SizedBox(height: 12),
        _SectionCard(
          icon: Icons.wb_sunny_rounded,
          color: AppColors.solar,
          title: 'Solar (PV)',
          children: [
            _TileRow([
              _Tile('Total Power', '${inv.solarW.round()} W', AppColors.solar),
              _Tile('Avg Voltage', '${inv.solarV.toStringAsFixed(1)} V',
                  AppColors.solar),
              _Tile('Total Current', '${inv.solarA.toStringAsFixed(1)} A',
                  AppColors.solar),
            ]),
            const SizedBox(height: 10),
            _SubRow('MPPT 1', '${inv.pv1V.toStringAsFixed(1)} V',
                '${inv.pv1A.toStringAsFixed(1)} A', '${inv.pv1W.round()} W'),
            const SizedBox(height: 6),
            _SubRow('MPPT 2', '${inv.pv2V.toStringAsFixed(1)} V',
                '${inv.pv2A.toStringAsFixed(1)} A', '${inv.pv2W.round()} W'),
          ],
        ),
        _SectionCard(
          icon: Icons.bolt_rounded,
          color: AppColors.grid,
          title: 'Grid',
          children: [
            _TileRow([
              _Tile('Power', '${inv.gridW.round()} W', AppColors.grid),
              _Tile('Voltage', '${inv.gridV.toStringAsFixed(1)} V',
                  AppColors.grid),
              _Tile('Frequency', '${inv.gridHz.toStringAsFixed(2)} Hz',
                  AppColors.grid),
            ]),
            const SizedBox(height: 10),
            Row(
              children: [
                _InlineStat(
                    label: 'Connection',
                    value: inv.gridConnected ? 'Connected' : 'Disconnected',
                    color: inv.gridConnected
                        ? AppColors.success
                        : AppColors.danger),
                const SizedBox(width: 14),
                _InlineStat(
                    label: 'Direction',
                    value: inv.gridDirection == 'export'
                        ? 'Exporting'
                        : 'Importing',
                    color: inv.gridDirection == 'export'
                        ? AppColors.export
                        : AppColors.danger),
              ],
            ),
          ],
        ),
        _SectionCard(
          icon: Icons.electric_bolt_rounded,
          color: AppColors.home,
          title: 'Load (AC Output)',
          children: [
            _TileRow([
              _Tile('Active Power', '${inv.loadW.round()} W', AppColors.home),
              _Tile(
                  'Apparent Power', '${inv.loadVa.round()} VA', AppColors.home),
              _Tile('Load', '${inv.loadPercent.round()}%', AppColors.home),
            ]),
            const SizedBox(height: 10),
            Row(
              children: [
                _InlineStat(
                    label: 'Output V',
                    value: '${inv.acOutV.toStringAsFixed(1)} V'),
                const SizedBox(width: 14),
                _InlineStat(
                    label: 'Output Hz',
                    value: '${inv.acOutHz.toStringAsFixed(2)} Hz'),
                const SizedBox(width: 14),
                _InlineStat(
                    label: 'Rated Output',
                    value: '${inv.ratedOutputW.round()} W'),
              ],
            ),
          ],
        ),
        _SectionCard(
          icon: Icons.memory_rounded,
          color: AppColors.purple,
          title: 'Inverter Status',
          children: [
            _TileRow([
              _Tile('Mode', inv.inverterMode, AppColors.purple),
              _Tile(
                  'Fault',
                  inv.inverterFault,
                  inv.inverterFault == 'NO'
                      ? AppColors.textMuted
                      : AppColors.danger),
              _Tile('Temperature', '${inv.temperatureC.toStringAsFixed(1)}°C',
                  AppColors.purple),
            ]),
            const SizedBox(height: 10),
            Row(
              children: [
                _InlineStat(
                    label: 'Signal',
                    value: inv.signal == null
                        ? '—'
                        : '${inv.signal!.round()} dBm'),
                const SizedBox(width: 14),
                _InlineStat(label: 'Firmware', value: inv.firmware ?? '—'),
                const SizedBox(width: 14),
                _InlineStat(
                    label: 'Data Status',
                    value: inv.isLive ? 'Live' : 'Stale',
                    color: inv.isLive ? AppColors.success : AppColors.warning),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

// ═══════════════════════ METER (TOMZN) ═══════════════════════
class _MeterTab extends StatelessWidget {
  final EnergyProvider p;
  const _MeterTab({required this.p});

  @override
  Widget build(BuildContext context) {
    final t = p.tomzn;
    return Column(
      children: [
        _DeviceHeader(
          icon: Icons.memory_rounded,
          color: AppColors.grid,
          name: 'Tomzn Meter',
          subtitle: 'Smart meter telemetry',
          live: t.isOnline,
          lastFetched: 'just now',
        ),
        const SizedBox(height: 12),
        _SectionCard(
          icon: Icons.bolt_rounded,
          color: AppColors.grid,
          title: 'Live Telemetry',
          children: [
            _TileRow([
              _Tile('Power', '${t.powerW.round()} W', AppColors.grid),
              _Tile('Voltage', '${t.voltageV.toStringAsFixed(1)} V',
                  AppColors.grid),
              _Tile('Current', '${t.currentA.toStringAsFixed(1)} A',
                  AppColors.grid),
            ]),
            const SizedBox(height: 10),
            _TileRow([
              _Tile('Frequency', '${t.frequencyHz.toStringAsFixed(2)} Hz',
                  AppColors.grid),
              _Tile('Total Energy', '${t.energyKwh.toStringAsFixed(1)} kWh',
                  AppColors.grid),
              _Tile(
                  'Active Meter',
                  p.activeMeter == 'meter1' ? 'Meter 1' : 'Meter 2',
                  AppColors.grid),
            ]),
          ],
        ),
        _SectionCard(
          icon: Icons.warning_amber_rounded,
          color: AppColors.warning,
          title: 'Switch & Fault',
          children: [
            _TileRow([
              _Tile('Switch', t.switchOn ? 'ON' : 'OFF',
                  t.switchOn ? AppColors.success : AppColors.danger),
              _Tile('Online', t.isOnline ? 'Online' : 'Offline',
                  t.isOnline ? AppColors.success : AppColors.danger),
              _Tile('Fault Code', '${t.faultCode}',
                  t.faultCode == 0 ? AppColors.success : AppColors.danger),
            ]),
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border:
                    Border.all(color: AppColors.success.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Icon(Icons.check_circle_rounded,
                      size: 14, color: AppColors.success),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('No Faults',
                            style: AppType.inter(9.5,
                                color: AppColors.success,
                                weight: FontWeight.w700)),
                        Text(
                            'System is operating normally. No fault flags are active.',
                            style: AppType.inter(8.5,
                                color: AppColors.textSecondary, height: 1.4)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        _SectionCard(
          icon: Icons.trending_up_rounded,
          color: AppColors.grid,
          title: '24-Hour Usage',
          subtitle: 'Hourly consumption',
          children: [
            _HourlyBars(points: p.flowHistory),
          ],
        ),
        _SectionCard(
          icon: Icons.history_rounded,
          color: AppColors.grid,
          title: 'History (Recent 10)',
          subtitle: 'Hourly records',
          children: [
            _HistoryList(points: p.flowHistory),
          ],
        ),
      ],
    );
  }
}

// ═══════════════════════ shared pieces ═══════════════════════
class _DeviceHeader extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String name, subtitle;
  final bool live;
  final String lastFetched;

  const _DeviceHeader({
    required this.icon,
    required this.color,
    required this.name,
    required this.subtitle,
    required this.live,
    required this.lastFetched,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      scene: EnergyScope.of(context).scene,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: AppType.inter(13,
                        color: AppColors.textPrimary,
                        weight: FontWeight.w700,
                        letterSpacing: -0.3)),
                Text(subtitle,
                    style: AppType.inter(9, color: AppColors.textMuted)),
              ],
            ),
          ),
          StatusPill(
              color: live ? AppColors.success : AppColors.danger,
              label: live ? 'LIVE' : 'OFFLINE'),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;
  final List<Widget> children;

  const _SectionCard(
      {required this.icon,
      required this.color,
      required this.title,
      this.subtitle,
      required this.children});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      scene: EnergyScope.of(context).scene,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 6),
              Text(title.toUpperCase(),
                  style: AppType.mono(8.5,
                      color: AppColors.textSecondary, letterSpacing: 1.1)),
              if (subtitle != null) ...[
                const SizedBox(width: 8),
                Text(subtitle!,
                    style: AppType.inter(8.5, color: AppColors.textMuted)),
              ],
            ],
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _TileRow extends StatelessWidget {
  final List<_Tile> tiles;
  const _TileRow(this.tiles);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < tiles.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(child: tiles[i]),
        ],
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  final String label, value;
  final Color color;
  const _Tile(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: AppType.mono(7,
                  color: AppColors.textMuted, letterSpacing: 0.7)),
          const SizedBox(height: 3),
          Text(value,
              overflow: TextOverflow.ellipsis,
              style: AppType.inter(11.5,
                  color: color, weight: FontWeight.w700, letterSpacing: -0.2)),
        ],
      ),
    );
  }
}

class _InlineStat extends StatelessWidget {
  final String label, value;
  final Color? color;
  const _InlineStat({required this.label, required this.value, this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          Text('$label:', style: AppType.mono(7.5, color: AppColors.textMuted)),
          const SizedBox(width: 5),
          Text(value,
              style: AppType.inter(9,
                  color: color ?? AppColors.textPrimary,
                  weight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _SubRow extends StatelessWidget {
  final String label, v, a, w;
  const _SubRow(this.label, this.v, this.a, this.w);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
            width: 52,
            child: Text(label,
                style: AppType.mono(7.5,
                    color: AppColors.textMuted, letterSpacing: 0.7))),
        Expanded(child: _inline('V', v)),
        Expanded(child: _inline('A', a)),
        Expanded(child: _inline('W', w)),
      ],
    );
  }

  Widget _inline(String unit, String value) => Text('$value $unit',
      style: AppType.inter(9, color: AppColors.textSecondary));
}

/// 24 hourly bars from flow history.
class _HourlyBars extends StatelessWidget {
  final List<FlowPoint> points;
  const _HourlyBars({required this.points});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final start = now - 24 * 3600;
    final hourly = List<double>.filled(24, 0);
    for (final pt in points) {
      if (pt.timestamp < start) continue;
      final idx = ((pt.timestamp - start) ~/ 3600).clamp(0, 23);
      hourly[idx] += pt.loadKw ?? 0;
    }
    final peak = hourly.fold<double>(0, max);
    return SizedBox(
      height: 74,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(24, (i) {
          final v = hourly[i];
          final isPeak = peak > 0 && v == peak;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1.5),
              child: Container(
                height: peak > 0 ? max(3, (v / peak) * 66) : 3,
                decoration: BoxDecoration(
                  color: isPeak
                      ? AppColors.info
                      : AppColors.grid.withValues(
                          alpha: 0.18 + 0.5 * (peak > 0 ? v / peak : 0)),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _HistoryList extends StatelessWidget {
  final List<FlowPoint> points;
  const _HistoryList({required this.points});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final rows = points
        .where((pt) => pt.timestamp >= now - 10 * 3600)
        .toList()
        .reversed
        .take(10)
        .toList();
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const Divider(color: AppColors.border, height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${DateTime.fromMillisecondsSinceEpoch(rows[i].timestamp * 1000).hour}:00',
                    style: AppType.mono(9, color: AppColors.textSecondary),
                  ),
                ),
                Text('${((rows[i].loadKw ?? 0) * 1000).round()} W',
                    style: AppType.inter(10,
                        color: AppColors.textPrimary, weight: FontWeight.w700)),
                const SizedBox(width: 12),
                SizedBox(
                  width: 64,
                  child: Text('${(rows[i].loadKw ?? 0).toStringAsFixed(2)} kWh',
                      textAlign: TextAlign.right,
                      style: AppType.mono(8.5, color: AppColors.textMuted)),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
