import 'package:flutter/material.dart';

/// iOS-style dark dashboard tokens. Muted surfaces, one electric-green accent.
class AppColors {
  // ── Base surfaces ────────────────────────────────────────────────
  static const bg = Color(0xFF0B0B0F);        // almost black
  static const surface = Color(0xFF131419);    // card bg
  static const surfaceAlt = Color(0xFF1A1C23); // elevated sections
  static const border = Color(0x1FFFFFFF);     // 12% white
  static const divider = Color(0x1FFFFFFF);    // 12% white

  // ── Text ─────────────────────────────────────────────────────────
  static const textPrimary = Color(0xFFFFFFFF);
  static const textSecondary = Color(0xFF8B8E98);
  static const textMuted = Color(0xFF5A5D65);

  // ── Accents ──────────────────────────────────────────────────────
  static const success = Color(0xFF22C55E);  // green / load / charging
  static const home = success;               // alias for load/home
  static const solar = Color(0xFF22C55E);    // green / solar panel (matches reference)
  static const grid = Color(0xFF38BDF8);     // sky blue / grid / WAPDA
  static const export = Color(0xFF22C55E);   // exporting
  static const warning = Color(0xFFF59E0B);  // amber
  static const danger = Color(0xFFEF4444);   // red
  static const info = Color(0xFF38BDF8);     // info / grid
  static const purple = Color(0xFF8B6CF0);   // forecast / ai

  // Time-of-day aliases
  static const todDay = Color(0xFFF59E0B);
  static const todTransition = Color(0xFF22C55E);
  static const todNight = Color(0xFF60A5FA);

  // ── Soft fills for icon chips ────────────────────────────────────
  static Color successSoft = const Color(0xFF22C55E).withValues(alpha: 0.10);
  static Color homeSoft = successSoft;
  static Color solarSoft = const Color(0xFF22C55E).withValues(alpha: 0.10);
  static Color gridSoft = const Color(0xFF38BDF8).withValues(alpha: 0.10);
  static Color warningSoft = const Color(0xFFF59E0B).withValues(alpha: 0.10);
  static Color dangerSoft = const Color(0xFFEF4444).withValues(alpha: 0.10);
  static Color purpleSoft = const Color(0xFF8B6CF0).withValues(alpha: 0.10);
}

/// Typography: Inter for UI, JetBrains Mono for small labels / numbers.
class AppType {
  static TextStyle inter(
    double size, {
    Color? color,
    FontWeight weight = FontWeight.w600,
    double? letterSpacing,
    double? height,
  }) =>
      TextStyle(
        fontFamily: 'Inter',
        fontSize: size,
        color: color ?? AppColors.textSecondary,
        fontWeight: weight,
        letterSpacing: letterSpacing ?? -0.2,
        height: height,
      );

  static TextStyle mono(
    double size, {
    Color? color,
    FontWeight? weight,
    double? letterSpacing,
    double? height,
  }) =>
      TextStyle(
        fontFamily: 'JetBrainsMono',
        fontSize: size,
        color: color ?? AppColors.textSecondary,
        fontWeight: weight ?? FontWeight.w500,
        letterSpacing: letterSpacing ?? 0.3,
        height: height,
      );
}
