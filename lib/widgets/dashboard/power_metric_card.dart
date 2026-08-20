import 'package:flutter/material.dart';

import '../../scene/scene.dart';

/// Half-width metric card (Home Usage / Grid Status etc.) — glassmorphism.
class PowerMetricCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String value;
  final String description;
  final HeroSceneId? scene;

  const PowerMetricCard({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.value,
    required this.description,
    this.scene,
  });

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
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(title,
                          style: TextStyle(
                            fontFamily: 'Outfit',
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: textSecondary,
                            letterSpacing: 0.3,
                          )),
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: iconColor.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(icon, size: 14, color: iconColor),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(value,
                      style: TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: textPrimary,
                        letterSpacing: -0.5,
                        height: 1.1,
                      )),
                  const SizedBox(height: 3),
                  Text(description,
                      style: TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 9,
                        fontWeight: FontWeight.w500,
                        color: textSecondary,
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
