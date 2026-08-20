import 'package:flutter/material.dart';

import '../data/energy_scope.dart';
import '../models/energy.dart';
import '../theme/app_colors.dart';
import '../widgets/glass_card.dart';

class LogsPage extends StatelessWidget {
  const LogsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    final m1 = p.meter('meter1');
    final m2 = p.meter('meter2');
    final logs = p.logs;

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
                Text('Readings Log', style: const TextStyle(fontFamily: 'Outfit', fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.6)),
                const SizedBox(height: 3),
                Text('Manual meter readings history & calibration logs', style: AppType.inter(10.5, color: AppColors.textSecondary)),
              ],
            ),
          ],
        ),
        const SizedBox(height: 18),

        // Summary stats
        Row(
          children: [
            Expanded(
              child: _StatCard(label: 'TOTAL LOGS', value: '${logs.length}', color: AppColors.purple),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _StatCard(
                label: 'METER 1',
                value: m1.reading.toStringAsFixed(1),
                unit: 'units',
                color: AppColors.home,
                delta: _delta(m1),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _StatCard(
                label: 'METER 2',
                value: m2.reading.toStringAsFixed(1),
                unit: 'units',
                color: AppColors.grid,
                delta: _delta(m2),
              ),
            ),
          ],
        ),
        const SizedBox(height: 22),

        Row(
          children: [
            Icon(Icons.history_rounded, size: 13, color: AppColors.purple),
            const SizedBox(width: 6),
            Text('RECENT READINGS', style: AppType.mono(9, color: AppColors.textSecondary, letterSpacing: 1.2)),
            const Spacer(),
            Text('${logs.length > 10 ? 10 : logs.length} of ${logs.length}', style: AppType.mono(8.5, color: AppColors.textMuted)),
          ],
        ),
        const SizedBox(height: 10),

        if (logs.isEmpty)
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 30),
              child: Column(
                children: [
                  Icon(Icons.schedule_rounded, size: 26, color: AppColors.textMuted),
                  const SizedBox(height: 10),
                  Text('No readings yet', style: AppType.inter(12, color: AppColors.textPrimary, weight: FontWeight.w700)),
                  const SizedBox(height: 3),
                  Text('Manual readings logged from Settings will appear here.',
                      textAlign: TextAlign.center,
                      style: AppType.inter(9.5, color: AppColors.textMuted, height: 1.4)),
                ],
              ),
            ),
          )
        else
          GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Column(
              children: [
                for (var i = 0; i < logs.length && i < 10; i++) ...[
                  if (i > 0) const Divider(color: AppColors.border, height: 1),
                  _LogRow(log: logs[i], meter: p.meter(logs[i].meterId), onDelete: () => p.deleteLog(logs[i].id)),
                ],
              ],
            ),
          ),
      ],
    );
  }

  String? _delta(MeterState m) {
    if (m.lastLoggedAt == 0) return null;
    final d = m.reading - m.lastLoggedReading;
    if (d <= 0.05) return null;
    return '+${d.toStringAsFixed(1)}';
  }
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final String? unit, delta;
  final Color color;

  const _StatCard({required this.label, required this.value, required this.color, this.unit, this.delta});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppType.mono(7.5, color: AppColors.textMuted, letterSpacing: 0.9)),
          const SizedBox(height: 5),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: Text(value,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontFamily: 'Outfit', fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.4)),
              ),
              if (unit != null) ...[
                const SizedBox(width: 4),
                Text(unit!, style: AppType.inter(8, color: AppColors.textMuted)),
              ],
            ],
          ),
          if (delta != null) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
              child: Text(delta!, style: AppType.mono(8, color: color)),
            ),
          ],
        ],
      ),
    );
  }
}

class _LogRow extends StatelessWidget {
  final ManualLog log;
  final MeterState meter;
  final VoidCallback onDelete;

  const _LogRow({required this.log, required this.meter, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final color = meter.isDigital ? AppColors.grid : AppColors.home;
    final d = DateTime.fromMillisecondsSinceEpoch(log.timestamp * 1000);
    final now = DateTime.now();
    final sameDay = d.year == now.year && d.month == now.month && d.day == now.day;
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday = d.year == yesterday.year && d.month == yesterday.month && d.day == yesterday.day;
    final time = '${d.hour % 12 == 0 ? 12 : d.hour % 12}:${d.minute.toString().padLeft(2, '0')} ${d.hour >= 12 ? 'PM' : 'AM'}';
    final when = sameDay ? 'Today $time' : isYesterday ? 'Yesterday $time' : '${_months[d.month - 1]} ${d.day} $time';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(9)),
            child: Center(
              child: Text(meter.isDigital ? 'M2' : 'M1',
                  style: AppType.mono(9, color: color, letterSpacing: 0.5)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(meter.label, style: AppType.inter(9.5, color: AppColors.textPrimary, weight: FontWeight.w700)),
                const SizedBox(height: 1),
                Text(when, style: AppType.mono(8, color: AppColors.textMuted)),
              ],
            ),
          ),
          Text(log.reading.toStringAsFixed(1), style: AppType.inter(11, color: AppColors.textPrimary, weight: FontWeight.w700)),
          const SizedBox(width: 4),
          Text('units', style: AppType.mono(7.5, color: AppColors.textMuted)),
          if (log.notes != null) ...[
            const SizedBox(width: 8),
            Text(log.notes!, style: AppType.inter(8, color: AppColors.textMuted)),
          ],
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onDelete,
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.delete_outline_rounded, size: 15, color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
  }

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}
