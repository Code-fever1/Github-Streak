import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { CommitCalendar } from '@/components/CommitCalendar';
import { StreakCard } from '@/components/StreakCard';
import { LAYOUT, THEME } from '@/constants/theme';
import { useProjects } from '@/context/ProjectsContext';
import { confirmAction } from '@/lib/confirm';
import { isFastForwardError } from '@/lib/github';
import { isOfflineError } from '@/lib/offline';
import type { PipelineSnapshot } from '@/lib/pipeline';
import { inPipelineCount } from '@/lib/pipeline-stats';
import { commitsLeftToday, commitsMadeToday } from '@/lib/planner';
import type { QueuedJob } from '@/lib/storage';
import type { ActivityLog, DailyPlan, Project } from '@/lib/types';

type Phase = 'queued' | 'committing' | 'committed' | 'failed';
type ProjectRow = Project & { plan?: DailyPlan };

const PHASE_ORDER: Phase[] = ['queued', 'committing', 'committed', 'failed'];

const PHASE_COPY: Record<Phase, { title: string; hint: string; tone: 'work' | 'wait' | 'done' | 'fail' }> = {
  queued: { title: 'Queued', hint: 'Waiting to write commit object', tone: 'wait' },
  committing: { title: 'Writing', hint: 'Creating next commit object', tone: 'work' },
  committed: { title: 'Pushing', hint: 'Pushing commits sequentially', tone: 'done' },
  failed: { title: 'Failed', hint: 'Grouped by error · Retry or delete', tone: 'fail' },
};

function plus(n: number): string {
  return `+${n}`;
}

interface QueueGroup {
  key: string;
  phase: Phase;
  projectId: string;
  projectName: string;
  n: number;
  ids: string[];
  error?: string;
}

function groupsFromPipeline(pipeline: PipelineSnapshot[]): QueueGroup[] {
  const groups: QueueGroup[] = [];
  for (const row of pipeline) {
    if (row.queued > 0) {
      groups.push({
        key: `queued|${row.projectId}`,
        phase: 'queued',
        projectId: row.projectId,
        projectName: row.projectName,
        n: row.queued,
        ids: [],
      });
    }
    if (row.writing > 0) {
      groups.push({
        key: `committing|${row.projectId}`,
        phase: 'committing',
        projectId: row.projectId,
        projectName: row.projectName,
        n: row.writing,
        ids: [],
      });
    }
    const committed = row.waitingPush + row.pushing;
    if (committed > 0) {
      groups.push({
        key: `committed|${row.projectId}`,
        phase: 'committed',
        projectId: row.projectId,
        projectName: row.projectName,
        n: committed,
        ids: [],
      });
    }
  }
  return groups;
}

function groupsFromFailed(jobs: QueuedJob[]): QueueGroup[] {
  const map = new Map<string, QueueGroup>();
  for (const job of jobs) {
    if (!job.lastError || isOfflineError(job.lastError) || isFastForwardError(job.lastError)) continue;
    const key = `${job.projectId}|${job.lastError}`;
    const existing = map.get(key);
    if (existing) {
      existing.n += job.n;
      existing.ids.push(job.id);
    } else {
      map.set(key, {
        key,
        phase: 'failed',
        projectId: job.projectId,
        projectName: job.projectName || job.projectId,
        n: job.n,
        ids: [job.id],
        error: job.lastError,
      });
    }
  }
  return [...map.values()];
}

interface SentGroup {
  key: string;
  projectName: string;
  commits: number;
  timestamp: string;
  manual: boolean;
}

