import 'package:flutter/material.dart';

import '../data/energy_scope.dart';
import '../models/energy.dart';
import '../theme/app_colors.dart';

class MetersPage extends StatefulWidget {
  const MetersPage({super.key});

  @override
  State<MetersPage> createState() => _MetersPageState();
}

class _MetersPageState extends State<MetersPage> {
  bool _panelOpen = false;
  final _readingController = TextEditingController();
  String _selectedMeterId = 'meter1';

  @override
  void dispose() {
    _readingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = EnergyScope.of(context);
    final activeId = p.activeMeter;
    final m1 = p.meter('meter1');
    final m2 = p.meter('meter2');

    final activeMeter = activeId == 'meter1' ? m1 : m2;
    final inactiveMeter = activeId == 'meter1' ? m2 : m1;

    return Scaffold(
      backgroundColor: AppColors.solarBg,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 28, 22, 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _PageHeader(
                onAdd: () => setState(() => _panelOpen = !_panelOpen),
              ),
              const SizedBox(height: 24),
              if (_panelOpen) ...[
                _ReadingEntryPanel(
                  controller: _readingController,
                  selectedMeterId: _selectedMeterId,
                  onMeterChanged: (id) => setState(() => _selectedMeterId = id),
                  onSave: () async {
                    final value = double.tryParse(_readingController.text);
                    if (value != null) {
                      await p.logReading(_selectedMeterId, value);
                      if (mounted) {
                        setState(() {
                          _panelOpen = false;
                          _readingController.clear();
                        });
                      }
                    }
                  },
                ),
                const SizedBox(height: 22),
              ],
              const _SectionLabel(label: 'CURRENTLY ACTIVE', active: true),
              const SizedBox(height: 12),
              _MeterCard(meter: activeMeter, active: true),
              const SizedBox(height: 26),
              const _SectionLabel(label: 'INACTIVE', active: false),
              const SizedBox(height: 12),
              _MeterCard(meter: inactiveMeter, active: false),
              const SizedBox(height: 28),
              const _SwitchHistory(),
            ],
          ),
        ),
      ),
    );
  }
}

class _PageHeader extends StatelessWidget {
  final VoidCallback onAdd;

  const _PageHeader({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('METER MANAGEMENT',
                style: AppType.dmMono(10,
                    color: AppColors.solarTextSecondary,
                    letterSpacing: 0.11)),
            const SizedBox(height: 5),
            Text('Your meters',
                style: AppType.manrope(25,
                    weight: FontWeight.w800, letterSpacing: -0.045)),
          ],
        ),
        Material(
          color: AppColors.solarDarkGreen,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onAdd,
            child: const SizedBox(
              width: 42,
              height: 42,
              child: Icon(Icons.add_rounded, size: 20, color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}

class _ReadingEntryPanel extends StatelessWidget {
  final TextEditingController controller;
  final String selectedMeterId;
  final ValueChanged<String> onMeterChanged;
  final VoidCallback onSave;

  const _ReadingEntryPanel({
    required this.controller,
    required this.selectedMeterId,
    required this.onMeterChanged,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF4FAF4),
        border: Border.all(color: const Color(0xFFCFDFCF)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Record a reading',
              style: AppType.manrope(12,
                  color: AppColors.solarTextPrimary,
                  weight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.solarCardBorder),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: selectedMeterId,
                      icon: const Icon(Icons.keyboard_arrow_down,
                          size: 18, color: AppColors.solarTextSecondary),
                      isExpanded: true,
                      style: AppType.manrope(12,
                          color: AppColors.solarTextPrimary),
                      onChanged: (v) {
                        if (v != null) onMeterChanged(v);
                      },
                      items: const [
                        DropdownMenuItem(value: 'meter1', child: Text('Meter 1')),
                        DropdownMenuItem(value: 'meter2', child: Text('Meter 2')),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: controller,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    hintText: 'Reading',
                    hintStyle: AppType.manrope(12,
                        color: AppColors.solarTextMuted),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.solarCardBorder),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.solarCardBorder),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.solarGreen, width: 1.2),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onSave,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFEFF6ED),
                foregroundColor: AppColors.solarGreen,
                side: const BorderSide(color: Color(0xFFCFDFCF)),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              child: Text('Save reading',
                  style: AppType.manrope(12,
                      color: AppColors.solarGreen,
                      weight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  final bool active;

  const _SectionLabel({required this.label, required this.active});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (active) ...[
          Container(
            width: 7,
            height: 7,
            decoration: const BoxDecoration(
              color: AppColors.solarGreen,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 7),
        ],
        Text(label,
            style: AppType.dmMono(10,
                color: AppColors.solarTextSecondary,
                weight: FontWeight.w500,
                letterSpacing: 0.1)),
      ],
    );
  }
}

class _MeterCard extends StatelessWidget {
  final MeterState meter;
  final bool active;

  const _MeterCard({required this.meter, required this.active});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.solarCard,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(
            color: active ? const Color(0xFF9DCB9F) : AppColors.solarCardBorder,
            width: active ? 1.5 : 1),
        boxShadow: active
            ? const [
                BoxShadow(
                  color: Color(0x143D7A4E),
                  blurRadius: 16,
                  offset: Offset(0, 8),
                )
              ]
            : const [
                BoxShadow(
                  color: Color(0x0A384528),
                  blurRadius: 22,
                  offset: Offset(0, 10),
                )
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _TitleRow(meter: meter, active: active),
          const SizedBox(height: 16),
          const Divider(color: AppColors.solarDivider, height: 1),
          const SizedBox(height: 16),
          Row(
            children: [
              _ReadingColumn(label: 'Current reading', value: meter.reading),
              Container(
                width: 1,
                height: 42,
                color: AppColors.solarDivider,
              ),
              _ReadingColumn(label: 'Remaining', value: meter.remainingUnits),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: AppColors.solarDivider, height: 1),
          const SizedBox(height: 14),
          _FooterRow(meter: meter),
        ],
      ),
    );
  }
}

