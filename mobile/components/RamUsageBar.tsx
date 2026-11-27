import { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppIcon } from '@/components/AppIcon';
import { THEME } from '@/constants/theme';
import { formatBytes, getRamSnapshot, type RamSnapshot } from '@/lib/memory-stats';

interface Props {
  refreshKey: number;
}

const POLL_INTERVAL_MS = 5000;

/** Isolated RAM usage bar polling Android system memory or Web runtime memory while focused. */
export const RamUsageBar = memo(function RamUsageBar({ refreshKey }: Props) {
  const [ram, setRam] = useState<RamSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const snap = await getRamSnapshot();
    setRam(snap);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(() => {
        load();
      }, POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const percent = ram?.percent ?? 0;
  const isCritical = Boolean(ram?.lowMemory || percent >= 85);
  const isElevated = !isCritical && percent >= 65;

  const toneColor = isCritical ? THEME.danger : isElevated ? THEME.warn : THEME.accent;
  const badgeBg = isCritical ? THEME.dangerSoft : isElevated ? THEME.warnSoft : THEME.accentSoft;
  const badgeBorder = isCritical
    ? THEME.dangerBorder
    : isElevated
      ? THEME.warnBorder
      : THEME.accentBorder;

  const sourceLabel =
    ram?.source === 'android'
      ? 'System'
      : ram?.source === 'web-heap'
        ? 'JS Heap'
        : ram?.source === 'web-estimate'
          ? 'Device'
          : '';

  const readoutText = !ram
    ? loaded
      ? 'Unavailable'
      : '…'
    : ram.usedBytes > 0
      ? `${formatBytes(ram.usedBytes)} / ${formatBytes(ram.totalBytes)}`
      : `${formatBytes(ram.totalBytes)} RAM`;

  const footerLeft = !loaded
    ? 'Reading device memory…'
    : !ram
      ? 'Memory telemetry unavailable in this browser'
      : ram.source === 'web-estimate'
        ? 'Browser memory estimate'
        : `${formatBytes(ram.availBytes)} available`;

  const statusText = !ram
    ? '—'
    : ram.source === 'web-estimate'
      ? 'Detected'
      : isCritical
        ? 'Low memory'
        : isElevated
          ? 'Elevated'
          : 'Optimal';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.leftLabel}>
          <AppIcon name="memory" color={ram ? toneColor : THEME.textSecondary} size={15} />
          <Text style={styles.eyebrow}>RAM USAGE</Text>
          {sourceLabel ? <Text style={styles.sourceTag}>{sourceLabel}</Text> : null}
        </View>

        <View style={styles.rightStats}>
          <Text style={styles.readout}>{readoutText}</Text>
          {ram && ram.usedBytes > 0 ? (
            <View style={[styles.badge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Text style={[styles.badgeText, { color: toneColor }]}>{percent}%</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${ram && ram.usedBytes > 0 ? Math.max(4, percent) : 0}%`,
              backgroundColor: toneColor,
            },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerLeft}>{footerLeft}</Text>
        <Text style={[styles.footerRight, ram && ram.usedBytes > 0 && { color: toneColor }]}>
          {statusText}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.md + 2,
    marginBottom: THEME.space.md,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.space.sm,
  },
  leftLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sourceTag: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  rightStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readout: {
    color: THEME.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.surfaceElevated,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: THEME.radius.pill,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  footerRight: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
});
