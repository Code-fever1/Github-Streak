import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DashboardStatCard } from '@/components/DashboardStatCard';
import { StreakCard } from '@/components/StreakCard';
import { useProjects } from '@/context/ProjectsContext';
import { useClock } from '@/hooks/useClock';
import { confirmAction } from '@/lib/confirm';
import { isFastForwardError } from '@/lib/github';
import { isOfflineError } from '@/lib/offline';
import { commitsLeftToday, commitsMadeToday } from '@/lib/planner';
import { commitsOnDay, todayKeyLocal } from '@/lib/github-commits';
import { inPipelineCount } from '@/lib/pipeline-stats';
import { dayGreeting, timeAgo } from '@/lib/time-ago';
import type { ActivityLog, DailyPlan, Project } from '@/lib/types';

type ProjectRow = Project & { plan?: DailyPlan };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const {
    projects,
    loading,
    getPlan,
    quickCommit,
    removeProject,
    lastTicks,
    pending,
    logs,
    queue,
    pipeline,
    githubDays,
    githubHistoryLoading,
  } = useProjects();
  const { countdown } = useClock(projects, lastTicks);
  const [rows, setRows] = useState<ProjectRow[]>([]);

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

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.enabled).length;
    const inPipeline = inPipelineCount(pipeline, pending);
    const failed = queue
      .filter((j) => j.lastError && !isOfflineError(j.lastError) && !isFastForwardError(j.lastError))
      .reduce((sum, j) => sum + j.n, 0);
    const todayGithub = commitsOnDay(githubDays, todayKeyLocal());
    const window = logs.slice(0, 80);
    const successPct =
      window.length === 0 ? 100 : Math.round((window.filter((l) => l.success).length / window.length) * 100);
    return {
      active,
      inPipeline,
      failed,
      successPct,
      githubToday: todayGithub?.total ?? 0,
    };
  }, [projects, pending, pipeline, queue, logs, githubDays]);

  const pipelineBusy = useMemo(
    () => pipeline.some((row) => row.writing > 0 || row.waitingPush > 0 || row.pushing > 0) || pending > 0,
    [pipeline, pending],
  );

  const statusBadge = stats.failed > 0 ? 'Needs attention' : pipelineBusy ? 'Sending' : 'Operational';
  const statusTone = stats.failed > 0 ? styles.badgeWarn : styles.badgeOk;

  const recent = logs.slice(0, 4);

  const onQuickCommit = async (project: Project, count: number) => {
    await quickCommit(project, count);
  };

  const onDelete = async (project: Project) => {
    const ok = await confirmAction(
      `Delete ${project.name}?`,
      'Removes this repo from the app, its local SSH key, and any queued commits. GitHub is not changed.',
    );
    if (!ok) return;
    await removeProject(project.id);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3fb950" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            {dayGreeting()} <Text style={styles.wave}>👋</Text>
          </Text>
          <Text style={styles.subtitle}>Your personal command center</Text>
        </View>
        <Link href="/settings" asChild>
          <Pressable style={({ pressed }) => [styles.gearBtn, pressed && styles.pressed]}>
            <Text style={styles.gearIcon}>⚙</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.statGrid}>
        <DashboardStatCard tone="green" icon="⑂" value={pad2(stats.active)} label="Active projects" />
        <DashboardStatCard tone="purple" icon="⟳" value={pad2(Math.min(stats.inPipeline, 99))} label="Queued locally" />
        <DashboardStatCard tone="orange" icon="⚠" value={pad2(Math.min(stats.failed, 99))} label="Failed commits" />
        <DashboardStatCard
          tone="blue"
          icon="◎"
          value={githubHistoryLoading ? '…' : pad2(Math.min(stats.githubToday, 99))}
          label="On GitHub today"
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>System status</Text>
          <View style={[styles.statusPill, statusTone]}>
            <Text style={[styles.statusPillText, stats.failed > 0 ? styles.statusWarnText : styles.statusOkText]}>
              {statusBadge}
            </Text>
          </View>
        </View>
        <StatusRow label="GitHub scheduler" value={stats.active > 0 ? 'Running' : 'Idle'} ok={stats.active > 0} />
        <Divider />
        <StatusRow
          label="Commit pipeline"
          value={pipelineBusy ? 'Sending' : stats.inPipeline > 0 ? 'Queued' : 'Idle'}
          ok={stats.failed === 0}
        />
        <Divider />
        <StatusRow label="Next scheduled tick" value={countdown} ok highlight />
        <Divider />
        <StatusRow label="Daily reminders" value="12pm · 6pm · 11pm" ok muted />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Recent activity</Text>
          <Pressable onPress={() => router.push('/(tabs)/activity')} hitSlop={8}>
            <Text style={styles.viewAll}>VIEW ALL</Text>
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <Text style={styles.emptyActivity}>No commits yet today — add a repo to get started.</Text>
        ) : (
          recent.map((entry, i) => (
            <View key={entry.id}>
              {i > 0 ? <Divider /> : null}
              <ActivityRow entry={entry} />
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionLabel}>Your repos</Text>

      {projects.length === 0 ? (
        <View style={styles.emptyRepos}>
          <Text style={styles.emptyTitle}>No repo yet</Text>
          <Text style={styles.emptyText}>Paste a GitHub link and a personal access token with repo access.</Text>
          <Link href="/add-project" asChild>
            <Pressable style={styles.cta}>
              <Text style={styles.ctaText}>Add repo</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <>
          {rows.map((item) => (
            <View key={item.id} style={styles.repoBlock}>
              <Link href={`/project/${item.id}`} asChild>
                <Pressable style={({ pressed }) => pressed && styles.pressed}>
                  <StreakCard
                    project={item}
                    commitsToday={item.plan ? commitsMadeToday(item.plan) : 0}
                    commitsLeft={item.plan ? commitsLeftToday(item.plan) : 0}
                  />
                </Pressable>
              </Link>
              <View style={styles.actions}>
                <View style={styles.quickSplit}>
                  <Pressable style={styles.quickHalf} onPress={() => onQuickCommit(item, 1)}>
                    <Text style={styles.quickBtnText}>+1</Text>
                  </Pressable>
                  <View style={styles.quickDivider} />
                  <Pressable style={styles.quickHalf} onPress={() => onQuickCommit(item, 10)}>
                    <Text style={styles.quickBtnText}>+10</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.deleteBtn} onPress={() => onDelete(item)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Link href="/add-project" asChild>
            <Pressable style={styles.addRepoBtn}>
              <Text style={styles.addRepoText}>+ Add another repo</Text>
            </Pressable>
          </Link>
        </>
      )}
    </ScrollView>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function StatusRow({
  label,
  value,
  ok,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  ok?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  const valueStyle = muted
    ? styles.statusMuted
    : highlight
      ? styles.statusHighlight
      : ok
        ? styles.statusOk
        : styles.statusIdle;
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

function ActivityRow({ entry }: { entry: ActivityLog }) {
  const icon = entry.success ? '✓' : '⚠';
  const iconWrap = entry.success ? styles.activityIconOk : styles.activityIconWarn;
  const title = entry.success
    ? entry.manual
      ? 'Manual commit sent'
      : 'Scheduled commit sent'
    : 'Send failed';
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, iconWrap]}>
        <Text style={styles.activityIconText}>{icon}</Text>
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activitySub} numberOfLines={1}>
          {entry.projectName} · {entry.message || `${entry.commits} commit${entry.commits === 1 ? '' : 's'}`}
        </Text>
      </View>
      <Text style={styles.activityTime}>{timeAgo(entry.timestamp)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  content: { paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  headerText: { flex: 1, paddingRight: 12 },
  greeting: { color: '#f0f6fc', fontSize: 26, fontWeight: '800' },
  wave: { fontSize: 24 },
  subtitle: { color: '#8b949e', fontSize: 14, marginTop: 4 },
  gearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { color: '#8b949e', fontSize: 22 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  panel: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 16,
    marginBottom: 16,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { color: '#f0f6fc', fontSize: 16, fontWeight: '700' },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOk: { backgroundColor: '#23863633' },
  badgeWarn: { backgroundColor: '#d2992233' },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  statusOkText: { color: '#3fb950' },
  statusWarnText: { color: '#e3b341' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  statusLabel: { color: '#c9d1d9', fontSize: 14 },
  statusOk: { color: '#3fb950', fontWeight: '700', fontSize: 13 },
  statusIdle: { color: '#8b949e', fontWeight: '600', fontSize: 13 },
  statusHighlight: { color: '#58a6ff', fontWeight: '700', fontSize: 13, fontVariant: ['tabular-nums'] },
  statusMuted: { color: '#6e7681', fontSize: 12, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#30363d' },
  viewAll: { color: '#58a6ff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  emptyActivity: { color: '#6e7681', fontSize: 13, lineHeight: 18 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconOk: { backgroundColor: '#23863633' },
  activityIconWarn: { backgroundColor: '#d2992233' },
  activityIconText: { fontSize: 16, fontWeight: '700', color: '#e6edf3' },
  activityBody: { flex: 1 },
  activityTitle: { color: '#e6edf3', fontWeight: '700', fontSize: 13 },
  activitySub: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  activityTime: { color: '#6e7681', fontSize: 11 },
  sectionLabel: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 4,
  },
  repoBlock: { marginBottom: 4 },
  pressed: { opacity: 0.88 },
  actions: { flexDirection: 'row', gap: 8, marginTop: -4, marginBottom: 12 },
  quickSplit: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1f6feb',
    borderRadius: 10,
    overflow: 'hidden',
  },
  quickHalf: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDivider: { width: 1, backgroundColor: '#ffffff33', marginVertical: 6 },
  quickBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    paddingHorizontal: 16,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#f8514966',
  },
  deleteBtnText: { color: '#f85149', fontWeight: '700', fontSize: 13 },
  emptyRepos: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    marginBottom: 16,
  },
  emptyTitle: { color: '#e6edf3', fontSize: 20, fontWeight: '700' },
  emptyText: { color: '#8b949e', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  cta: {
    marginTop: 20,
    backgroundColor: '#238636',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  addRepoBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  addRepoText: { color: '#3fb950', fontWeight: '700' },
});
