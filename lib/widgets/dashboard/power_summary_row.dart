import 'package:flutter/material.dart';

import '../../scene/scene.dart';
import '../../theme/app_colors.dart';

/// Full-width card with 3 equal columns: Solar Power / Home Usage / Grid Power.
/// Glassmorphism style matching the Solar native app.
class PowerSummaryRow extends StatelessWidget {
  final double solarKw;
  final double homeKw;
  final double gridKw;
  final HeroSceneId? scene;

  const PowerSummaryRow({
    super.key,
    required this.solarKw,
    required this.homeKw,
    required this.gridKw,
    this.scene,
  });

  String _fmt(double kw) {
    if (kw >= 1) return '${kw.toStringAsFixed(2)} kW';
    return '${(kw * 1000).round()} W';
  }

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
    final overlayBorder = overlayBase.withValues(alpha: 0.06);

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
            IntrinsicHeight(
              child: Row(
                children: [
                  Expanded(
                      child: _SummaryColumn(
                    icon: Icons.wb_sunny_rounded,
                    iconColor: AppColors.solar,
                    label: 'Solar Power',
                    value: _fmt(solarKw),
                    textPrimary: textPrimary,
                    textSecondary: textSecondary,
                  )),
                  _VerticalDivider(color: overlayBorder),
                  Expanded(
                      child: _SummaryColumn(
                    icon: Icons.home_rounded,
                    iconColor: AppColors.success,
                    label: 'Home Usage',
                    value: _fmt(homeKw),
                    textPrimary: textPrimary,
                    textSecondary: textSecondary,
                  )),
                  _VerticalDivider(color: overlayBorder),
                  Expanded(
                      child: _SummaryColumn(
                    icon: Icons.electrical_services_rounded,
                    iconColor: AppColors.grid,
                    label: 'Grid Power',
                    value: _fmt(gridKw),
                    textPrimary: textPrimary,
                    textSecondary: textSecondary,
                  )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryColumn extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final Color textPrimary;
  final Color textSecondary;

  const _SummaryColumn({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.textPrimary,
    required this.textSecondary,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: iconColor),
          const SizedBox(height: 6),
          Text(label,
              style: TextStyle(
                fontFamily: 'Outfit',
                fontSize: 9,
                fontWeight: FontWeight.w500,
                color: textSecondary,
                letterSpacing: 0.1,
              ),
              textAlign: TextAlign.center),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                fontFamily: 'Outfit',
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: textPrimary,
                letterSpacing: -0.4,
              ),
              textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _VerticalDivider extends StatelessWidget {
  final Color color;
  const _VerticalDivider({required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      margin: const EdgeInsets.symmetric(vertical: 12),
      color: color,
    );
  }
}
