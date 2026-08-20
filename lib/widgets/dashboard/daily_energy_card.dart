import 'dart:math';

import 'package:flutter/material.dart';

import '../../scene/scene.dart';
import '../../theme/app_colors.dart';

/// "Today's Clean Energy" card with kWh, CO₂ saved, and a mini bar chart.
/// Glassmorphism style matching the Solar native app.
class DailyEnergyCard extends StatelessWidget {
  final double solarKwh;
  final List<double> chartValues;
  final HeroSceneId? scene;

  const DailyEnergyCard({
    super.key,
    required this.solarKwh,
    required this.chartValues,
    this.scene,
  });

  double get _co2Saved => solarKwh * 0.92;

  @override
  Widget build(BuildContext context) {
    final g = scene != null ? kSceneSheetColors[scene!] : null;
    final seam = g != null
        ? Color.fromARGB(
            255, g.seam.$1.toInt(), g.seam.$2.toInt(), g.seam.$3.toInt())
        : const Color(0xFF1A1C23);
    final lum = (seam.r * 0.299 + seam.g * 0.587 + seam.b * 0.114);
    final isLight = lum > 0.4;
    final overlayBase = isLight ? Colors.black : Colors.white;
    final textPrimary =
        isLight ? const Color(0xFF1A2332) : const Color(0xFFF8FAFC);
    final textSecondary =
        isLight ? const Color(0xFF475569) : const Color(0xFFCBD5E1);

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: overlayBase.withValues(alpha: 0.08)),
        boxShadow: const [
          BoxShadow(
              color: Color(0x59000000), blurRadius: 10, offset: Offset(0, 3)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Stack(
          children: [
            Positioned.fill(
                child: ColoredBox(color: seam.withValues(alpha: 0.18))),
            Positioned.fill(
                child: ColoredBox(color: overlayBase.withValues(alpha: 0.05))),
            Positioned(
              top: 0,
              left: 8,
              right: 8,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  border: Border(
                      top: BorderSide(
                          width: 1,
                          color: overlayBase.withValues(alpha: 0.12))),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.eco_rounded,
                        size: 20, color: AppColors.success),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Today's Clean Energy",
                            style: TextStyle(
                              fontFamily: 'Outfit',
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: textSecondary,
                              letterSpacing: 0.1,
                            )),
                        const SizedBox(height: 2),
                        Text('${solarKwh.toStringAsFixed(1)} kWh',
                            style: TextStyle(
                              fontFamily: 'Outfit',
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: textPrimary,
                              letterSpacing: -0.6,
                              height: 1.15,
                            )),
                        const SizedBox(height: 2),
                        Text('CO₂ Saved ${_co2Saved.toStringAsFixed(1)} kg',
                            style: TextStyle(
                              fontFamily: 'Outfit',
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: textSecondary,
                            )),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 72,
                    height: 42,
                    child: _MiniBarChart(values: chartValues),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniBarChart extends StatelessWidget {
  final List<double> values;
  const _MiniBarChart({required this.values});

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) return const SizedBox.shrink();
    final maxVal = values.reduce(max);
    if (maxVal == 0) return const SizedBox.shrink();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: values.map((v) {
        final frac = (v / maxVal).clamp(0.05, 1.0);
        final isLast = v == values.last;
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1.5),
            child: Container(
              height: 42 * frac,
              decoration: BoxDecoration(
                color: isLast
                    ? AppColors.success
                    : AppColors.success.withValues(alpha: 0.35 + 0.3 * frac),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
