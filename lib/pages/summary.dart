import 'dart:math';

import 'package:flutter/material.dart';

import '../data/energy_scope.dart';
import '../models/energy.dart';
import '../theme/app_colors.dart';

class SummaryPage extends StatefulWidget {
  const SummaryPage({super.key});

  @override
  State<SummaryPage> createState() => _SummaryPageState();
}

class _SummaryPageState extends State<SummaryPage> {
  String _range = '7 Days';

  static const _kDays = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];

  List<double> _sevenDayValues(HomeState home) {
    final base = home.averageDaily;
    final today = home.todayUsage;
    return [
      base * 0.93,
      base * 0.88,
      base * 1.03,
      base * 0.98,
      base * 1.0,
      base * 1.07,
      today,
    ];
  }

  double _consumptionForRange(HomeState home) {
    switch (_range) {
      case 'Today':
        return home.todayUsage;
      case '30 Days':
        return home.projectedMonthly;
      case '7 Days':
      default:
        return _sevenDayValues(home).reduce((a, b) => a + b);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    final home = p.home;
    final days = _sevenDayValues(home);
    final maxV = days.reduce((a, b) => max(a, b));
    final total = _consumptionForRange(home);
    final trend = home.usageChangePercent ?? -6.2;

    final solarKwh = p.energyToday.solarKwh;
    final gridKwh = p.energyToday.gridKwh;
    final homeKwh = p.energyToday.homeKwh;
    final totalKwh = max(0.01, homeKwh);
    final solarPct = (solarKwh / totalKwh * 100).clamp(0, 100).toDouble();
    final gridPct = (gridKwh / totalKwh * 100).clamp(0, 100).toDouble();
    final nightPct = (home.periodNight ?? 46).clamp(0, 100).toDouble();

    return Scaffold(
      backgroundColor: AppColors.solarBg,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 28, 22, 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _PageHeader(),
              const SizedBox(height: 26),
              _SegmentedControl(
                selected: _range,
                onSelected: (v) => setState(() => _range = v),
              ),
              const SizedBox(height: 20),
              _AnalyticsCard(
                range: _range,
                total: total,
                trend: trend,
                days: days,
                maxV: maxV,
              ),
              const SizedBox(height: 28),
              _ConsumptionSplit(
                solarPct: solarPct,
                gridPct: gridPct,
                nightPct: nightPct,
                solarUnits: solarKwh,
                gridUnits: gridKwh,
                nightUnits: homeKwh * nightPct / 100,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('ENERGY ANALYTICS',
                style: AppType.dmMono(10,
                    color: AppColors.solarTextSecondary,
                    letterSpacing: 0.11)),
            const SizedBox(height: 5),
            Text('Usage history',
                style: AppType.manrope(25,
                    weight: FontWeight.w800, letterSpacing: -0.045)),
          ],
        ),
        _IconButton(icon: Icons.bar_chart_rounded, onTap: () {}),
      ],
    );
  }
}

class _IconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _IconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.solarCard,
      shape: const CircleBorder(side: BorderSide(color: Color(0xFFE3E8DF))),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 43,
          height: 43,
          child: Icon(icon, size: 20, color: AppColors.solarTextPrimary),
        ),
      ),
    );
  }
}