function groupSent(logs: ActivityLog[]): SentGroup[] {
  const map = new Map<string, SentGroup>();
  for (const log of logs) {
    if (!log.success || log.commits <= 0) continue;
    const day = log.timestamp.slice(0, 10);
    const key = `${log.projectId}|${day}`;
    const existing = map.get(key);
    if (existing) {
      existing.commits += log.commits;
      if (log.timestamp > existing.timestamp) existing.timestamp = log.timestamp;
      existing.manual = existing.manual || Boolean(log.manual);
    } else {
      map.set(key, {
        key,
        projectName: log.projectName,
        commits: log.commits,
        timestamp: log.timestamp,
        manual: Boolean(log.manual),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export default function GithubScreen() {
  const insets = useSafeAreaInsets();
  const {
    projects,
    logs,
    queue,
    pipeline,
    pending,
    getPlan,
    quickCommit,
    toggleProject,
    removeProject,
    refresh,
    retryQueueJobs,
    deleteQueueJobs,
    githubDays,
    githubHistoryLoading,
    githubHistoryError,
    refreshGithubHistory,
  } = useProjects();

  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPlans = useCallback(async () => {
    const enriched = await Promise.all(projects.map(async (p) => ({ ...p, plan: await getPlan(p) })));
    setRows(enriched);
  }, [projects, getPlan]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadPlans();
      refreshGithubHistory().catch(() => {});
    }, [refresh, loadPlans, refreshGithubHistory]),
  );

  useEffect(() => {
    loadPlans();
  }, [loadPlans, pending, logs]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), loadPlans(), refreshGithubHistory(true).catch(() => {})]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, loadPlans, refreshGithubHistory]);

  const inFlight = useMemo(() => inPipelineCount(pipeline, pending), [pipeline, pending]);
  const historyList = useMemo(
    () => [...githubDays].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14),
    [githubDays],
  );

  const activeGroups = useMemo(() => groupsFromPipeline(pipeline), [pipeline]);
  const failedGroups = useMemo(() => groupsFromFailed(queue), [queue]);
  const sentGroups = useMemo(() => groupSent(logs), [logs]);

  const pipelineByProject = useMemo(() => {
    const queuedMap = new Map<string, number>();
    for (const row of pipeline) {
      const total = row.queued + row.writing + row.waitingPush + row.pushing;
      if (total > 0) queuedMap.set(row.projectId, total);
    }
    const failedMap = new Map<string, number>();
    for (const job of queue) {
      if (!job.lastError || isOfflineError(job.lastError) || isFastForwardError(job.lastError)) continue;
      failedMap.set(job.projectId, (failedMap.get(job.projectId) ?? 0) + job.n);
    }
    return { queuedMap, failedMap };
  }, [pipeline, queue]);

  const onDelete = async (project: Project) => {
    const ok = await confirmAction(
      `Delete ${project.name}?`,
      'Removes this repo from the app, its local SSH key, and any queued commits. GitHub is not changed.',
    );
    if (!ok) return;
    await removeProject(project.id);
  };

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
        <View style={styles.screenHeader}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>STREAK & PIPELINE</Text>
            <Text style={styles.screenTitle}>GitHub</Text>
            <Text style={styles.screenSub}>
              Commit calendar, repositories, and live send queue
            </Text>
          </View>
          <Link href="/add-project" asChild>
            <Pressable style={({ pressed }) => [styles.addPill, pressed && styles.pressed]}>
              <AppIcon name="plus" color={THEME.accent} size={13} />
              <Text style={styles.addPillText}>Add repo</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Commit history</Text>
            <Pressable
              onPress={() => refreshGithubHistory(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.refreshLink}>REFRESH</Text>
            </Pressable>
          </View>
          <Text style={styles.panelSub}>
            {projects.length === 0
              ? 'Add a repository with a GitHub token, then tap REFRESH.'
              : inFlight > 0
                ? `${inFlight} commit(s) queued locally — synced to GitHub once pushed.`
                : 'Live commit counts on your configured branch.'}
          </Text>
          <CommitCalendar
            days={githubDays}
            loading={githubHistoryLoading}
            error={githubHistoryError}
          />
          {historyList.length > 0 ? (
            <View style={styles.dayList}>
              {historyList.map((row) => (
                <View key={row.date} style={styles.dayRow}>
                  <Text style={styles.dayDate}>{row.date}</Text>
                  <Text style={styles.dayTotal}>{row.total}</Text>
                  <Text style={styles.daySplit}>
                    {row.app} app · {row.other} other
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>REPOSITORIES ({projects.length})</Text>
        {projects.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No repositories yet</Text>
            <Text style={styles.emptyText}>
              Connect a GitHub repository to schedule commits and inspect hourly targets.
            </Text>
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
                    queuedCount={pipelineByProject.queuedMap.get(item.id) ?? 0}
                    failedCount={pipelineByProject.failedMap.get(item.id) ?? 0}
                  />
                </Pressable>
              </Link>
              <View style={styles.actions}>
                <View style={styles.quickSplit}>
                  <Pressable
                    style={({ pressed }) => [styles.quickHalf, pressed && styles.pressed]}
                    onPress={() => quickCommit(item, 1)}
                  >
                    <Text style={styles.quickBtnText}>+1</Text>
                  </Pressable>
                  <View style={styles.quickDivider} />
                  <Pressable
                    style={({ pressed }) => [styles.quickHalf, pressed && styles.pressed]}
                    onPress={() => quickCommit(item, 10)}
                  >
                    <Text style={styles.quickBtnText}>+10</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.toggleBtn, pressed && styles.pressed]}
                  onPress={() => toggleProject(item.id)}
                >
                  <Text style={styles.toggleBtnText}>{item.enabled ? 'Pause' : 'Resume'}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                  onPress={() => onDelete(item)}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionLabel}>LIVE PIPELINE</Text>
        {PHASE_ORDER.map((phase) => {
          const groups =
            phase === 'failed' ? failedGroups : activeGroups.filter((g) => g.phase === phase);
          const copy = PHASE_COPY[phase];
          const total = groups.reduce((sum, g) => sum + g.n, 0);
          return (
            <View key={phase} style={styles.phaseBlock}>
              <View style={styles.phaseHeader}>
                <Text style={styles.phaseTitle}>{copy.title}</Text>
                {total > 0 ? <Text style={styles.phaseCount}>{plus(total)}</Text> : null}
              </View>
              {groups.length === 0 ? (
                <View style={styles.emptySlot}>
                  <Text style={styles.emptySection}>None</Text>
                </View>
              ) : (
                <View style={styles.groupList}>
                  {groups.map((group) => (
                    <StatusCard
                      key={group.key}
                      group={group}
                      hint={copy.hint}
                      tone={copy.tone}
                      onRetry={phase === 'failed' ? () => retryQueueJobs(group.ids) : undefined}
                      onDelete={phase === 'failed' ? () => deleteQueueJobs(group.ids) : undefined}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.sectionLabel}>SENT HISTORY</Text>
        {sentGroups.length === 0 ? (
          <View style={styles.emptySlot}>
            <Text style={styles.emptySection}>No sent commits yet</Text>
          </View>
        ) : (
          sentGroups.map((group) => <SentCard key={group.key} group={group} />)
        )}
      </View>
    </ScrollView>
  );
}

function StatusCard({
  group,
  hint,
  tone,
  onRetry,
  onDelete,
}: {
  group: QueueGroup;
  hint: string;
  tone: 'work' | 'wait' | 'done' | 'fail';
  onRetry?: () => void;
  onDelete?: () => void;
}) {
  return (
    <View style={[styles.row, styles[tone]]}>
      <View style={styles.rowHeader}>
        <Text style={styles.project}>{group.projectName}</Text>
        <Text style={[styles.plus, tone === 'fail' ? styles.plusFail : styles.plusOk]}>
          {plus(group.n)}
        </Text>
      </View>
      <Text style={styles.message}>{hint}</Text>
      {group.error ? <Text style={styles.error}>{group.error}</Text> : null}
      {onRetry && onDelete ? (
        <View style={styles.pipeActions}>
          <Pressable style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>Retry {plus(group.n)}</Text>
          </Pressable>
          <Pressable style={styles.pipeDeleteBtn} onPress={onDelete}>
            <Text style={styles.pipeDeleteText}>Delete</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SentCard({ group }: { group: SentGroup }) {
  return (
    <View style={[styles.row, styles.done, styles.sentRow]}>
      <View style={styles.rowHeader}>
        <Text style={styles.project}>{group.projectName}</Text>
        <Text style={[styles.plus, styles.plusOk]}>{plus(group.commits)}</Text>
      </View>
      <Text style={styles.message}>
        {group.manual ? 'Includes manual +1 · ' : ''}
        {new Date(group.timestamp).toLocaleString()}
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
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: THEME.space.md,
    marginBottom: THEME.space.lg,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  screenTitle: { color: THEME.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  screenSub: { color: THEME.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.accentSoft,
    borderWidth: 1,
    borderColor: THEME.accentBorder,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 12,
    minHeight: 38,
  },
  addPillText: { color: THEME.accent, fontSize: 12, fontWeight: '600' },
  panel: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.lg,
    marginBottom: THEME.space.xl,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  panelTitle: { color: THEME.textPrimary, fontSize: 16, fontWeight: '700' },
  refreshLink: { color: THEME.info, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  panelSub: { color: THEME.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: THEME.space.md },
  dayList: {
    marginTop: THEME.space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.border,
    paddingTop: THEME.space.sm,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  dayDate: {
    color: THEME.textPrimary,
    fontWeight: '600',
    width: 100,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  dayTotal: {
    color: THEME.accent,
    fontWeight: '700',
    width: 34,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  daySplit: { color: THEME.textSecondary, flex: 1, fontSize: 12 },
  sectionLabel: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: THEME.space.sm + 2,
    marginTop: THEME.space.xs,
  },
  emptyCard: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.lg,
    marginBottom: THEME.space.xl,
  },
  emptyTitle: { color: THEME.textPrimary, fontSize: 15, fontWeight: '700' },
  emptyText: { color: THEME.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 19 },
  repoBlock: { marginBottom: THEME.space.md },
  pressed: { opacity: 0.78 },
  actions: { flexDirection: 'row', gap: THEME.space.sm },
  quickSplit: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
  },
  quickHalf: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDivider: { width: StyleSheet.hairlineWidth, backgroundColor: THEME.border, marginVertical: 8 },
  quickBtnText: { color: THEME.textPrimary, fontWeight: '700', fontSize: 13 },
  toggleBtn: {
    paddingHorizontal: 14,
    borderRadius: THEME.radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  toggleBtnText: { color: THEME.textPrimary, fontWeight: '600', fontSize: 13 },
  deleteBtn: {
    paddingHorizontal: 14,
    borderRadius: THEME.radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.dangerBorder,
  },
  deleteBtnText: { color: THEME.danger, fontWeight: '600', fontSize: 13 },
  phaseBlock: { marginBottom: THEME.space.md },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  phaseTitle: { color: THEME.textSecondary, fontSize: 12, fontWeight: '600' },
  phaseCount: { color: THEME.accent, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  emptySlot: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.borderSubtle,
    paddingHorizontal: THEME.space.md,
    paddingVertical: THEME.space.md,
    marginBottom: THEME.space.sm,
  },
  emptySection: { color: THEME.textMuted, fontSize: 13 },
  groupList: { gap: THEME.space.sm },
  row: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.space.md + 2,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  sentRow: { marginBottom: THEME.space.sm },
  work: { borderColor: THEME.warnBorder },
  wait: { borderColor: THEME.infoBorder },
  done: { borderColor: THEME.accentBorder },
  fail: { borderColor: THEME.dangerBorder },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  project: { color: THEME.textPrimary, fontWeight: '600', flex: 1, fontSize: 14 },
  plus: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  plusOk: { color: THEME.accent },
  plusFail: { color: THEME.danger },
  message: { color: THEME.textSecondary, marginTop: 4, fontSize: 12 },
  error: { color: THEME.danger, marginTop: 6, fontSize: 12 },
  pipeActions: { flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.md },
  retryBtn: {
    flex: 1,
    backgroundColor: THEME.infoSoft,
    borderWidth: 1,
    borderColor: THEME.infoBorder,
    borderRadius: THEME.radius.sm,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: { color: THEME.info, fontWeight: '700', fontSize: 13 },
  pipeDeleteBtn: {
    flex: 1,
    backgroundColor: THEME.surfaceElevated,
    borderRadius: THEME.radius.sm,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.dangerBorder,
  },
  pipeDeleteText: { color: THEME.danger, fontWeight: '600', fontSize: 13 },
});
