import 'dart:math';

import 'package:flutter/material.dart';

import '../data/energy_scope.dart';
import '../models/energy.dart';
import '../theme/app_colors.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  static const _kCardShadow = BoxShadow(
    color: Color(0x0A384528),
    blurRadius: 22,
    offset: Offset(0, 10),
  );

  static const _kFallbackUsage = <double>[
    0.16, 0.12, 0.1, 0.13, 0.21, 0.37, 0.64, 0.91, 0.78, 0.61, 0.57, 0.66,
    0.73, 0.68, 0.55, 0.48, 0.52, 0.77, 0.97, 0.83, 0.61, 0.46, 0.31, 0.21,
  ];

  static List<_BarValue> _buildBarData(List<FlowPoint> history) {
    if (history.isEmpty) {
      return List.generate(
        24,
        (i) => _BarValue(value: _kFallbackUsage[i], hour: i),
      );
    }

    final n = history.length;
    return List.generate(24, (i) {
      final idx = n - 24 + i;
      if (idx < 0) return _BarValue(value: 0, hour: i);
      final pt = history[idx];
      final hour = DateTime.fromMillisecondsSinceEpoch(pt.timestamp * 1000).hour;
      return _BarValue(
        value: pt.loadKw ?? 0,
        hour: hour,
        solarKw: pt.solarKw ?? 0,
      );
    });
  }

  static String _dateOverline(DateTime now) {
    final weekday = _weekdayName(now.weekday).toUpperCase();
    final month = _monthShort(now.month).toUpperCase();
    return '$weekday, ${now.day} $month';
  }

  static String _greeting(DateTime now) {
    final hour = now.hour;
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  static String _monthShort(int month) {
    const names = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return names[month - 1];
  }

  static String _weekdayName(int weekday) {
    const names = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
      'Sunday',
    ];
    return names[weekday - 1];
  }

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    final now = DateTime.now();
    final activeMeter = p.meter(p.activeMeter);

    final isOnline = p.inverter.isOnline && p.tomzn.isOnline;
    final solarKw = isOnline ? p.inverter.solarW / 1000 : 0.0;
    final gridKw = isOnline ? p.tomzn.powerW / 1000 : 0.0;
    final currentPowerKw = solarKw + gridKw;

    final totalRemaining = p.meters.fold<double>(
      0,
      (sum, m) => sum + m.remainingUnits,
    );
    final totalTarget = p.meters.fold<double>(
      0,
      (sum, m) => sum + m.targetUnits,
    );
    final ringScore = totalTarget > 0
        ? (totalRemaining / totalTarget).clamp(0.0, 1.0)
        : 0.71;

    final healthScore = p.home.outerRingScore?.round().clamp(0, 100) ?? 82;
    final usageChange = p.home.usageChangePercent ?? -7.0;
    final usageChangeText =
        'Usage is ${usageChange.abs().ceil()}% ${usageChange < 0 ? 'below' : 'above'} your weekly average';

    final last24h = p.home.todayUsage;
    final dayUsage = last24h * (p.home.periodDay ?? 35) / 100;
    final nightUsage = last24h * (p.home.periodNight ?? 35) / 100;

    final dailyAvg = activeMeter.averageDaily > 0
        ? activeMeter.averageDaily
        : p.home.averageDaily / max(1, p.meters.length);
    final daysLeft = activeMeter.averageDaily > 0
        ? (activeMeter.remainingUnits / activeMeter.averageDaily).round()
        : (p.home.combinedDaysLeft ?? 25).round();
    final targetDate = now.add(Duration(days: daysLeft));

    final barData = _buildBarData(p.flowHistory);

    return Scaffold(
      backgroundColor: AppColors.solarBg,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 28, 22, 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _TopBar(now: now),
              const SizedBox(height: 18),
              _Hero(
                ringValue: totalRemaining,
                ringTarget: totalTarget,
                ringScore: ringScore,
              ),
              const SizedBox(height: 3),
              _HealthStrip(
                score: healthScore,
                subtext: usageChangeText,
              ),
              const SizedBox(height: 14),
              _FlowCard(
                currentPowerKw: currentPowerKw,
                solarKw: solarKw,
                gridKw: gridKw,
              ),
              _SectionHeader(value: last24h),
              _UsageCard(
                dayUsage: dayUsage,
                nightUsage: nightUsage,
                last24h: last24h,
                barData: barData,
              ),
              _MiniGrid(
                dailyAvg: dailyAvg,
                daysLeft: daysLeft,
                targetDate: targetDate,
                usageChange: usageChange,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BarValue {
  final double value;
  final double? solarKw;
  final int hour;
  const _BarValue({required this.value, this.solarKw, required this.hour});
}

class _TopBar extends StatelessWidget {
  final DateTime now;
  const _TopBar({required this.now});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              HomePage._dateOverline(now),
              style: AppType.dmMono(10,
                  color: AppColors.solarTextSecondary, letterSpacing: 0.11),
            ),
            const SizedBox(height: 5),
            Text.rich(
              TextSpan(
                text: '${HomePage._greeting(now)}, Syed ',
                style: AppType.manrope(25,
                    weight: FontWeight.w800, letterSpacing: -0.045),
                children: const [
                  TextSpan(text: '👋', style: TextStyle(fontSize: 20)),
                ],
              ),
            ),
          ],
        ),
        _BellButton(onTap: () {}),
      ],
    );
  }
}

