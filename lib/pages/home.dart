import 'package:flutter/material.dart';

import '../data/energy_scope.dart';
import '../data/idle_context.dart';
import '../scene/scene.dart';
import '../theme/app_colors.dart';
import '../widgets/dashboard/daily_energy_card.dart';
import '../widgets/dashboard/dashboard_header.dart';
import '../widgets/dashboard/power_metric_card.dart';
import '../widgets/dashboard/power_summary_row.dart';
import '../widgets/hero_energy_scene.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  // ── Helpers ──────────────────────────────────────────────────────
  static String _fmtPower(double w) {
    final abs = w.abs();
    if (abs >= 1000) return '${(abs / 1000).toStringAsFixed(2)} kW';
    return '${abs.round()} W';
  }

  static String _modeLabel(bool offline, double solarW, double gridW,
      bool exporting, bool importing) {
    if (offline) return 'System Offline';
    if (solarW > 20 && (importing || exporting)) return 'Hybrid';
    if (solarW > 20) return 'Solar Only';
    if (importing) return 'Wapda Importing';
    if (exporting) return 'Exporting';
    return 'Standby';
  }

  static Color _modeColor(String mode) => switch (mode) {
        'Hybrid' => AppColors.success,
        'Solar Only' => AppColors.solar,
        'Wapda Importing' => AppColors.info,
        'Exporting' => AppColors.info,
        'System Offline' => AppColors.danger,
        _ => AppColors.warning,
      };

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    final inv = p.inverter;
    final tomzn = p.tomzn;

    final isOnline = inv.isOnline && tomzn.isOnline;
    final solarW = isOnline ? inv.solarW : 0.0;
    final homeW = isOnline ? inv.loadW : 0.0;
    final exporting = !isOnline
        ? false
        : (tomzn.isOnline && tomzn.powerW <= 1 && inv.gridW < -10);
    final gridW = isOnline ? (exporting ? -inv.gridW : tomzn.powerW) : 0.0;
    final importing = gridW > 10;

    final solarKw = solarW / 1000;
    final homeKw = homeW / 1000;
    final gridKw = gridW / 1000;

    // Mini chart: last 12 flow history buckets → solar kW values
    final history = p.flowHistory;
    final chartBuckets =
        history.length > 12 ? history.sublist(history.length - 12) : history;
    final chartValues = chartBuckets.map((pt) => (pt.solarKw ?? 0.0)).toList();

    final mode = _modeLabel(!isOnline, solarW, gridW, exporting, importing);

    return IdleContext(
      rotateScenes: p.overlayEnabled,
      child: Builder(
        builder: (context) {
          final stage = idleStageOf(context);
          final scene = stage == IdleStage.asleep && p.overlayEnabled
              ? idleRotationSceneOf(context)
              : p.scene;

          final sheetGrad = kSceneSheetColors[scene]!;
          final seam = Color.fromARGB(255, sheetGrad.seam.$1.toInt(),
              sheetGrad.seam.$2.toInt(), sheetGrad.seam.$3.toInt());
          final mid = Color.fromARGB(255, sheetGrad.mid.$1.toInt(),
              sheetGrad.mid.$2.toInt(), sheetGrad.mid.$3.toInt());
          final sky = Color.fromARGB(255, sheetGrad.sky.$1.toInt(),
              sheetGrad.sky.$2.toInt(), sheetGrad.sky.$3.toInt());

          return Scaffold(
            backgroundColor: Colors.transparent,
            body: Stack(
              children: [
                // ── 1. Full-screen wallpaper ──────────────────────────
                Positioned.fill(
                  child: Image.asset(
                    wallpaperAssetFor(scene),
                    fit: BoxFit.cover,
                  ),
                ),
                // Dark gradient overlay (matches RN: 0.25 → 0.1 → 0.4)
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: const [0.0, 0.35, 1.0],
                        colors: [
                          Colors.black.withValues(alpha: 0.25),
                          Colors.black.withValues(alpha: 0.10),
                          Colors.black.withValues(alpha: 0.40),
                        ],
                      ),
                    ),
                  ),
                ),
                // ── 2. Hero overlay at top ~50% ───────────────────────
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  height: MediaQuery.of(context).size.height * 0.50,
                  child: Stack(
                    children: [
                      HeroEnergyScene(
                        scene: scene,
                        solarW: solarW,
                        homeW: homeW,
                        gridW: gridW,
                        gridReverse: exporting,
                        showBypass: false,
                        modeLabel: mode,
                        modeColor: _modeColor(mode),
                        systemOffline: !isOnline,
                        idle: stage == IdleStage.asleep,
                        source: p.source,
                      ),
                      // ── Idle overlay: dim + "tap to wake" ────────────
                      if (stage != IdleStage.awake)
                        AnimatedOpacity(
                          opacity: stage == IdleStage.asleep ? 1 : 0,
                          duration: stage == IdleStage.asleep
                              ? const Duration(milliseconds: 500)
                              : const Duration(milliseconds: 200),
                          child: IgnorePointer(
                            child: Container(
                              color: Colors.black.withValues(alpha: 0.45),
                              child: Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 46,
                                      height: 46,
                                      decoration: BoxDecoration(
                                        color: Colors.white
                                            .withValues(alpha: 0.12),
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                            color: Colors.white
                                                .withValues(alpha: 0.35)),
                                      ),
                                      child: const Icon(Icons.wb_sunny_rounded,
                                          color: Colors.white70, size: 22),
                                    ),
                                    const SizedBox(height: 10),
                                    Text('Tap to wake',
                                        style: AppType.inter(13,
                                            color: Colors.white,
                                            weight: FontWeight.w600,
                                            letterSpacing: 0.3)),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                // ── 3. Scrollable sheet with rounded top corners ──────
                Positioned.fill(
                  child: NotificationListener<ScrollNotification>(
                    onNotification: (_) {
                      // Wake idle on scroll
                      return false;
                    },
                    child: SingleChildScrollView(
                      padding: EdgeInsets.only(
                        top: MediaQuery.of(context).size.height * 0.49,
                      ),
                      child: ClipRRect(
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(28),
                          topRight: Radius.circular(28),
                        ),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              stops: const [0.0, 0.12, 0.32, 1.0],
                              colors: [
                                seam.withValues(alpha: 0.55),
                                seam.withValues(alpha: 0.88),
                                mid,
                                sky,
                              ],
                            ),
                          ),
                          child: SafeArea(
                            top: false,
                            bottom: false,
                            child: Padding(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 14, 16, 120),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  // ── Header ──────────────────────────────
                                  DashboardHeader(
                                    isOnline: isOnline,
                                    source: p.source,
                                    lastSync: p.lastSync,
                                  ),
                                  const SizedBox(height: 16),

                                  // ── Scene chips ─────────────────────────
                                  _SceneChips(
                                    selectedScene: p.selectedScene,
                                    onSceneTap: p.setScene,
                                  ),
                                  const SizedBox(height: 16),

                                  // ── Two metric cards ────────────────────
                                  Row(
                                    children: [
                                      Expanded(
                                        child: PowerMetricCard(
                                          icon: Icons.home_rounded,
                                          iconColor: AppColors.success,
                                          title: 'Home Usage',
                                          value: _fmtPower(homeW),
                                          description: 'Current consumption',
                                          scene: scene,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: PowerMetricCard(
                                          icon:
                                              Icons.electrical_services_rounded,
                                          iconColor: AppColors.grid,
                                          title: 'Grid Status',
                                          value: _fmtPower(gridW),
                                          description: importing
                                              ? 'Importing'
                                              : 'No import',
                                          scene: scene,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),

                                  // ── Power summary 3-column row ──────────
                                  PowerSummaryRow(
                                    solarKw: solarKw,
                                    homeKw: homeKw,
                                    gridKw: gridKw,
                                    scene: scene,
                                  ),
                                  const SizedBox(height: 12),

                                  // ── Today's clean energy card ───────────
                                  DailyEnergyCard(
                                    solarKwh: p.energyToday.solarKwh,
                                    chartValues: chartValues,
                                    scene: scene,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Horizontal scene-picker chips (Auto + 6 scenes).
class _SceneChips extends StatelessWidget {
  final HeroSceneId? selectedScene;
  final void Function(HeroSceneId?) onSceneTap;

  const _SceneChips({required this.selectedScene, required this.onSceneTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: HeroSceneId.values.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          if (i == 0) {
            final auto = selectedScene == null;
            return _SceneChip(
              label: 'Auto',
              active: auto,
              onTap: () => onSceneTap(null),
            );
          }
          final scene = HeroSceneId.values[i - 1];
          return _SceneChip(
            label: _sceneLabel(scene),
            active: selectedScene == scene,
            onTap: () => onSceneTap(scene),
          );
        },
      ),
    );
  }

  static String _sceneLabel(HeroSceneId s) => switch (s) {
        HeroSceneId.night => 'Night',
        HeroSceneId.rainLight => 'Rain',
        HeroSceneId.cloudsDark => 'Clouds',
        HeroSceneId.fog => 'Fog',
        HeroSceneId.evening => 'Evening',
        HeroSceneId.morningCloud => 'Morning',
      };
}

class _SceneChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _SceneChip(
      {required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.success : AppColors.textSecondary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: (active ? AppColors.success : AppColors.surfaceAlt)
              .withValues(alpha: active ? 0.16 : 0.6),
          borderRadius: BorderRadius.circular(20),
          border:
              Border.all(color: color.withValues(alpha: active ? 0.7 : 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.circle,
                size: 7, color: color.withValues(alpha: active ? 1 : 0.45)),
            const SizedBox(width: 6),
            Text(label,
                style:
                    AppType.inter(10.5, color: color, weight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
