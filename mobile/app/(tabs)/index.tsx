import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { DashboardModulesGrid } from '@/components/DashboardModulesGrid';
import { RamUsageBar } from '@/components/RamUsageBar';
import { StreakCard } from '@/components/StreakCard';
import { StreakHeroCard } from '@/components/StreakHeroCard';
import { LAYOUT, THEME } from '@/constants/theme';
import { useProjects } from '@/context/ProjectsContext';
import { useClock } from '@/hooks/useClock';
import { isFastForwardError } from '@/lib/github';
import { computeStreakSummary } from '@/lib/github-commits';
import { isOfflineError } from '@/lib/offline';
import { inPipelineCount } from '@/lib/pipeline-stats';
import { commitsLeftToday, commitsMadeToday } from '@/lib/planner';
import { dayGreeting, timeAgo } from '@/lib/time-ago';
import type { ActivityLog, DailyPlan, Project } from '@/lib/types';

type ProjectRow = Project & { plan?: DailyPlan };

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatShortDate(d = new Date()): string {
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const {
    projects,
    loading,
    getPlan,
    quickCommit,
    refresh,
    lastTicks,
    pending,
    logs,
    queue,
    pipeline,
    githubDays,
    githubHistoryLoading,
    githubHistoryError,
    refreshGithubHistory,
  } = useProjects();

  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modulesRefreshKey, setModulesRefreshKey] = useState(0);

  const loadPlans = useCallback(async () => {
    const enriched = await Promise.all(projects.map(async (p) => ({ ...p, plan: await getPlan(p) })));
    setRows(enriched);
  }, [projects, getPlan]);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans]),
  );

  useEffect(() => {
    loadPlans();
  }, [loadPlans, pending, logs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), loadPlans(), refreshGithubHistory(true).catch(() => {})]);
      setModulesRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, loadPlans, refreshGithubHistory]);

  const streakSummary = useMemo(() => computeStreakSummary(githubDays), [githubDays]);

  const planTotals = useMemo(() => {
    let plannedMade = 0;
    let plannedTarget = 0;
    let plannedLeft = 0;
    for (const row of rows) {
      if (!row.enabled || !row.plan) continue;
      plannedMade += commitsMadeToday(row.plan);
      plannedTarget += row.plan.target;
      plannedLeft += commitsLeftToday(row.plan);
    }
    return { plannedMade, plannedTarget, plannedLeft };
  }, [rows]);

  const pipelineBreakdown = useMemo(() => {
    let writing = 0;
    let pushing = 0;
    let queued = 0;
    const queuedByProject = new Map<string, number>();

    for (const row of pipeline) {
      const rowPush = row.waitingPush + row.pushing;
      writing += row.writing;
      pushing += rowPush;
      queued += row.queued;
      const rowTotal = row.queued + row.writing + rowPush;
      if (rowTotal > 0) queuedByProject.set(row.projectId, rowTotal);
    }

    if (queuedByProject.size === 0 && pending > 0) {
      for (const job of queue) {
        if (job.lastError || job.n <= 0) continue;
        queuedByProject.set(job.projectId, (queuedByProject.get(job.projectId) ?? 0) + job.n);
      }
    }

    const failedByProject = new Map<string, number>();
    let failedTotal = 0;
    for (const job of queue) {
      if (!job.lastError || isOfflineError(job.lastError) || isFastForwardError(job.lastError)) continue;
      failedTotal += job.n;
      failedByProject.set(job.projectId, (failedByProject.get(job.projectId) ?? 0) + job.n);
    }

    return { writing, pushing, queued, queuedByProject, failedByProject, failedTotal };
  }, [pipeline, queue, pending]);

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.enabled).length;
    const inPipeline = inPipelineCount(pipeline, pending);
    const failed = pipelineBreakdown.failedTotal;
    const windowLogs = logs.slice(0, 80);
    const successPct =
      windowLogs.length === 0
        ? 100
        : Math.round((windowLogs.filter((l) => l.success).length / windowLogs.length) * 100);
    return { active, inPipeline, failed, successPct };
  }, [projects, pipeline, pending, pipelineBreakdown.failedTotal, logs]);

  const pipelineBusy = useMemo(
    () =>
      pipelineBreakdown.writing > 0 ||
      pipelineBreakdown.pushing > 0 ||
      pipelineBreakdown.queued > 0 ||
      pending > 0,
    [pipelineBreakdown, pending],
  );

  const statusPill = useMemo(() => {
    if (stats.failed > 0) return { label: 'Attention', tone: 'warn' as const };
    if (pipelineBusy) return { label: 'Sending', tone: 'work' as const };
    return { label: 'Ready', tone: 'ok' as const };
  }, [stats.failed, pipelineBusy]);

  const shortDate = useMemo(() => formatShortDate(), []);
  const recent = logs.slice(0, 4);

  if (loading && projects.length === 0 && logs.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={THEME.accent} />
        <Text style={styles.loadingHint}>Loading workspace…</Text>
      </View>
    );
  }

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
          onRefresh={onRefresh}
          tintColor={THEME.accent}
          colors={[THEME.accent]}
          progressBackgroundColor={THEME.surface}
        />
      }
    >
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>VEYON · {shortDate}</Text>
            <Text style={styles.greeting}>{dayGreeting()}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/github')}
            style={({ pressed }) => [
              styles.statusPill,
              statusPill.tone === 'warn'
                ? styles.pillWarn
                : statusPill.tone === 'work'
                  ? styles.pillPurple
                  : styles.pillOk,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`System status: ${statusPill.label}`}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    statusPill.tone === 'warn'
                      ? THEME.warn
                      : statusPill.tone === 'work'
                        ? THEME.purple
                        : THEME.accent,
                },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                statusPill.tone === 'warn'
                  ? styles.pillWarnText
                  : statusPill.tone === 'work'
                    ? styles.pillPurpleText
                    : styles.pillOkText,
              ]}
            >
              {statusPill.label}
            </Text>
          </Pressable>
        </View>

        <StreakHeroCard
          summary={streakSummary}
          loading={githubHistoryLoading}
          error={githubHistoryError}
          plannedMade={planTotals.plannedMade}
          plannedTarget={planTotals.plannedTarget}
          plannedLeft={planTotals.plannedLeft}
          hasProjects={projects.length > 0}
          onOpenCalendar={() => router.push('/(tabs)/github')}
          onRetryHistory={() => {
            refreshGithubHistory(true).catch(() => {});
          }}
          footer={
            <View style={styles.schedulerFooter}>
              <View style={styles.schedulerLeft}>
                <Text style={styles.schedulerLabel}>Scheduler</Text>
                <View
                  style={[
                    styles.miniBadge,
                    stats.active > 0 ? styles.pillOk : styles.pillMuted,
                  ]}
                >
                  <Text
                    style={[
                      styles.miniBadgeText,
                      stats.active > 0 ? styles.pillOkText : styles.pillMutedText,
                    ]}
                  >
                    {stats.active > 0 ? 'Running' : 'Idle'}
                  </Text>
                </View>
              </View>
              <View style={styles.tickRight}>
                <Text style={styles.tickHint}>Next tick</Text>
                <NextTick projects={projects} lastTicks={lastTicks} />
              </View>
            </View>
          }
        />

        <DashboardModulesGrid
          refreshKey={modulesRefreshKey}
          onOpenCharge={() => router.push('/(tabs)/charge')}
          onOpenNotifications={() => router.push('/(tabs)/notification')}
        />

        <RamUsageBar refreshKey={modulesRefreshKey} />

        <View style={styles.metrics}>
          <Metric value={`${stats.active}/${projects.length}`} label="Active" />
          <MetricDivider />
          <Metric
            value={pad2(Math.min(stats.inPipeline, 99))}
            label="Queued"
            tone={stats.inPipeline > 0 ? 'purple' : 'default'}
            onPress={() => router.push('/(tabs)/github')}
          />
          <MetricDivider />
          <Metric
            value={pad2(Math.min(stats.failed, 99))}
            label="Failed"
            tone={stats.failed > 0 ? 'warn' : 'default'}
            onPress={() => router.push('/(tabs)/github')}
          />
          <MetricDivider />
          <Metric
            value={`${stats.successPct}%`}
            label="Success"
            tone={stats.successPct >= 90 ? 'ok' : 'warn'}
          />
        </View>

        {stats.failed > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.bannerWarn, pressed && styles.pressed]}
            onPress={() => router.push('/(tabs)/github')}
          >
            <Text style={styles.bannerWarnText}>
              {stats.failed} failed commit{stats.failed === 1 ? '' : 's'} — Open GitHub pipeline to retry
            </Text>
            <AppIcon name="chevron" color={THEME.danger} size={14} />
          </Pressable>
        ) : pipelineBusy ? (
          <Pressable
            style={({ pressed }) => [styles.bannerWork, pressed && styles.pressed]}
            onPress={() => router.push('/(tabs)/github')}
          >
            <Text style={styles.bannerWorkText}>
              Writing {pipelineBreakdown.writing} · Pushing {pipelineBreakdown.pushing} · Queued{' '}
              {pipelineBreakdown.queued > 0 ? pipelineBreakdown.queued : pending}
            </Text>
            <AppIcon name="chevron" color={THEME.purple} size={14} />
          </Pressable>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>REPOSITORIES ({projects.length})</Text>
          <Link href="/add-project" asChild>
            <Pressable
              style={({ pressed }) => [styles.addPill, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="plus" color={THEME.accent} size={12} />
              <Text style={styles.addPillText}>Add</Text>
            </Pressable>
          </Link>
        </View>

        {projects.length === 0 ? (
          <View style={styles.emptyRepos}>
            <Text style={styles.emptyTitle}>No repository connected</Text>
            <Text style={styles.emptyText}>
              Link a GitHub repository with a personal access token to start tracking daily commits.
            </Text>
            <Link href="/add-project" asChild>
              <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                <Text style={styles.ctaText}>Connect repository</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          rows.map((item) => (
            <View key={item.id} style={styles.repoBlock}>
              <Link href={`/project/${item.id}`} asChild>
                <Pressable style={({ pressed }) => pressed && styles.pressed}>
                  <StreakCard
                    project={item}
                    commitsToday={item.plan ? commitsMadeToday(item.plan) : 0}
                    commitsLeft={item.plan ? commitsLeftToday(item.plan) : 0}
                    target={item.plan?.target}
                    isQuiet={item.plan?.isQuiet}
                    queuedCount={pipelineBreakdown.queuedByProject.get(item.id) ?? 0}
                    failedCount={pipelineBreakdown.failedByProject.get(item.id) ?? 0}
                  />
                </Pressable>
              </Link>
              <View style={styles.quickBar}>
                <Pressable
                  style={({ pressed }) => [styles.quickBtn, pressed && styles.quickPressed]}
                  onPress={() => quickCommit(item, 1)}
                >
                  <Text style={styles.quickBtnText}>+1 Commit</Text>
                </Pressable>
                <View style={styles.quickDivider} />
                <Pressable
                  style={({ pressed }) => [styles.quickBtn, pressed && styles.quickPressed]}
                  onPress={() => quickCommit(item, 10)}
                >
                  <Text style={styles.quickBtnText}>+10 Batch</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/github')}
            style={({ pressed }) => [styles.viewAllRow, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.viewAll}>View all</Text>
            <AppIcon name="chevron" color={THEME.info} size={13} />
          </Pressable>
        </View>

        <View style={styles.panel}>
          {recent.length === 0 ? (
            <Text style={styles.emptyActivity}>
              No commits logged yet — tap +1 Commit on a repository or wait for the next scheduled tick.
            </Text>
          ) : (
            recent.map((entry, i) => (
              <View key={entry.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <ActivityRow entry={entry} />
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const NextTick = memo(function NextTick({
  projects,
  lastTicks,
}: {
  projects: Project[];
  lastTicks: Record<string, string | null>;
}) {
  const { countdown } = useClock(projects, lastTicks);
  return <Text style={styles.tickValue}>{countdown}</Text>;
});

function Metric({
  value,
  label,
  tone = 'default',
  onPress,
}: {
  value: string;
  label: string;
  tone?: 'default' | 'ok' | 'warn' | 'purple';
  onPress?: () => void;
}) {
  const valueStyle =
    tone === 'ok'
      ? styles.metricOk
      : tone === 'warn'
        ? styles.metricWarn
        : tone === 'purple'
          ? styles.metricPurple
          : undefined;

  const inner = (
    <>
      <Text style={[styles.metricValue, valueStyle]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.metric, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.metric}>{inner}</View>;
}

function MetricDivider() {
  return <View style={styles.metricDivider} />;
}

function ActivityRow({ entry }: { entry: ActivityLog }) {
  const title = entry.success
    ? entry.manual
      ? 'Manual commit sent'
      : 'Scheduled commit sent'
    : 'Send failed';
  return (
    <View style={styles.activityRow}>
      <View
        style={[
          styles.activityIcon,
          entry.success ? styles.activityIconOk : styles.activityIconWarn,
        ]}
      >
        <AppIcon
          name={entry.success ? 'check' : 'alert'}
          color={entry.success ? THEME.accent : THEME.warn}
          size={15}
        />
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activitySub} numberOfLines={1}>
          {entry.projectName} ·{' '}
          {entry.message || `${entry.commits} commit${entry.commits === 1 ? '' : 's'}`}
        </Text>
      </View>
      <Text style={styles.activityTime}>{timeAgo(entry.timestamp)}</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.bg,
  },
  loadingHint: { color: THEME.textSecondary, marginTop: THEME.space.md, fontSize: 13 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.space.lg,
    gap: THEME.space.md,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  greeting: { color: THEME.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 34,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  pillOk: { backgroundColor: THEME.accentSoft, borderColor: THEME.accentBorder },
  pillWarn: { backgroundColor: THEME.warnSoft, borderColor: THEME.warnBorder },
  pillPurple: { backgroundColor: THEME.purpleSoft, borderColor: THEME.purpleBorder },
  pillMuted: { backgroundColor: THEME.surfaceElevated, borderColor: THEME.border },
  pillOkText: { color: THEME.accent },
  pillWarnText: { color: THEME.warn },
  pillPurpleText: { color: THEME.purple },
  pillMutedText: { color: THEME.textSecondary },
  schedulerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.space.sm,
  },
  schedulerLeft: { flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm },
  schedulerLabel: { color: THEME.textSecondary, fontSize: 12, fontWeight: '600' },
  miniBadge: {
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  miniBadgeText: { fontSize: 11, fontWeight: '600' },
  tickRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tickHint: { color: THEME.textMuted, fontSize: 12, fontWeight: '500' },
  tickValue: {
    color: THEME.info,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: THEME.space.md,
  },
  metric: { flex: 1, alignItems: 'center', paddingVertical: THEME.space.md, minHeight: 56 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: THEME.border },
  metricValue: {
    color: THEME.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricOk: { color: THEME.accent },
  metricWarn: { color: THEME.warn },
  metricPurple: { color: THEME.purple },
  metricLabel: { color: THEME.textMuted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  bannerWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.space.sm,
    backgroundColor: THEME.dangerSoft,
    borderWidth: 1,
    borderColor: THEME.dangerBorder,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.space.md,
    paddingVertical: 11,
    marginBottom: THEME.space.lg,
  },
  bannerWarnText: { color: THEME.danger, fontSize: 12, fontWeight: '600', flex: 1 },
  bannerWork: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.space.sm,
    backgroundColor: THEME.purpleSoft,
    borderWidth: 1,
    borderColor: THEME.purpleBorder,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.space.md,
    paddingVertical: 11,
    marginBottom: THEME.space.lg,
  },
  bannerWorkText: { color: THEME.purple, fontSize: 12, fontWeight: '600', flex: 1 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: THEME.space.sm,
    marginBottom: THEME.space.sm + 2,
  },
  sectionLabel: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.accentSoft,
    borderWidth: 1,
    borderColor: THEME.accentBorder,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  addPillText: { color: THEME.accent, fontSize: 12, fontWeight: '600' },
  repoBlock: { marginBottom: THEME.space.md },
  pressed: { opacity: 0.78 },
  quickBar: {
    flexDirection: 'row',
    backgroundColor: THEME.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: 'hidden',
  },
  quickBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPressed: { backgroundColor: THEME.surfacePressed },
  quickDivider: { width: StyleSheet.hairlineWidth, backgroundColor: THEME.border, marginVertical: 8 },
  quickBtnText: { color: THEME.textPrimary, fontWeight: '600', fontSize: 13 },
  emptyRepos: {
    padding: THEME.space.xl,
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: THEME.space.lg,
  },
  emptyTitle: { color: THEME.textPrimary, fontSize: 17, fontWeight: '700' },
  emptyText: {
    color: THEME.textSecondary,
    textAlign: 'center',
    marginTop: THEME.space.sm,
    lineHeight: 20,
    fontSize: 13,
  },
  cta: {
    marginTop: THEME.space.lg,
    backgroundColor: THEME.accent,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: THEME.radius.md,
  },
  ctaText: { color: '#052E16', fontWeight: '700', fontSize: 14 },
  viewAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAll: { color: THEME.info, fontSize: 12, fontWeight: '600' },
  panel: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.lg,
    marginBottom: THEME.space.md,
  },
  emptyActivity: { color: THEME.textSecondary, fontSize: 13, lineHeight: 19 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: THEME.border },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, paddingVertical: 10 },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  activityIconOk: { backgroundColor: THEME.accentSoft, borderColor: THEME.accentBorder },
  activityIconWarn: { backgroundColor: THEME.warnSoft, borderColor: THEME.warnBorder },
  activityBody: { flex: 1 },
  activityTitle: { color: THEME.textPrimary, fontWeight: '600', fontSize: 13 },
  activitySub: { color: THEME.textSecondary, fontSize: 12, marginTop: 2 },
  activityTime: { color: THEME.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
});