class _BellButton extends StatelessWidget {
  final VoidCallback onTap;
  const _BellButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.solarCard,
      shape: const CircleBorder(side: BorderSide(color: Color(0xFFE3E8DF))),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: const SizedBox(
          width: 43,
          height: 43,
          child: Icon(Icons.notifications_none_rounded,
              size: 20, color: AppColors.solarTextPrimary),
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  final double ringValue;
  final double ringTarget;
  final double ringScore;
  const _Hero({
    required this.ringValue,
    required this.ringTarget,
    required this.ringScore,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final narrow = constraints.maxWidth < 380;
        final ringSize = narrow ? 190.0 : 220.0;
        final copyWidth = narrow ? 130.0 : 150.0;

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            SizedBox(
              width: copyWidth,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _LiveDot(label: 'Healthy consumption'),
                  const SizedBox(height: 15),
                  Text.rich(
                    TextSpan(
                      text: 'Your home is\n',
                      style: AppType.robotoSlab(29,
                          height: 1.13, letterSpacing: -0.05),
                      children: [
                        TextSpan(
                          text: 'well balanced.',
                          style: AppType.robotoSlab(29,
                              color: AppColors.solarGreenSoft,
                              height: 1.13,
                              letterSpacing: -0.05),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 9),
                  SizedBox(
                    width: 145,
                    child: Text(
                      "You're on track to stay below this month's target.",
                      style: AppType.manrope(11,
                          color: AppColors.solarTextSecondary, height: 1.6),
                    ),
                  ),
                ],
              ),
            ),
            _EnergyRing(
              size: ringSize,
              value: ringValue,
              target: ringTarget,
              score: ringScore,
            ),
          ],
        );
      },
    );
  }
}

class _LiveDot extends StatelessWidget {
  final String label;
  const _LiveDot({required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: const BoxDecoration(
            color: AppColors.solarGreenLight,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AppColors.solarGreenPale,
                blurRadius: 0,
                spreadRadius: 4,
              ),
            ],
          ),
        ),
        const SizedBox(width: 7),
        Text(
          label,
          style: AppType.manrope(11,
              color: AppColors.solarGreenSoft, weight: FontWeight.w700),
        ),
      ],
    );
  }
}

class _EnergyRing extends StatelessWidget {
  final double size;
  final double value;
  final double target;
  final double score;

  const _EnergyRing({
    required this.size,
    required this.value,
    required this.target,
    required this.score,
  });

