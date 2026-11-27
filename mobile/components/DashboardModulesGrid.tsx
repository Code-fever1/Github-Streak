import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppIcon } from '@/components/AppIcon';
import { THEME } from '@/constants/theme';
import {
  getChargeHoldStatus,
  loadChargeHoldSettings,
  type ChargeHoldSettings,
  type ChargeHoldStatus,
} from '@/lib/charge-hold';
import {
  getRootMonitorStatus,
  isNotificationListenerEnabled,
  isRootMonitorInstalled,
  isSuAvailable,
  loadNotificationAlertSettings,
  onAppForeground,
  type NotificationAlertSettings,
  type RootMonitorStatus,
} from '@/lib/notification-alerts';

interface Props {
  refreshKey: number;
  onOpenCharge: () => void;
  onOpenNotifications: () => void;
}

const MODE_LABELS = {
  alarm: 'Alarm',
  ringtone: 'Ringtone',
  notification: 'Chime',
} as const;

/** Symmetric 2-column Swiss bento displaying Battery Limit and Fiverr/Unread Alerts on all platforms. */
export function DashboardModulesGrid({ refreshKey, onOpenCharge, onOpenNotifications }: Props) {
  const [charge, setCharge] = useState<ChargeHoldSettings | null>(null);
  const [chargeStatus, setChargeStatus] = useState<ChargeHoldStatus | null>(null);
  const [alerts, setAlerts] = useState<NotificationAlertSettings | null>(null);
  const [listenerOn, setListenerOn] = useState(false);
  const [rootMon, setRootMon] = useState(false);
  const [rootStatus, setRootStatus] = useState<RootMonitorStatus | null>(null);
  const [suOk, setSuOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const [chargeSettings, alertSettings] = await Promise.all([
        loadChargeHoldSettings(),
        loadNotificationAlertSettings(),
      ]);
      setCharge(chargeSettings);
      setAlerts(alertSettings);

      if (Platform.OS === 'android') {
        const [cStatus, listener, rootMonitor, rStatus, su] = await Promise.all([
          getChargeHoldStatus(),
          isNotificationListenerEnabled(),
          isRootMonitorInstalled(),
          getRootMonitorStatus(),
          isSuAvailable(),
        ]);
        setChargeStatus(cStatus);
        setListenerOn(listener);
        setRootMon(rootMonitor);
        setRootStatus(rStatus);
        setSuOk(su);
      }
    } catch {
      // Keep dashboard resilient if storage or bridge reads fail.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => onAppForeground(() => load()), [load]);

  const isAndroid = Platform.OS === 'android';

  // Charge Hold derived telemetry
  const cap = charge?.cap ?? 60;
  const lower = charge?.lower ?? 50;
  const rawBattery = Number(chargeStatus?.level);
  const hasLiveBattery = isAndroid && Number.isFinite(rawBattery) && (chargeStatus?.level ?? '') !== '';
  const liveBattery = hasLiveBattery ? Math.min(100, Math.max(0, rawBattery)) : null;

  const chargeOn = Boolean(charge?.enabled);
  const chargeMetric = liveBattery !== null ? `${liveBattery}%` : `${cap}%`;
  const chargeCaption = liveBattery !== null ? `target ${lower}–${cap}%` : 'target cap';
  const chargeFooter = isAndroid
    ? `Window ${lower}–${cap}% · ${chargeStatus?.daemon_state || (suOk ? 'Ready' : 'Root needed')}`
    : `Window ${lower}–${cap}% · S8+ root`;

  // Notification / Fiverr Alerts derived telemetry
  const alertsOn = Boolean(alerts?.enabled);
  const alertNeedsSetup = isAndroid && alertsOn && !listenerOn;
  const alertPillText = alertNeedsSetup ? 'SETUP' : alertsOn ? 'ON' : 'OFF';
  const alertPillColors = alertNeedsSetup
    ? { bg: THEME.warnSoft, border: THEME.warnBorder, text: THEME.warn }
    : alertsOn
      ? { bg: THEME.accentSoft, border: THEME.accentBorder, text: THEME.accent }
      : { bg: THEME.surfaceElevated, border: THEME.border, text: THEME.textMuted };

  const watched = alerts?.watchedApps ?? [];
  const primaryApp =
    watched.length === 0
      ? 'Fiverr / Apps'
      : watched.length === 1
        ? watched[0].label
        : `${watched[0].label} +${watched.length - 1}`;
  const modeLabel = alerts ? MODE_LABELS[alerts.mode] : 'Alarm';
  const delayLabel = alerts?.delayMinutes ?? 1;
  const alertSubline = `${delayLabel}m delay · ${modeLabel}`;
  const alertFooter = `Nudges 12 · 18 · 23h${rootStatus?.confirmed ? ' · Root OK' : rootMon ? ' · Root' : ''}`;

  return (
    <View style={styles.grid}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={onOpenCharge}
        accessibilityRole="button"
        accessibilityLabel="Open Battery Limit controls"
      >
        <View style={styles.cardHeader}>
          <View style={styles.eyebrowGroup}>
            <AppIcon name="charge" color={chargeOn ? THEME.info : THEME.textSecondary} size={15} active={chargeOn} />
            <Text style={styles.eyebrow}>CHARGE</Text>
          </View>
          <View
            style={[
              styles.pill,
              chargeOn
                ? { backgroundColor: THEME.infoSoft, borderColor: THEME.infoBorder }
                : { backgroundColor: THEME.surfaceElevated, borderColor: THEME.border },
            ]}
          >
            <Text style={[styles.pillText, { color: chargeOn ? THEME.info : THEME.textMuted }]}>
              {chargeOn ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>

        <View style={styles.metricBlock}>
          <Text style={styles.metricValue}>{chargeMetric}</Text>
          <Text style={styles.metricCaption}>{chargeCaption}</Text>
        </View>

        <View style={styles.rangeTrack}>
          <View
            style={[
              styles.rangeWindow,
              {
                left: `${lower}%`,
                width: `${Math.max(4, cap - lower)}%`,
                backgroundColor: chargeOn ? THEME.info : THEME.textMuted,
              },
            ]}
          />
          {liveBattery !== null ? (
            <View
              style={[
                styles.batteryMarker,
                { left: `${Math.min(96, Math.max(0, liveBattery))}%` },
              ]}
            />
          ) : null}
        </View>

        <Text style={styles.footerText} numberOfLines={1}>
          {chargeFooter}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={onOpenNotifications}
        accessibilityRole="button"
        accessibilityLabel="Open Fiverr and notification reminder settings"
      >
        <View style={styles.cardHeader}>
          <View style={styles.eyebrowGroup}>
            <AppIcon
              name="notification"
              color={alertsOn ? THEME.accent : THEME.textSecondary}
              size={15}
              active={alertsOn}
            />
            <Text style={styles.eyebrow}>ALERTS</Text>
          </View>
          <View
            style={[
              styles.pill,
              { backgroundColor: alertPillColors.bg, borderColor: alertPillColors.border },
            ]}
          >
            <Text style={[styles.pillText, { color: alertPillColors.text }]}>{alertPillText}</Text>
          </View>
        </View>

        <View style={styles.metricBlock}>
          <Text style={styles.appTitle} numberOfLines={1}>
            {primaryApp}
          </Text>
          <Text style={styles.metricCaption}>{alertSubline}</Text>
        </View>

        <View style={styles.nudgeBar}>
          <View style={[styles.nudgeDot, alertsOn && styles.nudgeDotActive]} />
          <View style={[styles.nudgeLine, alertsOn && styles.nudgeLineActive]} />
        </View>

        <Text style={styles.footerText} numberOfLines={1}>
          {alertFooter}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.space.md,
    marginBottom: THEME.space.md,
  },
  card: {
    flex: 1,
    minWidth: 152,
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.md + 2,
    justifyContent: 'space-between',
    minHeight: 138,
  },
  pressed: { backgroundColor: THEME.surfacePressed },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  eyebrowGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  pill: {
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  metricBlock: { marginTop: THEME.space.md },
  metricValue: {
    color: THEME.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  appTitle: {
    color: THEME.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  metricCaption: {
    color: THEME.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  rangeTrack: {
    height: 6,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.surfaceElevated,
    marginTop: THEME.space.md,
    position: 'relative',
    overflow: 'hidden',
  },
  rangeWindow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: THEME.radius.pill,
  },
  batteryMarker: {
    position: 'absolute',
    top: -1,
    width: 4,
    height: 8,
    borderRadius: 2,
    backgroundColor: THEME.textPrimary,
  },
  nudgeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: THEME.space.md,
    height: 6,
  },
  nudgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.textMuted,
  },
  nudgeDotActive: { backgroundColor: THEME.accent },
  nudgeLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: THEME.surfaceElevated,
  },
  nudgeLineActive: { backgroundColor: THEME.accentBorder },
  footerText: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: THEME.space.sm,
  },
});