class _SegmentedControl extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onSelected;

  const _SegmentedControl({required this.selected, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    const options = ['Today', '7 Days', '30 Days'];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFEDF1EB),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: options.map((o) {
          final active = o == selected;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSelected(o),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: active ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: active
                      ? const [
                          BoxShadow(
                            color: Color(0x12344124),
                            blurRadius: 6,
                            offset: Offset(0, 2),
                          )
                        ]
                      : null,
                ),
                child: Text(o,
                    textAlign: TextAlign.center,
                    style: AppType.manrope(11,
                        color: active
                            ? AppColors.solarTextPrimary
                            : AppColors.solarTextSecondary,
                        weight: FontWeight.w700)),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _AnalyticsCard extends StatelessWidget {
  final String range;
  final double total;
  final double trend;
  final List<double> days;
  final double maxV;

  const _AnalyticsCard({
    required this.range,
    required this.total,
    required this.trend,
    required this.days,
    required this.maxV,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(19),
      decoration: BoxDecoration(
        color: AppColors.solarCard,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.solarCardBorder),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A384528),
            blurRadius: 22,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${range.toUpperCase()} CONSUMPTION',
              style: AppType.dmMono(10,
                  color: AppColors.solarTextSecondary,
                  letterSpacing: 0.11)),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text.rich(
                TextSpan(
                  text: total.toStringAsFixed(1),
                  style: AppType.robotoSlab(28,
                      letterSpacing: -0.06),
                  children: [
                    TextSpan(
                        text: '  units',
                        style: AppType.manrope(13,
                            color: AppColors.solarTextSecondary,
                            weight: FontWeight.w600)),
                  ],
                ),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.solarGreenBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                    '${trend <= 0 ? '↓' : '↑'} ${trend.abs().toStringAsFixed(1)}%',
                    style: AppType.dmMono(11,
                        color: AppColors.solarGreen,
                        weight: FontWeight.w500)),
              ),
            ],
          ),
          const SizedBox(height: 23),
          SizedBox(
            height: 185,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(7, (i) {
                final v = days[i];
                final isToday = i == 6;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          width: 22,
                          height: maxV > 0 ? (v / maxV) * 142 : 4,
                          decoration: BoxDecoration(
                            color: isToday
                                ? const Color(0xFF3A9258)
                                : const Color(0xFFD6E4D8),
                            borderRadius: BorderRadius.circular(7),
                          ),
                        ),
                        const SizedBox(height: 7),
                        Text(_SummaryPageState._kDays[i],
                            style: AppType.dmMono(9,
                                color: isToday
                                    ? AppColors.solarGreen
                                    : AppColors.solarTextSecondary)),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConsumptionSplit extends StatelessWidget {
  final double solarPct;
  final double gridPct;
  final double nightPct;
  final double solarUnits;
  final double gridUnits;
  final double nightUnits;

  const _ConsumptionSplit({
    required this.solarPct,
    required this.gridPct,
    required this.nightPct,
    required this.solarUnits,
    required this.gridUnits,
    required this.nightUnits,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Consumption split',
            style: AppType.manrope(15, weight: FontWeight.w700)),
        const SizedBox(height: 13),
        _SplitRow(
          color: const Color(0xFF77BD79),
          label: 'Solar-supported usage',
          pct: solarPct,
          units: solarUnits,
        ),
        const Divider(color: AppColors.solarDivider, height: 1),
        _SplitRow(
          color: AppColors.solarBlueLight,
          label: 'WAPDA consumption',
          pct: gridPct,
          units: gridUnits,
        ),
        const Divider(color: AppColors.solarDivider, height: 1),
        _SplitRow(
          color: const Color(0xFFD8A04A),
          label: 'Night usage',
          pct: nightPct,
          units: nightUnits,
        ),
      ],
    );
  }
}

class _SplitRow extends StatelessWidget {
  final Color color;
  final String label;
  final double pct;
  final double units;

  const _SplitRow({
    required this.color,
    required this.label,
    required this.pct,
    required this.units,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 15),
      child: Row(
        children: [
          Container(
              width: 8,
              height: 8,
              decoration:
                  BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label,
                style: AppType.manrope(12,
                    color: AppColors.solarTextPrimary)),
          ),
          Text('${pct.round()}%',
              style: AppType.dmMono(11,
                  color: AppColors.solarTextPrimary,
                  weight: FontWeight.w700)),
          const SizedBox(width: 10),
          SizedBox(
            width: 52,
            child: Text('${units.toStringAsFixed(1)} units',
                textAlign: TextAlign.right,
                style: AppType.manrope(10,
                    color: AppColors.solarTextMuted,
                    weight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