  @override
  Widget build(BuildContext context) {
    final targetText = target > 0 ? '${target.round()} unit monthly target' : 'monthly target';

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Transform.rotate(
            angle: -pi / 2,
            child: CustomPaint(
              size: Size(size, size),
              painter: _RingPainter(score: score),
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('REMAINING UNITS',
                  style: AppType.dmMono(8,
                      color: AppColors.solarTextSecondary, letterSpacing: 0.08)),
              const SizedBox(height: 4),
              Text(value.round().toString(),
                  style: AppType.robotoSlab(35,
                      letterSpacing: -0.07, height: 1.1)),
              Text('units',
                  style: AppType.manrope(11,
                      color: AppColors.solarTextSecondary)),
              const SizedBox(height: 15),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 5,
                    height: 5,
                    decoration: const BoxDecoration(
                      color: AppColors.solarRingEnd,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(targetText,
                      style: AppType.manrope(9,
                          color: AppColors.solarTextMuted)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double score;
  _RingPainter({required this.score});

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2 - 11;
    final rect = Rect.fromCircle(
      center: Offset(size.width / 2, size.height / 2),
      radius: r,
    );

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 11
      ..color = const Color(0xFFE8EEE5);
    canvas.drawArc(rect, 0, 2 * pi, false, track);

    final gradient = SweepGradient(
      colors: const [
        AppColors.solarRingStart,
        AppColors.solarRingMid,
        AppColors.solarRingEnd,
      ],
      stops: const [0.0, 0.56, 1.0],
      startAngle: 0,
      endAngle: 2 * pi * score,
    );

    final value = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 11
      ..strokeCap = StrokeCap.round
      ..shader = gradient.createShader(rect)
      ..color = AppColors.solarRingStart;

    canvas.drawArc(rect, 0, 2 * pi * score, false, value);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.score != score;
}

class _HealthStrip extends StatelessWidget {
  final int score;
  final String subtext;
  const _HealthStrip({required this.score, required this.subtext});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: AppColors.solarGreenBg,
        border: Border.all(color: AppColors.solarGreenBorder),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Text.rich(
            TextSpan(
              text: '$score ',
              style: AppType.robotoSlab(20,
                  color: AppColors.solarGreenText, letterSpacing: -0.05),
              children: [
                TextSpan(
                    text: '/ 100',
                    style: AppType.dmMono(9,
                        color: const Color(0xFF4C9563),
                        weight: FontWeight.w400)),
              ],
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Good Energy Usage',
                    style: AppType.manrope(11,
                        color: AppColors.solarTextPrimary,
                        weight: FontWeight.w700)),
                Text(subtext,
                    style: AppType.manrope(9,
                        color: const Color(0xFF66816C))),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.chevron_right, size: 15, color: AppColors.solarGreen),
            label: Text('View outlook',
                style: AppType.manrope(9,
                    color: AppColors.solarGreen, weight: FontWeight.w700)),
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ],
      ),
    );
  }
}

class _FlowCard extends StatelessWidget {
  final double currentPowerKw;
  final double solarKw;
  final double gridKw;

