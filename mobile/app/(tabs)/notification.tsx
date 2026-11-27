import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { LAYOUT, THEME } from '@/constants/theme';
import {
  fetchLaunchableApps,
  getRootMonitorStatus,
  installRootNotificationMonitor,
  isNotificationListenerEnabled,
  isRootMonitorInstalled,
  isSuAvailable,
  loadNotificationAlertSettings,
  onAppForeground,
  openNotificationListenerSettings,
  saveNotificationAlertSettings,
  stopNotificationAlert,
  testNotificationAlert,
  uninstallRootNotificationMonitor,
  type NotificationAlertSettings,
  type RootMonitorStatus,
  type UnreadDelayMinutes,
  type WatchedApp,
} from '@/lib/notification-alerts';

const FIVERR_APP: WatchedApp = { package: 'com.fiverr.fiverr', label: 'Fiverr' };

const MODES = [
  { id: 'alarm' as const, label: 'Alarm', hint: 'Loudest — uses alarm volume channel' },
  { id: 'ringtone' as const, label: 'Ringtone', hint: 'Continuous ring like an incoming call' },
  { id: 'notification' as const, label: 'Chime', hint: 'Short standard notification sound' },
];

const DELAYS: { id: UnreadDelayMinutes; label: string }[] = [
  { id: 1, label: '1 min' },
  { id: 10, label: '10 min' },
  { id: 30, label: '30 min' },
];

