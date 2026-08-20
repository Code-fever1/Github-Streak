import 'dart:math';

import 'package:flutter/material.dart';

import '../data/energy_scope.dart';
import '../theme/app_colors.dart';
import '../widgets/glass_card.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _m1Controller = TextEditingController();
  final _m2Controller = TextEditingController();
  final _lastMonthController = TextEditingController();
  bool _editingBaselines = false;
  bool _saved = false;

  @override
  void dispose() {
    _m1Controller.dispose();
    _m2Controller.dispose();
    _lastMonthController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    final m1 = p.meter('meter1');
    final m2 = p.meter('meter2');
    final active = p.activeMeter == 'meter1' ? m1 : m2;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('VOLTIX', style: AppType.mono(9.5, color: AppColors.textSecondary, letterSpacing: 1.6)),
                const SizedBox(height: 5),
                Text('Settings', style: const TextStyle(fontFamily: 'Outfit', fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.6)),
                const SizedBox(height: 3),
                Text('Changeover control, baselines & manual calibration', style: AppType.inter(10.5, color: AppColors.textSecondary)),
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.border),
              ),
              child: Text('v1.0.0', style: AppType.mono(9, color: AppColors.textMuted)),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // ── Changeover control ──────────────────────────────────
        SectionHeader(icon: Icons.swap_horiz_rounded, color: AppColors.home, title: 'Changeover Control'),
        GlassCard(
          child: Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: AppColors.homeSoft, borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.swap_horiz_rounded, size: 19, color: AppColors.home),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Active Source', style: AppType.mono(7.5, color: AppColors.textMuted, letterSpacing: 0.9)),
                    const SizedBox(height: 2),
                    Text(active.label, style: AppType.inter(11.5, color: AppColors.home, weight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text('Currently Active', style: AppType.inter(8.5, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              TextButton.icon(
                onPressed: p.changeover,
                icon: const Icon(Icons.swap_horiz_rounded, size: 14),
                label: const Text('Swap Source'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.home,
                  textStyle: AppType.inter(9.5, weight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),

        // ── Billing cycle baselines ─────────────────────────────
        SectionHeader(icon: Icons.calendar_today_rounded, color: AppColors.info, title: 'Billing Cycle Baselines'),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(color: AppColors.gridSoft, borderRadius: BorderRadius.circular(10)),
                    child: const Center(
                      child: Text('28', style: TextStyle(fontFamily: 'Outfit', fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.info)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Meter readings on the 28th', style: AppType.inter(11, color: AppColors.textPrimary, weight: FontWeight.w700)),
                        const SizedBox(height: 1),
                        Text('Physical readings from your bill that anchor the current monthly cycle.',
                            style: AppType.inter(8.5, color: AppColors.textMuted, height: 1.4)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text('Billing cycle starts on the 28th of every month',
                  style: AppType.inter(9, color: AppColors.info, weight: FontWeight.w600)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _Input(label: 'Meter 1 (Analog)', controller: _m1Controller, initial: '${m1.reading}', enabled: _editingBaselines)),
                  const SizedBox(width: 10),
                  Expanded(child: _Input(label: 'Meter 2 (Digital)', controller: _m2Controller, initial: '${m2.reading}', enabled: _editingBaselines)),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: _editingBaselines
                    ? FilledButton.icon(
                        onPressed: () => setState(() { _editingBaselines = false; _saved = true; }),
                        icon: const Icon(Icons.save_rounded, size: 14),
                        label: const Text('Save 28th baselines'),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.info,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          textStyle: AppType.inter(10, weight: FontWeight.w700),
                        ),
                      )
                    : OutlinedButton.icon(
                        onPressed: () => setState(() => _editingBaselines = true),
                        icon: const Icon(Icons.edit_rounded, size: 13),
                        label: const Text('Edit baselines'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.info,
                          side: const BorderSide(color: AppColors.info),
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          textStyle: AppType.inter(10, weight: FontWeight.w700),
                        ),
                      ),
              ),
            ],
          ),
        ),

        // ── Manual meter readings ───────────────────────────────
        SectionHeader(icon: Icons.edit_note_rounded, color: AppColors.purple, title: 'Manual Meter Readings'),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.edit_note_rounded, size: 14, color: AppColors.purple),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Log current readings', style: AppType.inter(11, color: AppColors.textPrimary, weight: FontWeight.w700)),
                        const SizedBox(height: 1),
                        Text('Enter the latest physical readings from both meters.',
                            style: AppType.inter(8.5, color: AppColors.textMuted, height: 1.4)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _ReadingInput(label: 'Meter 1 (Analog)', controller: _m1Controller, lastLogged: m1.lastLoggedReading, lastTs: m1.lastLoggedAt),
              const SizedBox(height: 10),
              _ReadingInput(label: 'Meter 2 (Digital)', controller: _m2Controller, lastLogged: m2.lastLoggedReading, lastTs: m2.lastLoggedAt),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () {
                    final v1 = double.tryParse(_m1Controller.text.trim());
                    if (v1 != null && v1 > 0) p.logReading('meter1', v1);
                    final v2 = double.tryParse(_m2Controller.text.trim());
                    if (v2 != null && v2 > 0) p.logReading('meter2', v2);
                    setState(() => _saved = true);
                  },
                  icon: const Icon(Icons.save_rounded, size: 14),
                  label: const Text('Log readings'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.purple,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    textStyle: AppType.inter(10, weight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),

        // ── Last month total ────────────────────────────────────
        SectionHeader(icon: Icons.bar_chart_rounded, color: AppColors.home, title: 'Last Month Total'),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.bar_chart_rounded, size: 14, color: AppColors.home),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Units used last billing cycle', style: AppType.inter(11, color: AppColors.textPrimary, weight: FontWeight.w700)),
                        const SizedBox(height: 1),
                        Text('Manually set the total units used last month for trend comparison. Overrides auto-calculated value.',
                            style: AppType.inter(8.5, color: AppColors.textMuted, height: 1.4)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _Input(label: 'Total units', controller: _lastMonthController,
                  initial: p.home.lastMonthTotal?.toStringAsFixed(0) ?? ''),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () {
                    final v = double.tryParse(_lastMonthController.text.trim());
                    if (v != null && v > 0) p.setLastMonthTotal(v);
                    setState(() => _saved = true);
                  },
                  icon: const Icon(Icons.save_rounded, size: 14),
                  label: const Text('Save last month total'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.home,
                    foregroundColor: const Color(0xFF08120C),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    textStyle: AppType.inter(10, weight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 14),
              Row(
                children: [
                  Icon(Icons.auto_awesome_rounded, size: 13, color: AppColors.purple),
                  const SizedBox(width: 6),
                  Text('AI Trend Impact', style: AppType.inter(10.5, color: AppColors.textPrimary, weight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 12),
              _TrendGauge(pct: p.home.vsLastMonthPercent ?? 0),
            ],
          ),
        ),

        // ── Floating overlay ────────────────────────────────────
        SectionHeader(icon: Icons.picture_in_picture_alt_rounded, color: AppColors.warning, title: 'Floating Overlay'),
        GlassCard(
          child: Row(
            children: [
              Container(
                width: 38, height: 38,
                decoration: BoxDecoration(
                  color: (p.overlayEnabled ? AppColors.warning : AppColors.textMuted).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(p.overlayEnabled ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                    size: 18, color: p.overlayEnabled ? AppColors.warning : AppColors.textMuted),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Live Data Overlay', style: AppType.inter(11, color: AppColors.textPrimary, weight: FontWeight.w700)),
                    const SizedBox(height: 1),
                    Text('Show a floating widget with solar, home & grid readings when the app is in the background.',
                        style: AppType.inter(8.5, color: AppColors.textMuted, height: 1.4)),
                  ],
                ),
              ),
              Switch(
                value: p.overlayEnabled,
                onChanged: p.setOverlay,
                activeTrackColor: AppColors.warning.withValues(alpha: 0.4),
                activeThumbColor: AppColors.warning,
                inactiveTrackColor: AppColors.border,
                inactiveThumbColor: AppColors.textMuted,
              ),
            ],
          ),
        ),
        if (_saved) ...[
          const SizedBox(height: 16),
          Center(
            child: Text('Saved', style: AppType.inter(10, color: AppColors.success, weight: FontWeight.w700)),
          ),
        ],
      ],
    );
  }
}

class _Input extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String? initial;
  final bool enabled;

  const _Input({required this.label, required this.controller, this.initial, this.enabled = true});

  @override
  Widget build(BuildContext context) {
    if (initial != null && initial!.isNotEmpty && controller.text.isEmpty) {
      controller.text = initial!;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppType.inter(8.5, color: AppColors.textSecondary)),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          enabled: enabled,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: AppType.inter(11, color: AppColors.textPrimary, weight: FontWeight.w600),
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            filled: true,
            fillColor: AppColors.surfaceAlt,
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: enabled ? AppColors.border : AppColors.border.withValues(alpha: 0.4)),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: AppColors.border.withValues(alpha: 0.3)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.info, width: 1.2),
            ),
          ),
        ),
      ],
    );
  }
}