  const _FlowCard({
    required this.currentPowerKw,
    required this.solarKw,
    required this.gridKw,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.solarCard,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.solarCardBorder),
        boxShadow: const [HomePage._kCardShadow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('CURRENT POWER',
                      style: AppType.dmMono(10,
                          color: AppColors.solarTextSecondary,
                          letterSpacing: 0.11)),
                  const SizedBox(height: 5),
                  Text.rich(
                    TextSpan(
                      text: currentPowerKw.toStringAsFixed(2),
                      style: AppType.robotoSlab(29, letterSpacing: -0.06),
                      children: [
                        TextSpan(
                            text: '  kW',
                            style: AppType.manrope(13,
                                color: AppColors.solarTextSecondary,
                                weight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: AppColors.solarGreenLight,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                            color: AppColors.solarGreenPale,
                            blurRadius: 0,
                            spreadRadius: 3),
                      ],
                    ),
                  ),
                  const SizedBox(width: 7),
                  Text('Live',
                      style: AppType.dmMono(10,
                          color: AppColors.solarGreen, weight: FontWeight.w500)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 22),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _FlowSource(
                icon: Icons.wb_sunny_rounded,
                value: '${solarKw.toStringAsFixed(2)} kW',
                label: 'Solar',
                iconBg: AppColors.solarYellowBg,
                iconColor: AppColors.solarYellow,
              ),
              const _FlowArrow(color: AppColors.solarGreenSoft),
              _HomeNode(),
              const _FlowArrow(color: AppColors.solarBlueLight),
              _FlowSource(
                icon: Icons.bolt_rounded,
                value: '${gridKw.toStringAsFixed(2)} kW',
                label: 'WAPDA',
                iconBg: AppColors.solarBlueBg,
                iconColor: AppColors.solarBlue,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FlowSource extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color iconBg;
  final Color iconColor;

  const _FlowSource({
    required this.icon,
    required this.value,
    required this.label,
    required this.iconBg,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: iconBg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 17, color: iconColor),
        ),
        const SizedBox(height: 5),
        Text(value,
            style: AppType.manrope(10,
                color: AppColors.solarTextPrimary, weight: FontWeight.w700)),
        Text(label,
            style: AppType.manrope(9, color: AppColors.solarTextSecondary)),
      ],
    );
  }
}

class _FlowArrow extends StatelessWidget {
  final Color color;
  const _FlowArrow({required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 12, height: 1, color: color.withValues(alpha: 0.5)),
        Icon(Icons.arrow_forward, size: 12, color: color),
        Container(width: 12, height: 1, color: color.withValues(alpha: 0.5)),
      ],
    );
  }
}

class _HomeNode extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: const Color(0xFF254A35),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(Icons.home_rounded,
              size: 22, color: Colors.white),
        ),
        const SizedBox(height: 4),
        Text('Home',
            style: AppType.manrope(10,
                color: AppColors.solarTextPrimary, weight: FontWeight.w700)),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final double value;
  const _SectionHeader({required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 27, 2, 13),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('TODAY\'S USAGE',
                  style: AppType.dmMono(10,
                      color: AppColors.solarTextSecondary,
                      letterSpacing: 0.11)),
              const SizedBox(height: 4),
              Text.rich(
                TextSpan(
                  text: value.toStringAsFixed(1),
                  style: AppType.robotoSlab(28, letterSpacing: -0.06),
                  children: [
                    TextSpan(
                        text: '  units',
                        style: AppType.manrope(13,
                            color: AppColors.solarTextSecondary,
                            weight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ),
          const Spacer(),
          TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.chevron_right,
                size: 15, color: AppColors.solarGreen),
            label: Text('View details',
                style: AppType.manrope(10,
                    color: AppColors.solarGreen, weight: FontWeight.w700)),
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ],
      ),
    );
  }
}

class _UsageCard extends StatelessWidget {
  final double dayUsage;
  final double nightUsage;
  final double last24h;
  final List<_BarValue> barData;

