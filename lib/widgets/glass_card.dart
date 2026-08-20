import 'package:flutter/material.dart';

import '../scene/scene.dart';
import '../theme/app_colors.dart';

/// GlassCard — glassmorphism container, port of the RN GlassCard.
///
/// Layers (bottom to top):
///   1. Scene-tinted wash — seam color at low opacity, ties glass to wallpaper
///   2. White wash — subtle brightness that makes the glass readable
///   3. Top inner glow — light catching the top edge
///   4. Border rim — subtle white outline
///
/// Pass the active [scene] so the card inherits the wallpaper's hue. When
/// [scene] is null a neutral dark glass is used.
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final HeroSceneId? scene;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.radius = 14,
    this.scene,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final g = scene != null ? kSceneSheetColors[scene!] : null;
    final seam = g != null
        ? Color.fromARGB(
            255, g.seam.$1.toInt(), g.seam.$2.toInt(), g.seam.$3.toInt())
        : const Color(0xFF1A1C23);

    // Luminance check — light scenes (fog, morning-cloud) use dark overlays
    final lum = (seam.r * 0.299 + seam.g * 0.587 + seam.b * 0.114);
    final isLight = lum > 0.4;
    final overlayBase = isLight ? Colors.black : Colors.white;

    final card = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: overlayBase.withValues(alpha: 0.08)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x59000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Stack(
          children: [
            // 1. Scene-tinted wash (seam at ~18% opacity)
            Positioned.fill(
              child: ColoredBox(color: seam.withValues(alpha: 0.18)),
            ),
            // 2. White/black wash (subtle brightness/darkness)
            Positioned.fill(
              child: ColoredBox(color: overlayBase.withValues(alpha: 0.05)),
            ),
            // 3. Top inner glow — light catching the top edge
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
                      color: overlayBase.withValues(alpha: 0.12),
                    ),
                  ),
                ),
              ),
            ),
            // 4. Content
            Padding(padding: padding, child: child),
          ],
        ),
      ),
    );
    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}

/// Section header row: icon chip + title + optional trailing widget.
class SectionHeader extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final Widget? trailing;

  const SectionHeader(
      {super.key,
      required this.icon,
      required this.color,
      required this.title,
      this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 22, 4, 10),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 14, color: color),
          ),
          const SizedBox(width: 9),
          Text(
            title.toUpperCase(),
            style: AppType.inter(10.5,
                color: AppColors.textSecondary, letterSpacing: 1.2),
          ),
          const Spacer(),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Status dot + label pill.
class StatusPill extends StatelessWidget {
  final Color color;
  final String label;
  final bool filled;

  const StatusPill(
      {super.key,
      required this.color,
      required this.label,
      this.filled = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: filled ? color : color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              color: filled ? Colors.black : color,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
