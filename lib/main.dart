import 'dart:ui';

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

class VoltixApp extends StatefulWidget {
  const VoltixApp({super.key});

  @override
  State<VoltixApp> createState() => _VoltixAppState();
}

class _VoltixAppState extends State<VoltixApp> {
  @override
  Widget build(BuildContext context) {
    final base = ThemeData.light(useMaterial3: true);
    return MaterialApp(
      title: 'Voltix',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.light,
      theme: base.copyWith(
        scaffoldBackgroundColor: AppColors.solarBg,
        colorScheme: base.colorScheme.copyWith(
          brightness: Brightness.light,
          primary: AppColors.solarGreen,
          secondary: AppColors.solarYellow,
          surface: AppColors.solarCard,
          onSurface: AppColors.solarTextPrimary,
        ),
        textTheme: GoogleFonts.manropeTextTheme(base.textTheme).apply(
          bodyColor: AppColors.solarTextPrimary,
          displayColor: AppColors.solarTextPrimary,
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
    (Icons.show_chart_rounded, 'Usage'),
    (Icons.electric_meter_rounded, 'Meters'),
    (Icons.auto_awesome_rounded, 'Insights'),
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
        backgroundColor: AppColors.solarBg,
        body: IndexedStack(
          index: _index,
          children: const [
            HomePage(),
            SummaryPage(),
            MetersPage(),
            LogsPage(),
            SettingsPage(),
          ],
        ),
        bottomNavigationBar: _SolarNavBar(
          index: _index,
          onTap: (i) => setState(() => _index = i),
        ),
      ),
    );
  }
}

class _SolarNavBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;

  const _SolarNavBar({required this.index, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
          child: Container(
            height: 79,
            decoration: const BoxDecoration(
              color: Color(0xF2FFFFFF),
              border: Border(
                  top: BorderSide(color: AppColors.solarCardBorder)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(_AppShellState._tabs.length, (i) {
                final (icon, label) = _AppShellState._tabs[i];
                final active = i == index;
                final color = active
                    ? AppColors.solarGreen
                    : const Color(0xFF8D968E);
                return Expanded(
                  child: InkWell(
                    onTap: () => onTap(i),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(icon, size: 20, color: color),
                        const SizedBox(height: 5),
                        Text(
                          label,
                          style: AppType.manrope(9,
                              color: color, weight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}