export default function NotificationScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationAlertSettings | null>(null);
  const [listenerOn, setListenerOn] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [appQuery, setAppQuery] = useState('');
  const [apps, setApps] = useState<WatchedApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [suOk, setSuOk] = useState(false);
  const [rootMon, setRootMon] = useState(false);
  const [rootStatus, setRootStatus] = useState<RootMonitorStatus | null>(null);
  const [rootBusy, setRootBusy] = useState(false);

  const isAndroid = Platform.OS === 'android';

  const refreshListener = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const [listener, su, rootMonitor, rStatus] = await Promise.all([
      isNotificationListenerEnabled(),
      isSuAvailable(),
      isRootMonitorInstalled(),
      getRootMonitorStatus(),
    ]);
    setListenerOn(listener);
    setSuOk(su);
    setRootMon(rootMonitor);
    setRootStatus(rStatus);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshListener();
    }, [refreshListener]),
  );

  useEffect(() => {
    loadNotificationAlertSettings()
      .then((s) => {
        setSettings(s);
        if (Platform.OS === 'android') saveNotificationAlertSettings(s).catch(() => {});
      })
      .finally(() => setLoading(false));
    refreshListener();
    return onAppForeground(() => refreshListener());
  }, [refreshListener]);

  const patch = async (next: NotificationAlertSettings) => {
    setSettings(next);
    await saveNotificationAlertSettings(next);
    await refreshListener();
  };

  const onToggleEnabled = async (enabled: boolean) => {
    if (!settings) return;
    if (enabled && isAndroid) {
      const ok = await isNotificationListenerEnabled();
      if (!ok) {
        Alert.alert(
          'Notification access',
          'Turn on notification access for Veyon to watch unread alerts from the apps you pick.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open settings', onPress: openNotificationListenerSettings },
          ],
        );
      }
      if (settings.watchedApps.length === 0) {
        Alert.alert('Pick apps', 'Add Fiverr or another app before enabling unread alerts.');
        return;
      }
    }
    await patch({ ...settings, enabled });
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setAppsLoading(true);
    try {
      const list = await fetchLaunchableApps();
      setApps(list);
    } finally {
      setAppsLoading(false);
    }
  };

  const filteredApps = useMemo(() => {
    const q = appQuery.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) => a.label.toLowerCase().includes(q) || a.package.toLowerCase().includes(q),
    );
  }, [apps, appQuery]);

  const addApp = async (app: WatchedApp) => {
    if (!settings) return;
    if (settings.watchedApps.some((w) => w.package === app.package)) {
      setPickerOpen(false);
      return;
    }
    await patch({ ...settings, watchedApps: [...settings.watchedApps, app] });
    setPickerOpen(false);
    setAppQuery('');
  };

  const removeApp = async (pkg: string) => {
    if (!settings) return;
    await patch({
      ...settings,
      watchedApps: settings.watchedApps.filter((w) => w.package !== pkg),
    });
  };

  if (loading || !settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={THEME.accent} />
      </View>
    );
  }

  const hasFiverr = settings.watchedApps.some((w) => w.package === FIVERR_APP.package);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + THEME.space.lg, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <Text style={styles.eyebrow}>ALERTS & REMINDERS</Text>
          <Text style={styles.screenTitle}>Notification</Text>
          <Text style={styles.screenSub}>
            Fiverr unread reminders and daily GitHub streak nudges
          </Text>

          <View style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={styles.panelTitle}>GitHub streak nudges</Text>
              <View style={styles.pillOk}>
                <View style={[styles.dot, { backgroundColor: THEME.accent }]} />
                <Text style={styles.pillOkText}>Scheduled</Text>
              </View>
            </View>
            <Text style={styles.panelSub}>
              If zero commits are recorded today, Veyon notifies at{' '}
              <Text style={styles.bold}>12:00</Text>, <Text style={styles.bold}>18:00</Text>, and{' '}
              <Text style={styles.bold}>23:00</Text> automatically in the background on Android.
            </Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.rowBetween}>
              <View style={styles.rowTitleBlock}>
                <Text style={styles.panelTitle}>Unread app alerts</Text>
                <Text style={styles.panelSub}>
                  Triggers your selected sound if a notification stays unread past the timer. Opening or clearing it cancels the alert.
                </Text>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={onToggleEnabled}
                trackColor={{ false: THEME.border, true: THEME.accent }}
                thumbColor={THEME.textPrimary}
              />
            </View>

            {!isAndroid ? (
              <View style={styles.previewBanner}>
                <Text style={styles.previewBannerText}>
                  Preview mode — notification listener and alarm sound playback run on Android. Changes here are saved to settings.
                </Text>
              </View>
            ) : (
              <>
                <View style={[styles.statusRow, listenerOn ? styles.statusOk : styles.statusWarn]}>
                  <Text style={styles.statusLabel}>Notification access</Text>
                  <Text style={[styles.statusValue, !listenerOn && styles.statusValueWarn]}>
                    {listenerOn ? 'Granted' : 'Required'}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                  onPress={openNotificationListenerSettings}
                >
                  <Text style={styles.secondaryBtnText}>
                    {listenerOn ? 'Open notification access settings' : 'Grant notification access'}
                  </Text>
                </Pressable>
              </>
            )}

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>WATCHED APPS</Text>
            {settings.watchedApps.length === 0 ? (
              <Text style={styles.emptyApps}>No apps watched yet.</Text>
            ) : (
              settings.watchedApps.map((app) => (
                <View key={app.package} style={styles.appRow}>
                  <View style={styles.appMeta}>
                    <Text style={styles.appLabel}>{app.label}</Text>
                    <Text style={styles.appPackage}>{app.package}</Text>
                  </View>
                  <Pressable
                    onPress={() => removeApp(app.package)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}

            <View style={styles.appActionsRow}>
              {!hasFiverr ? (
                <Pressable
                  style={({ pressed }) => [styles.quickAddChip, pressed && styles.pressed]}
                  onPress={() => addApp(FIVERR_APP)}
                >
                  <AppIcon name="plus" color={THEME.accent} size={13} />
                  <Text style={styles.quickAddText}>Add Fiverr</Text>
                </Pressable>
              ) : null}
              {isAndroid ? (
                <Pressable
                  style={({ pressed }) => [styles.secondaryBtnFlex, pressed && styles.pressed]}
                  onPress={openPicker}
                >
                  <Text style={styles.secondaryBtnText}>Pick installed app</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>UNREAD DELAY</Text>
            <View style={styles.delayRow}>
              {DELAYS.map((d) => {
                const active = settings.delayMinutes === d.id;
                return (
                  <Pressable
                    key={d.id}
                    style={({ pressed }) => [
                      styles.delayChip,
                      active && styles.delayChipOn,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => patch({ ...settings, delayMinutes: d.id })}
                  >
                    <Text style={[styles.delayChipText, active && styles.delayChipTextOn]}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>ALERT SOUND</Text>
            {MODES.map((mode) => {
              const active = settings.mode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  style={({ pressed }) => [
                    styles.modeRow,
                    active && styles.modeRowActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => patch({ ...settings, mode: mode.id })}
                >
                  <View style={styles.modeBody}>
                    <Text style={styles.modeLabel}>{mode.label}</Text>
                    <Text style={styles.modeHint}>{mode.hint}</Text>
                  </View>
                  <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                    {active ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}

            <View style={styles.rowBetween}>
              <Text style={styles.vibrateLabel}>Vibrate with sound</Text>
              <Switch
                value={settings.vibrate}
                onValueChange={(vibrate) => patch({ ...settings, vibrate })}
                trackColor={{ false: THEME.border, true: THEME.accent }}
                thumbColor={THEME.textPrimary}
              />
            </View>

            {isAndroid ? (
              <View style={styles.testRow}>
                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                  onPress={() => testNotificationAlert(settings)}
                >
                  <Text style={styles.primaryBtnText}>Test sound</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                  onPress={stopNotificationAlert}
                >
                  <Text style={styles.ghostBtnText}>Stop</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={styles.panelTitle}>Root monitor (Magisk)</Text>
              {isAndroid ? (
                <View style={rootStatus?.confirmed ? styles.pillOk : styles.pillWarn}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: rootStatus?.confirmed ? THEME.accent : THEME.warn },
                    ]}
                  />
                  <Text style={rootStatus?.confirmed ? styles.pillOkText : styles.pillWarnText}>
                    {rootStatus?.confirmed ? 'Confirmed · Running' : 'Not running'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.panelSub}>
              Runs from /data/adb/service.d/ and verifies heartbeats independently even when Veyon is completely closed.
            </Text>
            <View style={[styles.statusRow, isAndroid && suOk ? styles.statusOk : styles.statusNeutral]}>
              <Text style={styles.statusLabel}>Superuser</Text>
              <Text style={[styles.statusValue, (!isAndroid || !suOk) && styles.statusValueMuted]}>
                {isAndroid ? (suOk ? 'Available' : 'Not detected') : 'Android only'}
              </Text>
            </View>
            <View style={[styles.statusRow, isAndroid && rootMon ? styles.statusOk : styles.statusNeutral]}>
              <Text style={styles.statusLabel}>System script</Text>
              <Text style={[styles.statusValue, (!isAndroid || !rootMon) && styles.statusValueMuted]}>
                {isAndroid ? (rootMon ? 'Installed' : 'Off') : 'Android only'}
              </Text>
            </View>
            {isAndroid && rootStatus ? (
              <View style={styles.confirmBox}>
                <ConfirmRow label="Daemon PID" value={rootStatus.pid || '—'} />
                <ConfirmRow label="Status" value={rootStatus.status || '—'} />
                <ConfirmRow
                  label="Heartbeat"
                  value={rootStatus.heartbeatAgeSec >= 0 ? `${rootStatus.heartbeatAgeSec}s ago` : '—'}
                />
                <ConfirmRow
                  label="Watched"
                  value={rootStatus.watched.length > 0 ? rootStatus.watched.join(', ') : 'None'}
                />
                <ConfirmRow label="Active tray matches" value={String(rootStatus.activeMatches)} />
                {rootStatus.lastFiredPkg ? (
                  <ConfirmRow label="Last triggered" value={rootStatus.lastFiredPkg} />
                ) : null}
              </View>
            ) : null}
            {isAndroid ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (!suOk || rootBusy) && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                  disabled={!suOk || rootBusy}
                  onPress={async () => {
                    setRootBusy(true);
                    const ok = await installRootNotificationMonitor();
                    await refreshListener();
                    setRootBusy(false);
                    Alert.alert(
                      ok ? 'Confirmed & running' : 'Failed',
                      ok
                        ? 'Root monitor script is running and writing live heartbeats even with Veyon closed.'
                        : 'Could not start root monitor. Grant su to Veyon and try again.',
                    );
                  }}
                >
                  <Text style={styles.primaryBtnText}>
                    {rootBusy ? 'Syncing & verifying…' : 'Verify & sync script'}
                  </Text>
                </Pressable>
                {rootMon ? (
                  <Pressable
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                    onPress={async () => {
                      const ok = await uninstallRootNotificationMonitor();
                      await refreshListener();
                      Alert.alert(
                        ok ? 'Removed' : 'Failed',
                        ok ? 'Root monitor removed.' : 'Could not remove script.',
                      );
                    }}
                  >
                    <Text style={styles.ghostBtnText}>Remove root monitor</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={[styles.modal, { paddingTop: insets.top + THEME.space.lg }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apps on this phone</Text>
            <Pressable
              onPress={() => setPickerOpen(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.modalClose}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.modalSub}>Search Fiverr, WhatsApp, or any installed app.</Text>
          <TextInput
            style={styles.search}
            placeholder="Search apps…"
            placeholderTextColor={THEME.textMuted}
            value={appQuery}
            onChangeText={setAppQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {appsLoading ? (
            <ActivityIndicator color={THEME.accent} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={filteredApps}
              keyExtractor={(item) => item.package}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const picked = settings.watchedApps.some((w) => w.package === item.package);
                return (
                  <Pressable
                    style={[styles.pickerRow, picked && styles.pickerRowDisabled]}
                    onPress={() => addApp(item)}
                    disabled={picked}
                  >
                    <Text style={styles.pickerLabel}>{item.label}</Text>
                    <Text style={styles.pickerPackage}>{item.package}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmLabel}>{label}</Text>
      <Text style={styles.confirmValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.bg },
  eyebrow: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  screenTitle: { color: THEME.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  screenSub: { color: THEME.textSecondary, fontSize: 13, marginTop: 4, marginBottom: THEME.space.lg },
  bold: { color: THEME.textPrimary, fontWeight: '700' },
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.space.md,
  },
  rowTitleBlock: { flex: 1 },
  panelTitle: { color: THEME.textPrimary, fontSize: 16, fontWeight: '700' },
  panelSub: { color: THEME.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  pillOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.accentSoft,
    borderWidth: 1,
    borderColor: THEME.accentBorder,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillOkText: { color: THEME.accent, fontSize: 11, fontWeight: '600' },
  pillWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.warnSoft,
    borderWidth: 1,
    borderColor: THEME.warnBorder,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillWarnText: { color: THEME.warn, fontSize: 11, fontWeight: '600' },
  confirmBox: {
    backgroundColor: THEME.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.md,
    gap: 6,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  confirmLabel: { color: THEME.textMuted, fontSize: 12 },
  confirmValue: {
    color: THEME.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  previewBanner: {
    backgroundColor: THEME.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.md,
  },
  previewBannerText: { color: THEME.textSecondary, fontSize: 12, lineHeight: 18 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
  },
  statusOk: { backgroundColor: THEME.accentSoft, borderColor: THEME.accentBorder },
  statusWarn: { backgroundColor: THEME.warnSoft, borderColor: THEME.warnBorder },
  statusNeutral: { backgroundColor: THEME.surfaceElevated, borderColor: THEME.border },
  statusLabel: { color: THEME.textSecondary, fontSize: 13 },
  statusValue: { color: THEME.accent, fontWeight: '700', fontSize: 13 },
  statusValueWarn: { color: THEME.warn },
  statusValueMuted: { color: THEME.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: THEME.border },
  sectionLabel: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  emptyApps: { color: THEME.textMuted, fontSize: 13 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  appMeta: { flex: 1, paddingRight: 8 },
  appLabel: { color: THEME.textPrimary, fontWeight: '600', fontSize: 14 },
  appPackage: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  remove: { color: THEME.danger, fontWeight: '600', fontSize: 12 },
  appActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: THEME.space.sm },
  quickAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.accentSoft,
    borderWidth: 1,
    borderColor: THEME.accentBorder,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  quickAddText: { color: THEME.accent, fontWeight: '700', fontSize: 13 },
  secondaryBtn: {
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.surfaceElevated,
  },
  secondaryBtnFlex: {
    flex: 1,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.surfaceElevated,
  },
  secondaryBtnText: { color: THEME.info, fontWeight: '600', fontSize: 13 },
  delayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: THEME.space.sm },
  delayChip: {
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.surfaceElevated,
  },
  delayChipOn: { borderColor: THEME.accentBorder, backgroundColor: THEME.accentSoft },
  delayChipText: { color: THEME.textSecondary, fontSize: 13, fontWeight: '600' },
  delayChipTextOn: { color: THEME.accent, fontWeight: '700' },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: THEME.space.md,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.surfaceElevated,
    gap: THEME.space.md,
  },
  modeRowActive: { borderColor: THEME.accentBorder, backgroundColor: THEME.accentSoft },
  modeBody: { flex: 1 },
  modeLabel: { color: THEME.textPrimary, fontWeight: '700', fontSize: 14 },
  modeHint: { color: THEME.textSecondary, fontSize: 12, marginTop: 2 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.75,
    borderColor: THEME.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: THEME.accent },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.accent },
  vibrateLabel: { color: THEME.textPrimary, fontSize: 14, fontWeight: '600' },
  testRow: { flexDirection: 'row', gap: THEME.space.sm, marginTop: 4 },
  primaryBtn: {
    flex: 1,
    backgroundColor: THEME.accent,
    borderRadius: THEME.radius.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#052E16', fontWeight: '700', fontSize: 14 },
  ghostBtn: {
    paddingHorizontal: 20,
    borderRadius: THEME.radius.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.surfaceElevated,
  },
  ghostBtnText: { color: THEME.textSecondary, fontWeight: '600', fontSize: 13 },
  btnDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
  modal: { flex: 1, backgroundColor: THEME.bg, paddingHorizontal: THEME.space.lg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalSub: { color: THEME.textSecondary, fontSize: 12, marginBottom: THEME.space.md },
  modalTitle: { color: THEME.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { color: THEME.info, fontWeight: '700', fontSize: 14 },
  search: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: THEME.textPrimary,
    marginBottom: THEME.space.md,
  },
  pickerRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  pickerRowDisabled: { opacity: 0.45 },
  pickerLabel: { color: THEME.textPrimary, fontWeight: '600', fontSize: 15 },
  pickerPackage: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
});
