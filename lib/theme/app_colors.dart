import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

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

  // ═══════════════════════════════════════════════════════════════════
  // Solar native app tokens (light-first redesign)
  // ═══════════════════════════════════════════════════════════════════

  // ── Light mode ─────────────────────────────────────────────────────
  static const solarBg = Color(0xFFF2F5EF);
  static const solarFrame = Color(0xFFFDFEFB);
  static const solarCard = Color(0xFFFFFFFF);
  static const solarCardBorder = Color(0xFFE7ECE4);
  static const solarDivider = Color(0xFFE8ECE6);

  static const solarTextPrimary = Color(0xFF17221C);
  static const solarTextSecondary = Color(0xFF778079);
  static const solarTextMuted = Color(0xFF858D87);

  static const solarGreen = Color(0xFF277D48);
  static const solarGreenLight = Color(0xFF36AA67);
  static const solarGreenSoft = Color(0xFF368950);
  static const solarGreenPale = Color(0xFFD9F2DF);
  static const solarGreenBg = Color(0xFFE7F5E8);
  static const solarGreenBorder = Color(0xFFD6E8D6);
  static const solarGreenText = Color(0xFF287844);

  static const solarYellow = Color(0xFFB58D1B);
  static const solarYellowBg = Color(0xFFF3EDC5);
  static const solarYellowPale = Color(0xFFFBF1D7);

  static const solarBlue = Color(0xFF4F78B8);
  static const solarBlueLight = Color(0xFF789DD0);
  static const solarBlueBg = Color(0xFFEDF3FF);
  static const solarBluePale = Color(0xFFEBF1FB);

  static const solarAmber = Color(0xFFAD7F22);
  static const solarAmberBg = Color(0xFFFBF0DA);
  static const solarAmberText = Color(0xFFA77720);

  static const solarRed = Color(0xFFE66C4E);
  static const solarPurple = Color(0xFF8B6CF0);

  static const solarRingStart = Color(0xFF2ABA72);
  static const solarRingMid = Color(0xFF7FCB67);
  static const solarRingEnd = Color(0xFFE1C951);

  static const solarDarkGreen = Color(0xFF244A35);
  static const solarDarkGreenMid = Color(0xFF50735D);
  static const solarDarkGreenLight = Color(0xFF9DD98B);
  static const solarDarkGreenText = Color(0xFFB5D7BD);

  // ── Dark mode ──────────────────────────────────────────────────────
  static const solarDarkBg = Color(0xFF152019);
  static const solarDarkFrame = Color(0xFF17221B);
  static const solarDarkCard = Color(0xFF1D2B22);
  static const solarDarkBorder = Color(0xFF304134);
  static const solarDarkDivider = Color(0xFF304034);

  static const solarDarkTextPrimary = Color(0xFFEDF3EA);
  static const solarDarkTextSecondary = Color(0xFFA7B1A9);
  static const solarDarkOverline = Color(0xFF97A49A);

  // Common helpers
  static Color cardShadow(BuildContext context) =>
      Theme.of(context).brightness == Brightness.light
          ? const Color(0x0A384528)
          : Colors.transparent;

  static Color cardBorder(BuildContext context) =>
      Theme.of(context).brightness == Brightness.light
          ? solarCardBorder
          : solarDarkBorder;

  static Color cardBg(BuildContext context) =>
      Theme.of(context).brightness == Brightness.light
          ? solarCard
          : solarDarkCard;

  static Color textPrimaryFor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.light
          ? solarTextPrimary
          : solarDarkTextPrimary;

  static Color textSecondaryFor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.light
          ? solarTextSecondary
          : solarDarkTextSecondary;
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

  // ── Solar native typography (Manrope, DM Mono, Roboto Slab) ──────
  static TextStyle manrope(
    double size, {
    Color? color,
    FontWeight weight = FontWeight.w600,
    double? letterSpacing,
    double? height,
  }) =>
      GoogleFonts.manrope(
        fontSize: size,
        color: color ?? AppColors.solarTextPrimary,
        fontWeight: weight,
        letterSpacing: letterSpacing ?? -0.2,
        height: height,
      );

  static TextStyle dmMono(
    double size, {
    Color? color,
    FontWeight weight = FontWeight.w500,
    double? letterSpacing,
    double? height,
  }) =>
      GoogleFonts.dmMono(
        fontSize: size,
        color: color ?? AppColors.solarTextSecondary,
        fontWeight: weight,
        letterSpacing: letterSpacing ?? 0.11,
        height: height,
      );

  static TextStyle robotoSlab(
    double size, {
    Color? color,
    FontWeight weight = FontWeight.w700,
    double? letterSpacing,
    double? height,
  }) =>
      GoogleFonts.robotoSlab(
        fontSize: size,
        color: color ?? AppColors.solarTextPrimary,
        fontWeight: weight,
        letterSpacing: letterSpacing ?? -0.04,
        height: height,
      );
}
