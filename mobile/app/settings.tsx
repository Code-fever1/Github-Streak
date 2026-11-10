import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isNotificationListenerEnabled,
  loadFiverrAlertSettings,
  onAppForeground,
  openNotificationListenerSettings,
  saveFiverrAlertSettings,
  stopFiverrAlert,
  testFiverrAlert,
  type FiverrAlertMode,
  type FiverrAlertSettings,
} from '@/lib/fiverr-alerts';

const MODES: { id: FiverrAlertMode; label: string; hint: string }[] = [
  { id: 'alarm', label: 'Alarm', hint: 'Loudest — uses the alarm volume stream' },
  { id: 'ringtone', label: 'Ringtone', hint: 'Like an incoming call' },
  { id: 'notification', label: 'Chime', hint: 'Short notification sound' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<FiverrAlertSettings | null>(null);
  const [listenerOn, setListenerOn] = useState(false);

  const refreshListener = useCallback(async () => {
    setListenerOn(await isNotificationListenerEnabled());
  }, []);

  useEffect(() => {
    loadFiverrAlertSettings()
      .then((s) => {
        setSettings(s);
        if (Platform.OS === 'android') saveFiverrAlertSettings(s).catch(() => {});
      })
      .finally(() => setLoading(false));
    refreshListener();
    return onAppForeground(() => refreshListener());
  }, [refreshListener]);

  const patch = async (next: FiverrAlertSettings) => {
    setSettings(next);
    await saveFiverrAlertSettings(next);
  };

  const onToggleEnabled = async (enabled: boolean) => {
    if (!settings) return;
    if (enabled && Platform.OS === 'android') {
      const ok = await isNotificationListenerEnabled();
      if (!ok) {
        Alert.alert(
          'Notification access',
          'Turn on notification access for Veyon so it can hear Fiverr alerts and play a sound.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open settings', onPress: openNotificationListenerSettings },
          ],
        );
      }
    }
    await patch({ ...settings, enabled });
  };

  if (loading || !settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3fb950" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
      >
        <Text style={styles.lead}>Automations</Text>

        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <View style={styles.rowTitleBlock}>
              <Text style={styles.panelTitle}>Fiverr alert mode</Text>
              <Text style={styles.panelSub}>
                When the Fiverr app posts a notification, play a sound so you do not miss messages or orders.
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={onToggleEnabled}
              trackColor={{ false: '#30363d', true: '#238636' }}
              thumbColor="#f0f6fc"
            />
          </View>

          {Platform.OS !== 'android' ? (
            <Text style={styles.warn}>Fiverr alerts require the Android app (notification listener).</Text>
          ) : (
            <>
              <View style={[styles.statusRow, listenerOn ? styles.statusOk : styles.statusWarn]}>
                <Text style={styles.statusLabel}>Notification access</Text>
                <Text style={styles.statusValue}>{listenerOn ? 'Granted' : 'Required'}</Text>
              </View>
              <Pressable style={styles.secondaryBtn} onPress={openNotificationListenerSettings}>
                <Text style={styles.secondaryBtnText}>
                  {listenerOn ? 'Open notification access settings' : 'Grant notification access'}
                </Text>
              </Pressable>

              <Text style={styles.sectionLabel}>Sound</Text>
              {MODES.map((mode) => (
                <Pressable
                  key={mode.id}
                  style={[styles.modeRow, settings.mode === mode.id && styles.modeRowActive]}
                  onPress={() => patch({ ...settings, mode: mode.id })}
                >
                  <View>
                    <Text style={styles.modeLabel}>{mode.label}</Text>
                    <Text style={styles.modeHint}>{mode.hint}</Text>
                  </View>
                  <Text style={styles.modeCheck}>{settings.mode === mode.id ? '●' : '○'}</Text>
                </Pressable>
              ))}

              <View style={styles.rowBetween}>
                <Text style={styles.vibrateLabel}>Vibrate with sound</Text>
                <Switch
                  value={settings.vibrate}
                  onValueChange={(vibrate) => patch({ ...settings, vibrate })}
                  trackColor={{ false: '#30363d', true: '#238636' }}
                  thumbColor="#f0f6fc"
                />
              </View>

              <View style={styles.testRow}>
                <Pressable style={styles.primaryBtn} onPress={() => testFiverrAlert(settings)}>
                  <Text style={styles.primaryBtnText}>Test sound</Text>
                </Pressable>
                <Pressable style={styles.ghostBtn} onPress={stopFiverrAlert}>
                  <Text style={styles.ghostBtnText}>Stop</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Repos</Text>
          <Text style={styles.panelSub}>Add or manage GitHub streak projects.</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/add-project')}>
            <Text style={styles.secondaryBtnText}>Add GitHub repo</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' },
  lead: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 12,
  },
  panel: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitleBlock: { flex: 1 },
  panelTitle: { color: '#f0f6fc', fontSize: 16, fontWeight: '700' },
  panelSub: { color: '#8b949e', fontSize: 13, lineHeight: 18, marginTop: 4 },
  warn: { color: '#e3b341', fontSize: 13, lineHeight: 18 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  statusOk: { backgroundColor: '#23863622' },
  statusWarn: { backgroundColor: '#d2992222' },
  statusLabel: { color: '#c9d1d9', fontSize: 13 },
  statusValue: { color: '#3fb950', fontWeight: '700', fontSize: 13 },
  secondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#21262d',
  },
  secondaryBtnText: { color: '#58a6ff', fontWeight: '700', fontSize: 13 },
  sectionLabel: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  modeRowActive: { borderColor: '#3fb950', backgroundColor: '#0f1f14' },
  modeLabel: { color: '#e6edf3', fontWeight: '700', fontSize: 14 },
  modeHint: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  modeCheck: { color: '#3fb950', fontSize: 18 },
  vibrateLabel: { color: '#e6edf3', fontSize: 14, fontWeight: '600' },
  testRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#238636',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  ghostBtn: {
    paddingHorizontal: 20,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  ghostBtnText: { color: '#8b949e', fontWeight: '700' },
});