  const _UsageCard({
    required this.dayUsage,
    required this.nightUsage,
    required this.last24h,
    required this.barData,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
      decoration: BoxDecoration(
        color: AppColors.solarCard,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.solarCardBorder),
        boxShadow: const [HomePage._kCardShadow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _UsageStat(label: 'Day', value: dayUsage),
              _UsageStatDivider(),
              _UsageStat(label: 'Night', value: nightUsage),
              _UsageStatDivider(),
              _UsageStat(label: 'Last 24h', value: last24h),
            ],
          ),
          const SizedBox(height: 17),
          SizedBox(
            height: 90,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(24, (i) {
                final v = barData[i].value;
                final solar = barData[i].solarKw ?? 0;
                final color = solar > 0.3
                    ? const Color(0xFF77BD79)
                    : i > 16 && i < 21
                        ? const Color(0xFFD8A04A)
                        : const Color(0xFFB9CEC0);
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Container(
                      height: max(4, v * 90),
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 7),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('12am',
                  style: TextStyle(
                      fontFamily: 'DM Mono', fontSize: 8, color: AppColors.solarTextMuted)),
              Text('6am',
                  style: TextStyle(
                      fontFamily: 'DM Mono', fontSize: 8, color: AppColors.solarTextMuted)),
              Text('12pm',
                  style: TextStyle(
                      fontFamily: 'DM Mono', fontSize: 8, color: AppColors.solarTextMuted)),
              Text('6pm',
                  style: TextStyle(
                      fontFamily: 'DM Mono', fontSize: 8, color: AppColors.solarTextMuted)),
              Text('Now',
                  style: TextStyle(
                      fontFamily: 'DM Mono', fontSize: 8, color: AppColors.solarTextMuted)),
            ],
          ),
        ],
      ),
    );
  }
}

class _UsageStat extends StatelessWidget {
  final String label;
  final double value;
  const _UsageStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(label,
              style: AppType.manrope(10,
                  color: AppColors.solarTextSecondary)),
          const SizedBox(height: 3),
          Text.rich(
            TextSpan(
              text: value.toStringAsFixed(1),
              style: AppType.manrope(13,
                  color: AppColors.solarTextPrimary,
                  weight: FontWeight.w700),
              children: [
                TextSpan(
                    text: ' units',
                    style: AppType.manrope(8,
                        color: AppColors.solarTextMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _UsageStatDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 35,
      color: const Color(0xFFEDF0EC),
    );
  }
}

class _MiniGrid extends StatelessWidget {
  final double dailyAvg;
  final int daysLeft;
  final DateTime targetDate;
  final double usageChange;

  const _MiniGrid({
    required this.dailyAvg,
    required this.daysLeft,
    required this.targetDate,
    required this.usageChange,
  });

  @override
  Widget build(BuildContext context) {
    final month = HomePage._monthShort(targetDate.month);
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Row(
        children: [
          Expanded(
            child: _MiniCard(
              icon: Icons.bar_chart_rounded,
              iconBg: const Color(0xFFE4F3E6),
              iconColor: AppColors.solarGreen,
              eyebrow: 'DAILY AVG.',
              value: dailyAvg.toStringAsFixed(1),
              sub: '${usageChange <= 0 ? '↓' : '↑'} ${usageChange.abs().round()}% from last week',
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _MiniCard(
              icon: Icons.bolt_rounded,
              iconBg: const Color(0xFFFBF1D7),
              iconColor: AppColors.solarAmber,
              eyebrow: '200 UNIT DATE',
              value: '${targetDate.day}',
              sub: '$month · $daysLeft days remaining',
              suffix: ' $month',
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniCard extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String eyebrow;
  final String value;
  final String? suffix;
  final String sub;

  const _MiniCard({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.eyebrow,
    required this.value,
    this.suffix,
    required this.sub,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.solarCard,
        borderRadius: BorderRadius.circular(17),
        border: Border.all(color: AppColors.solarCardBorder),
        boxShadow: const [HomePage._kCardShadow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 15, color: iconColor),
          ),
          const SizedBox(height: 11),
          Text(eyebrow,
              style: AppType.dmMono(10,
                  color: AppColors.solarTextSecondary, letterSpacing: 0.08)),
          const SizedBox(height: 4),
          Text.rich(
            TextSpan(
              text: value,
              style: AppType.robotoSlab(20, letterSpacing: -0.05),
              children: suffix != null
                  ? [
                      TextSpan(
                          text: suffix,
                          style: AppType.manrope(10,
                              color: AppColors.solarTextSecondary,
                              weight: FontWeight.w500)),
                    ]
                  : null,
            ),
          ),
          const SizedBox(height: 5),
          Text(sub,
              style: AppType.manrope(9,
                  color: const Color(0xFF668371))),
        ],
      ),
    );
  }
}
