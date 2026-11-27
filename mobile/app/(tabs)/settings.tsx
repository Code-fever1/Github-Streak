import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { LAYOUT, THEME } from '@/constants/theme';
import { useProjects } from '@/context/ProjectsContext';
import { isSuAvailable } from '@/lib/notification-alerts';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { projects, githubHistoryLoading, refreshGithubHistory } = useProjects();
  const [suOk, setSuOk] = useState(false);

  const isAndroid = Platform.OS === 'android';

  const checkRoot = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    setSuOk(await isSuAvailable());
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkRoot();
    }, [checkRoot]),
  );

  useEffect(() => {
    checkRoot();
  }, [checkRoot]);

  const activeCount = projects.filter((p) => p.enabled).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + THEME.space.lg, paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>SYSTEM & PREFERENCES</Text>
        <Text style={styles.screenTitle}>Settings</Text>
        <Text style={styles.screenSub}>Repositories, shortcuts, and app info</Text>

        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>Repositories</Text>
            <Text style={styles.countBadge}>
              {activeCount}/{projects.length} active
            </Text>
          </View>
          <Text style={styles.panelSub}>
            Connect repositories with personal access tokens or refresh commit branch telemetry.
          </Text>
          <View style={styles.btnGroup}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => router.push('/add-project')}
            >
              <Text style={styles.primaryBtnText}>Add GitHub repository</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() => refreshGithubHistory(true).catch(() => {})}
              disabled={githubHistoryLoading}
            >
              <Text style={styles.secondaryBtnText}>
                {githubHistoryLoading ? 'Syncing history…' : 'Sync GitHub history'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionLabel}>QUICK SECTIONS</Text>
        <View style={styles.navPanel}>
          <NavRow
            icon="github"
            title="GitHub & Pipeline"
            subtitle="Commit calendar, repositories, and queue"
            onPress={() => router.push('/(tabs)/github')}
          />
          <View style={styles.divider} />
          <NavRow
            icon="charge"
            title="Charge Limit"
            subtitle="Battery window and hardware root control"
            onPress={() => router.push('/(tabs)/charge')}
          />
          <View style={styles.divider} />
          <NavRow
            icon="notification"
            title="Notification Alerts"
            subtitle="Fiverr unread reminders and streak nudges"
            onPress={() => router.push('/(tabs)/notification')}
          />
        </View>

        <Text style={styles.sectionLabel}>SYSTEM & ABOUT</Text>
        <View style={styles.panel}>
          <InfoRow label="App" value="Veyon" />
          <View style={styles.divider} />
          <InfoRow label="Version" value="3.0.0" />
          <View style={styles.divider} />
          <InfoRow label="Package" value="com.streakkeeper.mobile" />
          <View style={styles.divider} />
          <InfoRow label="Platform" value={Platform.OS} />
          {isAndroid ? (
            <>
              <View style={styles.divider} />
              <InfoRow
                label="Root access (su)"
                value={suOk ? 'Granted' : 'Not granted'}
                tone={suOk ? 'ok' : 'warn'}
              />
            </>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function NavRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: 'github' | 'charge' | 'notification';
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navRow, pressed && styles.navPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.navIconBox}>
        <AppIcon name={icon} color={THEME.textSecondary} size={18} />
      </View>
      <View style={styles.navBody}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navSub}>{subtitle}</Text>
      </View>
      <AppIcon name="chevron" color={THEME.textMuted} size={16} />
    </Pressable>
  );
}

function InfoRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'ok' | 'warn';
}) {
  const valueStyle =
    tone === 'ok' ? styles.infoOk : tone === 'warn' ? styles.infoWarn : undefined;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
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
  eyebrow: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  screenTitle: { color: THEME.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  screenSub: { color: THEME.textSecondary, fontSize: 13, marginTop: 4, marginBottom: THEME.space.lg },
  panel: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.lg,
    marginBottom: THEME.space.lg,
    gap: THEME.space.md,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: THEME.textPrimary, fontSize: 16, fontWeight: '700' },
  countBadge: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  panelSub: { color: THEME.textSecondary, fontSize: 12, lineHeight: 18 },
  btnGroup: { gap: THEME.space.sm },
  primaryBtn: {
    backgroundColor: THEME.accent,
    borderRadius: THEME.radius.md,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#052E16', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.surfaceElevated,
  },
  secondaryBtnText: { color: THEME.info, fontWeight: '600', fontSize: 13 },
  pressed: { opacity: 0.78 },
  sectionLabel: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: THEME.space.sm,
  },
  navPanel: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: 'hidden',
    marginBottom: THEME.space.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.space.lg,
    gap: THEME.space.md,
    minHeight: 64,
  },
  navPressed: { backgroundColor: THEME.surfacePressed },
  navIconBox: {
    width: 34,
    height: 34,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBody: { flex: 1 },
  navTitle: { color: THEME.textPrimary, fontSize: 14, fontWeight: '600' },
  navSub: { color: THEME.textSecondary, fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: THEME.border },
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
});