class _ReadingInput extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final double lastLogged;
  final int lastTs;

  const _ReadingInput({required this.label, required this.controller, required this.lastLogged, required this.lastTs});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: AppType.inter(8.5, color: AppColors.textSecondary)),
            if (lastTs > 0) ...[
              const SizedBox(width: 8),
              Text(
                'Last logged: ${lastLogged.toStringAsFixed(1)} kWh · ${DateTime.fromMillisecondsSinceEpoch(lastTs * 1000).day}/${DateTime.fromMillisecondsSinceEpoch(lastTs * 1000).month}',
                style: AppType.mono(7.5, color: AppColors.textMuted),
              ),
            ],
          ],
        ),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: AppType.inter(11, color: AppColors.textPrimary, weight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: 'Current: kWh',
            hintStyle: AppType.inter(10, color: AppColors.textMuted),
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            filled: true,
            fillColor: AppColors.surfaceAlt,
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.purple, width: 1.2),
            ),
          ),
        ),
      ],
    );
  }
}

/// Semi-circle trend gauge: left arc blue (higher), right arc purple (lower).
class _TrendGauge extends StatelessWidget {
  final double pct; // negative = saving, positive = over
  const _TrendGauge({required this.pct});

  @override
  Widget build(BuildContext context) {
    final isLower = pct <= 0;
    final isNeutral = pct.abs() < 2;
    final label = isNeutral
        ? 'On track with last month'
        : isLower
            ? 'Saving vs last month'
            : 'Over vs last month';
    final sub = isNeutral
        ? 'Usage matches last month'
        : '${pct.abs().toStringAsFixed(0)}% ${isLower ? 'less' : 'more'} than last month';
    final color = isNeutral ? AppColors.textSecondary : isLower ? AppColors.purple : AppColors.info;
    final frac = (isLower ? pct.abs() : -pct.abs()).clamp(-1.0, 1.0) / 2 + 0.5; // 0..1, left=low

    return Row(
      children: [
        SizedBox(
          width: 74, height: 40,
          child: CustomPaint(painter: _SemiGaugePainter(frac, color)),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(isLower ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                      size: 12, color: color),
                  const SizedBox(width: 4),
                  Text('${isLower ? '-' : '+'}${pct.abs().toStringAsFixed(0)} units',
                      style: AppType.inter(11, color: AppColors.textPrimary, weight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 2),
              Text(label, style: AppType.inter(9, color: color, weight: FontWeight.w700)),
              Text(sub, style: AppType.inter(8.5, color: AppColors.textMuted)),
            ],
          ),
        ),
      ],
    );
  }
}

class _SemiGaugePainter extends CustomPainter {
  final double frac; // 0..1 (0 = most saving)
  final Color color;
  _SemiGaugePainter(this.frac, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(2, 2, size.width - 4, size.height * 2 - 4);
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, pi, pi, false, track..color = AppColors.info.withValues(alpha: 0.25));
    canvas.drawArc(rect, 0, pi, false, track..color = AppColors.purple.withValues(alpha: 0.25));

    final t = frac.clamp(0.0, 1.0);
    final angle = pi + t * pi; // pi (left) → 2pi (right)
    final cx = size.width / 2;
    final cy = size.height;
    final r = size.width / 2 - 2;
    final pos = Offset(cx + cos(angle) * r, cy + sin(angle) * r);
    canvas.drawCircle(pos, 4.5, Paint()..color = color);
    canvas.drawCircle(pos, 8, Paint()..color = color.withValues(alpha: 0.2));
  }

  @override
  bool shouldRepaint(_SemiGaugePainter old) => old.frac != frac || old.color != color;
}
