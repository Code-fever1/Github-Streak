import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'data/energy_provider.dart';
import 'data/energy_scope.dart';
import 'pages/home.dart';
import 'pages/logs.dart';
import 'pages/meters.dart';
import 'pages/settings.dart';
import 'pages/summary.dart';
import 'theme/app_colors.dart';

void main() {
  runApp(const VoltixApp());
}

class VoltixApp extends StatelessWidget {
  const VoltixApp({super.key});

  @override
  Widget build(BuildContext context) {
    final base = ThemeData.dark(useMaterial3: true);
    return MaterialApp(
      title: 'Voltix',
      debugShowCheckedModeBanner: false,
      theme: base.copyWith(
        scaffoldBackgroundColor: AppColors.bg,
        colorScheme: base.colorScheme.copyWith(
          brightness: Brightness.dark,
          primary: AppColors.success,
          secondary: AppColors.solar,
          surface: AppColors.surface,
          onSurface: AppColors.textPrimary,
        ),
        textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
          bodyColor: AppColors.textPrimary,
          displayColor: AppColors.textPrimary,
        ),
      ),
      home: const AppShell(),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final EnergyProvider _provider = EnergyProvider();
  int _index = 0;

  static const _tabs = [
    (Icons.home_rounded, 'Home'),
    (Icons.bolt_rounded, 'Energy'),
    (Icons.insert_chart_rounded, 'Summary'),
    (Icons.receipt_long_rounded, 'Logs'),
    (Icons.settings_rounded, 'Settings'),
  ];

  @override
  void dispose() {
    _provider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return EnergyScope(
      provider: _provider,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: IndexedStack(
          index: _index,
          children: const [
            HomePage(),
            MetersPage(),
            SummaryPage(),
            LogsPage(),
            SettingsPage(),
          ],
        ),
        bottomNavigationBar: SafeArea(
          minimum: const EdgeInsets.fromLTRB(20, 0, 20, 14),
          child: _GlassNavBar(
            index: _index,
            onTap: (i) => setState(() => _index = i),
          ),
        ),
      ),
    );
  }
}

class _GlassNavBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;

  const _GlassNavBar({required this.index, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 62,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.divider),
        boxShadow: const [
          BoxShadow(color: Color(0x4D000000), blurRadius: 18, offset: Offset(0, 8)),
        ],
      ),
      child: LayoutBuilder(builder: (context, constraints) {
        final w = constraints.maxWidth;
        final count = _AppShellState._tabs.length;
        final slot = w / count;
        final pillW = slot - 10;
        return Stack(
          children: [
            AnimatedPositioned(
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              left: 5 + index * slot + (slot - pillW) / 2,
              top: 6, bottom: 6,
              width: pillW,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
            ),
            Row(
              children: List.generate(count, (i) {
                final (icon, label) = _AppShellState._tabs[i];
                final active = i == index;
                final color = active ? AppColors.success : AppColors.textMuted;
                return Expanded(
                  child: InkWell(
                    onTap: () => onTap(i),
                    borderRadius: BorderRadius.circular(18),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(icon, size: 19, color: color),
                        const SizedBox(height: 3),
                        Text(
                          label,
                          style: AppType.inter(9, color: color,
                              weight: active ? FontWeight.w700 : FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ],
        );
      }),
    );
  }
}