class _TitleRow extends StatelessWidget {
  final MeterState meter;
  final bool active;

  const _TitleRow({required this.meter, required this.active});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFFEDF5ED),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.electric_meter_rounded,
              size: 22, color: Color(0xFF388953)),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${_meterName(meter.label)} — ${meter.isDigital ? 'digital' : 'analog'}',
                  style: AppType.manrope(13,
                      color: AppColors.solarTextPrimary,
                      weight: FontWeight.w700)),
              const SizedBox(height: 3),
              Row(
                children: [
                  if (active) ...[
                    Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                          color: AppColors.solarGreen,
                          shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 4),
                  ],
                  Text(active ? 'Active supply' : 'Standby',
                      style: AppType.manrope(10,
                          color: active
                              ? AppColors.solarGreen
                              : AppColors.solarTextSecondary)),
                ],
              ),
            ],
          ),
        ),
        const Icon(Icons.chevron_right,
            size: 20, color: AppColors.solarTextMuted),
      ],
    );
  }
}

class _ReadingColumn extends StatelessWidget {
  final String label;
  final double value;

  const _ReadingColumn({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: AppType.dmMono(9,
                  color: AppColors.solarTextSecondary)),
          const SizedBox(height: 4),
          Text(value.toStringAsFixed(1),
              style: AppType.robotoSlab(18, letterSpacing: -0.04)),
        ],
      ),
    );
  }
}

class _FooterRow extends StatelessWidget {
  final MeterState meter;

  const _FooterRow({required this.meter});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _FooterItem(
            label: 'Avg usage',
            value: '${meter.averageDaily.toStringAsFixed(1)} / day',
          ),
        ),
        _FooterItem(
          label: 'Target date',
          value: _targetDate(meter),
        ),
      ],
    );
  }
}

class _FooterItem extends StatelessWidget {
  final String label;
  final String value;

  const _FooterItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: AppType.dmMono(9,
                color: AppColors.solarTextSecondary)),
        const SizedBox(height: 3),
        Text(value,
            style: AppType.manrope(11,
                color: AppColors.solarTextPrimary,
                weight: FontWeight.w600)),
      ],
    );
  }
}

class _SwitchHistory extends StatelessWidget {
  const _SwitchHistory();

  @override
  Widget build(BuildContext context) {
    final events = [
      const _TimelineEvent(
        title: 'Meter 1 activated',
        time: 'Today, 08:23 AM',
        subtitle: 'Grid supply transferred to Meter 1',
      ),
      const _TimelineEvent(
        title: 'Meter 2 activated',
        time: 'Yesterday, 07:45 PM',
        subtitle: 'Grid supply transferred to Meter 2',
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Switch history',
            style: AppType.manrope(15,
                color: AppColors.solarTextPrimary,
                weight: FontWeight.w700)),
        const SizedBox(height: 14),
        ...events.map((e) => _TimelineItem(event: e)),
      ],
    );
  }
}

class _TimelineEvent {
  final String title;
  final String time;
  final String subtitle;

  const _TimelineEvent({
    required this.title,
    required this.time,
    required this.subtitle,
  });
}

class _TimelineItem extends StatelessWidget {
  final _TimelineEvent event;

  const _TimelineItem({required this.event});

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 9,
                height: 9,
                decoration: const BoxDecoration(
                  color: AppColors.solarGreen,
                  shape: BoxShape.circle,
                ),
              ),
              Expanded(
                child: Container(
                  width: 1,
                  color: AppColors.solarDivider,
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(event.title,
                          style: AppType.manrope(12,
                              color: AppColors.solarTextPrimary,
                              weight: FontWeight.w700)),
                      Text(event.time,
                          style: AppType.dmMono(9,
                              color: AppColors.solarTextMuted)),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(event.subtitle,
                      style: AppType.manrope(10,
                          color: AppColors.solarTextSecondary)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _meterName(String label) {
  if (label.trim().isEmpty) return 'Meter';
  if (label.toLowerCase().contains('meter')) return label;
  return 'Meter ${label.replaceAll(RegExp(r'\D'), '')}';
}

String _targetDate(MeterState meter) {
  if (meter.averageDaily <= 0) return '--';
  final days = (meter.remainingUnits / meter.averageDaily).round();
  final date = DateTime.now().add(Duration(days: days));
  final month = _monthShort(date.month);
  return '${date.day} $month';
}

String _monthShort(int month) {
  const names = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return names[month - 1];
}
