import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Clean elevated card — subtle fill, hairline border, soft shadow.
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color? color;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.radius = 20,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? AppColors.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(color: Color(0x33000000), blurRadius: 18, offset: Offset(0, 8)),
        ],
      ),
      child: child,
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

  const SectionHeader({super.key, required this.icon, required this.color, required this.title, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 22, 4, 10),
      child: Row(
        children: [
          Container(
            width: 26, height: 26,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 14, color: color),
          ),
          const SizedBox(width: 9),
          Text(
            title.toUpperCase(),
            style: AppType.inter(10.5, color: AppColors.textSecondary, letterSpacing: 1.2),
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

  const StatusPill({super.key, required this.color, required this.label, this.filled = false});

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
          Container(width: 5, height: 5, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontFamily: 'Inter', fontSize: 9.5,
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
