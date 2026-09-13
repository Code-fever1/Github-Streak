import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useProjects } from '@/context/ProjectsContext';
import { isFastForwardError } from '@/lib/github';
import { isOfflineError } from '@/lib/offline';
import type { QueuedJob } from '@/lib/storage';
import type { ActivityLog } from '@/lib/types';

type Phase = 'committing' | 'queued' | 'committed' | 'failed';

const PHASE_ORDER: Phase[] = ['committing', 'queued', 'committed', 'failed'];

const PHASE_COPY: Record<Phase, { title: string; hint: string; tone: 'work' | 'wait' | 'done' | 'fail' }> = {
  committing: { title: 'Being committed', hint: 'Writing this commit now', tone: 'work' },
  queued: { title: 'Queued', hint: 'Waiting to write and push', tone: 'wait' },
  committed: { title: 'Committed', hint: 'Pushing this commit now', tone: 'done' },
  failed: { title: 'Failed', hint: 'Same error grouped. Retry or delete.', tone: 'fail' },
};

function phaseOf(job: QueuedJob): Phase {
  if (job.lastError && !isOfflineError(job.lastError) && !isFastForwardError(job.lastError)) return 'failed';
  if (job.status === 'committing') return 'committing';
  if (job.status === 'committed') return 'committed';
  return 'queued';
}

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
  newest: string;
}

function groupQueue(jobs: QueuedJob[]): QueueGroup[] {
  const map = new Map<string, QueueGroup>();
  for (const job of jobs) {
    const phase = phaseOf(job);
    const errorKey = phase === 'failed' ? job.lastError || 'error' : '';
    const key = `${phase}|${job.projectId}|${errorKey}`;
    const existing = map.get(key);
    if (existing) {
      existing.n += job.n;
      existing.ids.push(job.id);
      if (job.createdAt > existing.newest) existing.newest = job.createdAt;
    } else {
      map.set(key, {
        key,
        phase,
        projectId: job.projectId,
        projectName: job.projectName || job.projectId,
        n: job.n,
        ids: [job.id],
        error: phase === 'failed' ? job.lastError : undefined,
        newest: job.createdAt,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    const phaseDiff = PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase);
    if (phaseDiff !== 0) return phaseDiff;
    return b.newest.localeCompare(a.newest);
  });
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
  const { logs, queue, refresh, retryQueueJobs, deleteQueueJobs } = useProjects();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const queueGroups = useMemo(() => groupQueue(queue), [queue]);
  const sentGroups = useMemo(() => groupSent(logs), [logs]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.list}>
      {PHASE_ORDER.map((phase) => {
        const groups = queueGroups.filter((g) => g.phase === phase);
        const copy = PHASE_COPY[phase];
        const total = groups.reduce((sum, g) => sum + g.n, 0);
        return (
          <View key={phase}>
            <Text style={styles.section}>
              {copy.title}
              {total > 0 ? `  ${plus(total)}` : ''}
            </Text>
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
        );
      })}

      <Text style={styles.section}>Sent</Text>
      {sentGroups.length === 0 ? (
        <Text style={styles.emptySection}>No sent commits yet</Text>
      ) : (
        sentGroups.map((group) => <SentCard key={group.key} group={group} />)
      )}

      <Text style={styles.hint}>
        +1 queues immediately. Each commit is pushed on its own; the next one is prepared while the previous push is in flight.
      </Text>
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
    <View style={[styles.row, styles.done]}>
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
  list: { padding: 16, paddingBottom: 40 },
  section: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  row: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
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
  hint: { color: '#6e7681', fontSize: 12, lineHeight: 18, marginTop: 8, textAlign: 'center' },
  emptySection: { color: '#6e7681', fontSize: 13, marginBottom: 16 },
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
