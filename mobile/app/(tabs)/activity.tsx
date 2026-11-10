import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommitCalendar } from '@/components/CommitCalendar';
import { useProjects } from '@/context/ProjectsContext';
import { inPipelineCount } from '@/lib/pipeline-stats';
import { isFastForwardError } from '@/lib/github';
import { isOfflineError } from '@/lib/offline';
import type { PipelineSnapshot } from '@/lib/pipeline';
import type { QueuedJob } from '@/lib/storage';
import type { ActivityLog } from '@/lib/types';

type Phase = 'queued' | 'committing' | 'committed' | 'failed';

const PHASE_ORDER: Phase[] = ['queued', 'committing', 'committed', 'failed'];

const PHASE_COPY: Record<Phase, { title: string; hint: string; tone: 'work' | 'wait' | 'done' | 'fail' }> = {
  queued: { title: 'Queued', hint: 'Waiting to write', tone: 'wait' },
  committing: { title: 'Being committed', hint: 'Writing the next commit object', tone: 'work' },
  committed: { title: 'Committed', hint: 'Pushing one at a time while more are written', tone: 'done' },
  failed: { title: 'Failed', hint: 'Same error grouped. Retry or delete.', tone: 'fail' },
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

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const {
    logs,
    queue,
    pipeline,
    pending,
    refresh,
    retryQueueJobs,
    deleteQueueJobs,
    githubDays,
    githubHistoryLoading,
    githubHistoryError,
    refreshGithubHistory,
  } = useProjects();

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshGithubHistory().catch(() => {});
    }, [refresh, refreshGithubHistory]),
  );

  const inFlight = useMemo(() => inPipelineCount(pipeline, pending), [pipeline, pending]);
  const historyList = useMemo(() => [...githubDays].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14), [githubDays]);

  const activeGroups = useMemo(() => groupsFromPipeline(pipeline), [pipeline]);
  const failedGroups = useMemo(() => groupsFromFailed(queue), [queue]);
  const sentGroups = useMemo(() => groupSent(logs), [logs]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.githubPanel}>
        <View style={styles.githubHeader}>
          <Text style={styles.githubTitle}>GitHub commit history</Text>
          <Pressable onPress={() => refreshGithubHistory(true)} hitSlop={8}>
            <Text style={styles.refreshLink}>REFRESH</Text>
          </Pressable>
        </View>
        <Text style={styles.githubSub}>
          {inFlight > 0 ? `${inFlight} commit(s) still queued locally — not on GitHub until pushed.` : 'Live counts from your branch on GitHub.'}
        </Text>
        <CommitCalendar days={githubDays} loading={githubHistoryLoading} error={githubHistoryError} />
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

      <Text style={styles.pipelineHeading}>Live pipeline</Text>

      {PHASE_ORDER.map((phase) => {
        const groups = phase === 'failed' ? failedGroups : activeGroups.filter((g) => g.phase === phase);
        const copy = PHASE_COPY[phase];
        const total = groups.reduce((sum, g) => sum + g.n, 0);
        return (
          <View key={phase} style={styles.sectionBlock}>
            <Text style={styles.section}>
              {copy.title}
              {total > 0 ? `  ${plus(total)}` : ''}
            </Text>
            <View style={styles.slot}>
              {groups.length === 0 ? (
                <Text style={styles.emptySection}>None</Text>
              ) : (
                groups.map((group) => (
                  <StatusCard
                    key={group.key}
                    group={group}
                    hint={copy.hint}
                    tone={copy.tone}
                    onRetry={phase === 'failed' ? () => retryQueueJobs(group.ids) : undefined}
                    onDelete={phase === 'failed' ? () => deleteQueueJobs(group.ids) : undefined}
                  />
                ))
              )}
            </View>
          </View>
        );
      })}

      <Text style={styles.section}>Sent</Text>
      {sentGroups.length === 0 ? (
        <Text style={styles.emptySection}>No sent commits yet</Text>
      ) : (
        sentGroups.map((group) => <SentCard key={group.key} group={group} />)
      )}
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
        <Text style={[styles.plus, tone === 'fail' ? styles.plusFail : styles.plusOk]}>{plus(group.n)}</Text>
      </View>
      <Text style={styles.message}>{hint}</Text>
      {group.error ? <Text style={styles.error}>{group.error}</Text> : null}
      {onRetry && onDelete ? (
        <View style={styles.actions}>
          <Pressable style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>Retry {plus(group.n)}</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteText}>Delete</Text>
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
  container: { flex: 1, backgroundColor: '#0d1117' },
  list: { paddingHorizontal: 16 },
  githubPanel: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 16,
    marginBottom: 20,
  },
  githubHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  githubTitle: { color: '#f0f6fc', fontSize: 16, fontWeight: '700' },
  refreshLink: { color: '#58a6ff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  githubSub: { color: '#8b949e', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  dayList: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#30363d', paddingTop: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  dayDate: { color: '#e6edf3', fontWeight: '600', width: 100, fontSize: 13 },
  dayTotal: { color: '#3fb950', fontWeight: '800', width: 32, fontSize: 15, fontVariant: ['tabular-nums'] },
  daySplit: { color: '#8b949e', flex: 1, fontSize: 12 },
  pipelineHeading: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionBlock: { marginBottom: 4 },
  section: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  slot: { minHeight: 86, justifyContent: 'center' },
  row: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  sentRow: { marginBottom: 10 },
  work: { borderColor: '#d29922' },
  wait: { borderColor: '#1f6feb' },
  done: { borderColor: '#3fb950' },
  fail: { borderColor: '#f85149' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  project: { color: '#e6edf3', fontWeight: '700', flex: 1 },
  plus: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  plusOk: { color: '#3fb950' },
  plusFail: { color: '#f85149' },
  message: { color: '#8b949e', marginTop: 6, fontSize: 13 },
  error: { color: '#f85149', marginTop: 6, fontSize: 12 },
  emptySection: { color: '#6e7681', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  retryBtn: {
    flex: 1,
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#21262d',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f85149',
  },
  deleteText: { color: '#f85149', fontWeight: '700', fontSize: 13 },
});
