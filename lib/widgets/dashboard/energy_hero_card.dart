import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../solar_panel.dart';

/// Large hero card: Solar Panel title, live kW value, solar panel illustration.
class EnergyHeroCard extends StatelessWidget {
  final double solarKw;
  final bool isGenerating;

  const EnergyHeroCard({
    super.key,
    required this.solarKw,
    required this.isGenerating,
  });

  String get _formatted {
    if (solarKw >= 1) return '${solarKw.toStringAsFixed(2)} kW';
    return '${(solarKw * 1000).round()} W';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 16, 18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x28000000),
            blurRadius: 20,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          // Left: text content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Solar Panel',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  isGenerating
                      ? 'Generating Clean Energy'
                      : 'Low Generation',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 16),
                // Icon chip + label
                Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: const Icon(Icons.bolt_rounded,
                          size: 16, color: AppColors.success),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Live Generation',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          _formatted,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 28,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            letterSpacing: -1.0,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Right: solar panel illustration
          const SolarPanelIllustration(size: 100),
        ],
      ),
    );
  }
}
