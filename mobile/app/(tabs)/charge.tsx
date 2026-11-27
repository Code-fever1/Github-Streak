import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LAYOUT, THEME } from '@/constants/theme';
import {
  applyChargeHold,
  CAP_PRESETS,
  getChargeHoldStatus,
  loadChargeHoldSettings,
  LOWER_PRESETS,
  MIN_CHARGE_GAP,
  saveChargeHoldSettings,
  type ChargeHoldSettings,
  type ChargeHoldStatus,
} from '@/lib/charge-hold';
import { isSuAvailable } from '@/lib/notification-alerts';

export default function ChargeScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suOk, setSuOk] = useState(false);
  const [charge, setCharge] = useState<ChargeHoldSettings | null>(null);
  const [chargeStatus, setChargeStatus] = useState<ChargeHoldStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const isAndroid = Platform.OS === 'android';

  const refresh = useCallback(async () => {
    try {
      const saved = await loadChargeHoldSettings();
      setCharge(saved);
      if (Platform.OS === 'android') {
        const [su, cStat] = await Promise.all([isSuAvailable(), getChargeHoldStatus()]);
        setSuOk(su);
        setChargeStatus(cStat);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const persistCharge = async (next: ChargeHoldSettings): Promise<boolean> => {
    if (!isAndroid) {
      await saveChargeHoldSettings(next);
      return true;
    }
    return applyChargeHold(next);
  };

  const onChargeToggle = async (enabled: boolean) => {
    if (!charge) return;
    const next = { ...charge, enabled };
    setCharge(next);
    setBusy(true);
    const ok = await persistCharge(next);
    setBusy(false);
    if (!ok) {
      setCharge(charge);
      const hint = suOk
        ? 'Root is granted but the charge daemon did not respond. Try again once, or reboot and toggle Charge limit.'
        : 'Open Magisk → Superuser and allow root for Veyon, then try again.';
      Alert.alert('Charge limit', hint);
      return;
    }
    await refresh();
  };

  const onCap = async (cap: number) => {
    if (!charge) return;
    const lower = Math.min(charge.lower, cap - MIN_CHARGE_GAP);
    const next = { ...charge, cap, lower };
    setCharge(next);
    setBusy(true);
    const ok = await persistCharge(next);
    setBusy(false);
    if (!ok && next.enabled) {
      Alert.alert('Charge limit', 'Limits saved but could not apply. Grant root and toggle again.');
    } else {
      await refresh();
    }
  };

  const onLower = async (lower: number) => {
    if (!charge) return;
    const cap = Math.max(charge.cap, lower + MIN_CHARGE_GAP);
    const next = { ...charge, cap: Math.min(cap, 100), lower };
    setCharge(next);
    setBusy(true);
    const ok = await persistCharge(next);
    setBusy(false);
    if (!ok && next.enabled) {
      Alert.alert('Charge limit', 'Limits saved but could not apply. Grant root and toggle again.');
    } else {
      await refresh();
    }
  };

  if (loading || !charge) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={THEME.accent} />
      </View>
    );
  }

  const rawBattery = Number(chargeStatus?.level);
  const hasLiveBattery = isAndroid && Number.isFinite(rawBattery) && (chargeStatus?.level ?? '') !== '';
  const liveBattery = hasLiveBattery ? Math.min(100, Math.max(0, rawBattery)) : null;

  const statusPillText = charge.enabled ? `Active ${charge.lower}–${charge.cap}%` : 'Limit off';
  const stateLabel = isAndroid
    ? chargeStatus?.daemon_state || (charge.enabled ? 'Armed' : 'Standby')
    : 'Preview mode on web';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + THEME.space.lg, paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onPullRefresh}
          tintColor={THEME.accent}
          colors={[THEME.accent]}
          progressBackgroundColor={THEME.surface}
        />
      }
    >
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>POWER CONTROL</Text>
        <Text style={styles.screenTitle}>Charge</Text>
        <Text style={styles.screenSub}>Battery limit & power window control</Text>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.cardEyebrow}>BATTERY STATUS</Text>
            <View
              style={[
                styles.pill,
                charge.enabled ? styles.pillBlue : styles.pillMuted,
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: charge.enabled ? THEME.info : THEME.textMuted },
                ]}
              />
              <Text
                style={[
                  styles.pillText,
                  { color: charge.enabled ? THEME.info : THEME.textSecondary },
                ]}
              >
                {statusPillText}
              </Text>
            </View>
          </View>

          <View style={styles.readoutRow}>
            <Text style={styles.readoutValue}>
              {liveBattery !== null ? `${liveBattery}%` : `${charge.cap}%`}
            </Text>
            <View style={styles.readoutMeta}>
              <Text style={styles.readoutLabel}>
                {liveBattery !== null ? 'Current level' : 'Target upper cap'}
              </Text>
              <Text style={styles.readoutState}>{stateLabel}</Text>
            </View>
          </View>

          <View style={styles.gaugeWrap}>
            <View style={styles.gaugeTrack}>
              {liveBattery !== null ? (
                <View
                  style={[
                    styles.gaugeFill,
                    { width: `${liveBattery}%` },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.gaugeBand,
                  {
                    left: `${charge.lower}%`,
                    width: `${Math.max(4, charge.cap - charge.lower)}%`,
                    borderColor: charge.enabled ? THEME.info : THEME.borderFocus,
                    backgroundColor: charge.enabled ? THEME.infoSoft : 'rgba(155, 165, 180, 0.12)',
                  },
                ]}
              />
            </View>
            <View style={styles.gaugeScale}>
              <Text style={styles.scaleLabel}>0%</Text>
              <Text style={styles.scaleHighlight}>
                {charge.lower}% – {charge.cap}% window
              </Text>
              <Text style={styles.scaleLabel}>100%</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <View style={styles.rowText}>
              <Text style={styles.panelTitle}>Charge limit</Text>
              <Text style={styles.panelSub}>
                Charge until the upper cap, then discharge to the lower limit before resuming.
              </Text>
            </View>
            <Switch
              value={charge.enabled}
              onValueChange={onChargeToggle}
              disabled={busy}
              trackColor={{ false: THEME.border, true: THEME.accent }}
              thumbColor={THEME.textPrimary}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.presetBlock}>
            <View style={styles.presetHeader}>
              <Text style={styles.presetLabel}>Stop charging at</Text>
              <Text style={styles.presetValue}>{charge.cap}%</Text>
            </View>
            <View style={styles.presetRow}>
              {CAP_PRESETS.map((cap) => {
                const active = charge.cap === cap;
                return (
                  <Pressable
                    key={cap}
                    style={({ pressed }) => [
                      styles.presetChip,
                      active && styles.presetChipOn,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => onCap(cap)}
                    disabled={busy}
                  >
                    <Text style={[styles.presetChipText, active && styles.presetChipTextOn]}>
                      {cap}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.presetBlock}>
            <View style={styles.presetHeader}>
              <Text style={styles.presetLabel}>Start charging at</Text>
              <Text style={styles.presetValue}>{charge.lower}%</Text>
            </View>
            <View style={styles.presetRow}>
              {LOWER_PRESETS.map((lower) => {
                const active = charge.lower === lower;
                return (
                  <Pressable
                    key={lower}
                    style={({ pressed }) => [
                      styles.presetChip,
                      active && styles.presetChipOn,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => onLower(lower)}
                    disabled={busy}
                  >
                    <Text style={[styles.presetChipText, active && styles.presetChipTextOn]}>
                      {lower}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Hardware & root</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Superuser (Magisk)</Text>
            <Text
              style={[
                styles.infoValue,
                isAndroid ? (suOk ? styles.infoOk : styles.infoWarn) : styles.infoMuted,
              ]}
            >
              {isAndroid ? (suOk ? 'Granted' : 'Not granted') : 'Android S8+ only'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Background script</Text>
            <Text
              style={[
                styles.infoValue,
                isAndroid
                  ? chargeStatus?.running === '1'
                    ? styles.infoOk
                    : styles.infoWarn
                  : styles.infoMuted,
              ]}
            >
              {isAndroid
                ? chargeStatus?.running === '1'
                  ? `Running · PID ${chargeStatus.pid || '?'}`
                  : 'Stopped'
                : 'Android S8+ only'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Daemon state</Text>
            <Text style={styles.infoValue}>{stateLabel}</Text>
          </View>
          <Text style={styles.hardwareNote}>
            Hardware note: S8+ charging hardware cycles between the lower and upper thresholds rather than bypassing the battery directly on AC power.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { paddingHorizontal: THEME.space.lg },
  inner: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.bg,
  },
  eyebrow: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  screenTitle: { color: THEME.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  screenSub: { color: THEME.textSecondary, fontSize: 13, marginTop: 4, marginBottom: THEME.space.lg },
  heroCard: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.lg,
    marginBottom: THEME.space.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.space.md,
  },
  cardEyebrow: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillBlue: { backgroundColor: THEME.infoSoft, borderColor: THEME.infoBorder },
  pillMuted: { backgroundColor: THEME.surfaceElevated, borderColor: THEME.border },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '600' },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.space.lg,
    marginBottom: THEME.space.lg,
  },
  readoutValue: {
    color: THEME.textPrimary,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  readoutMeta: { flex: 1 },
  readoutLabel: { color: THEME.textSecondary, fontSize: 13, fontWeight: '600' },
  readoutState: { color: THEME.info, fontSize: 12, fontWeight: '600', marginTop: 3 },
  gaugeWrap: { gap: 8 },
  gaugeTrack: {
    height: 14,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.border,
    position: 'relative',
    overflow: 'hidden',
  },
  gaugeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: THEME.accentSoft,
  },
  gaugeBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeftWidth: 2,
    borderRightWidth: 2,
  },
  gaugeScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scaleLabel: { color: THEME.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  scaleHighlight: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  panel: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.lg,
    marginBottom: THEME.space.md,
    gap: THEME.space.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: THEME.space.md,
  },
  rowText: { flex: 1 },
  panelTitle: { color: THEME.textPrimary, fontSize: 16, fontWeight: '700' },
  panelSub: { color: THEME.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: THEME.border },
  presetBlock: { gap: THEME.space.sm },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetLabel: { color: THEME.textSecondary, fontSize: 12, fontWeight: '600' },
  presetValue: {
    color: THEME.info,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: THEME.space.sm },
  presetChip: {
    minWidth: 52,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipOn: {
    borderColor: THEME.infoBorder,
    backgroundColor: THEME.infoSoft,
  },
  pressed: { opacity: 0.78 },
  presetChipText: {
    color: THEME.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  presetChipTextOn: { color: THEME.info, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  infoLabel: { color: THEME.textSecondary, fontSize: 13 },
  infoValue: { color: THEME.textPrimary, fontSize: 13, fontWeight: '600' },
  infoOk: { color: THEME.accent },
  infoWarn: { color: THEME.warn },
  infoMuted: { color: THEME.textMuted },
  hardwareNote: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingTop: 4,
  },
});
