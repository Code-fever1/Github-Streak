import 'package:flutter/material.dart';

import '../../data/energy_provider.dart' show EnergyDataSource;
import '../../theme/app_colors.dart';

/// Top header: "My Home ▾" title + system status + sync source + bell.
class DashboardHeader extends StatefulWidget {
  final bool isOnline;

  /// Where the current data comes from (live API vs offline estimates).
  final EnergyDataSource source;

  /// Wall-clock time of the last backend sync (null when never synced).
  final DateTime? lastSync;

  const DashboardHeader({
    super.key,
    required this.isOnline,
    this.source = EnergyDataSource.loading,
    this.lastSync,
  });

  @override
  State<DashboardHeader> createState() => _DashboardHeaderState();
}

class _DashboardHeaderState extends State<DashboardHeader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = widget.isOnline ? AppColors.success : AppColors.danger;
    final statusLabel = widget.isOnline ? 'System Online' : 'System Offline';

    final (sourceColor, sourceLabel) = switch (widget.source) {
      EnergyDataSource.live => (AppColors.success, 'Live'),
      EnergyDataSource.offline => (AppColors.warning, 'Estimated'),
      EnergyDataSource.loading => (AppColors.textMuted, 'Syncing'),
    };

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Left: title + status
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Text(
                  'My Home',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                SizedBox(width: 6),
                Icon(Icons.keyboard_arrow_down_rounded,
                    color: AppColors.textSecondary, size: 22),
              ],
            ),
            const SizedBox(height: 5),
            Row(
              children: [
                AnimatedBuilder(
                  animation: _pulse,
                  builder: (_, __) => Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: statusColor
                              .withValues(alpha: 0.3 + 0.4 * _pulse.value),
                          blurRadius: 6 + 4 * _pulse.value,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 7),
                Text(
                  statusLabel,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                    letterSpacing: -0.1,
                  ),
                ),
                if (widget.source != EnergyDataSource.loading) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: sourceColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                      border:
                          Border.all(color: sourceColor.withValues(alpha: 0.35)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.sync_rounded,
                            size: 9, color: sourceColor),
                        const SizedBox(width: 3),
                        Text(
                          sourceLabel,
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            color: sourceColor,
                            letterSpacing: 0.3,
                          ),
                        ),
                        if (widget.lastSync != null) ...[
                          const SizedBox(width: 4),
                          Text(
                            _fmtTime(widget.lastSync!),
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 9.5,
                              fontWeight: FontWeight.w500,
                              color: sourceColor.withValues(alpha: 0.75),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
        const Spacer(),
        // Right: notification bell with green badge
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.border),
              ),
              child: const Icon(Icons.notifications_none_rounded,
                  color: AppColors.textSecondary, size: 20),
            ),
            Positioned(
              top: 8,
              right: 9,
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.success,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.bg, width: 1.5),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  static String _fmtTime(DateTime t) {
    final now = DateTime.now();
    final diff = now.difference(t);
    if (diff.inSeconds < 60) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    return '${t.day}/${t.month}';
  }
}
