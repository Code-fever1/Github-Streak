import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { HourGrid } from '@/components/HourGrid';
import { TimerPicker } from '@/components/TimerPicker';
import { useProjects } from '@/context/ProjectsContext';
import { useClock } from '@/hooks/useClock';
import { commitsForCurrentHour, commitsForScheduledTick, timerLabel } from '@/lib/planner';
import { confirmAction } from '@/lib/confirm';
import { deployKeysUrl } from '@/lib/ssh-key';
import type { DailyPlan, TimerConfig } from '@/lib/types';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { projects, getPlan, runTick, quickCommit, toggleProject, removeProject, updateTimer, lastTicks } = useProjects();
  const { hour, nextTickFor } = useClock(projects, lastTicks);
  const project = projects.find((p) => p.id === id);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [running, setRunning] = useState(false);
  const [quickRunning, setQuickRunning] = useState(false);
  const [timerDraft, setTimerDraft] = useState<TimerConfig | null>(null);

  useEffect(() => {
    if (project) setTimerDraft(project.timer);
  }, [project]);

  const load = useCallback(async () => {
    if (!project) return;
    setPlan(await getPlan(project));
  }, [project, getPlan]);

  useEffect(() => {
    load();
  }, [load, hour]);

  if (!project || !timerDraft) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{project ? 'Loading…' : 'Project not found'}</Text>
      </View>
    );
  }

  const onRunNow = async () => {
    setRunning(true);
    try {
      const log = await runTick(project, true);
      await load();
      Alert.alert(log.success ? (log.message.startsWith('Queued') ? 'Queued' : 'Tick sent') : 'Tick failed', log.error ?? log.message);
    } finally {
      setRunning(false);
    }
  };

  const onQuickCommit = async () => {
    setQuickRunning(true);
    try {
      const log = await quickCommit(project);
      Alert.alert(
        log.success ? (log.message.startsWith('Queued') ? 'Queued' : 'Streak +1') : 'Could not queue',
        log.error ?? log.message,
      );
    } finally {
      setQuickRunning(false);
    }
  };

  const onSaveTimer = async () => {
    await updateTimer(project.id, timerDraft);
    Alert.alert('Timer updated', timerLabel({ ...project, timer: timerDraft }));
  };

  const onToggle = async () => {
    await toggleProject(project.id);
  };

  const onDelete = async () => {
    const ok = await confirmAction(
      `Delete ${project.name}?`,
      'Removes this repo from the app, its local SSH key, and any queued commits. GitHub is not changed.',
    );
    if (!ok) return;
    await removeProject(project.id);
    router.replace('/');
  };

  const thisSlot = plan ? commitsForScheduledTick(project, plan) : 0;
  const thisHour = plan ? commitsForCurrentHour(plan) : 0;

  return (
    <>
      <Stack.Screen options={{ title: project.name }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.repo}>
            {project.owner}/{project.repo}
          </Text>
          <Text style={styles.branch}>SSH deploy key · {project.branch}</Text>
          <Text style={styles.countdown}>{nextTickFor(project)}</Text>
          <Text style={styles.countdownLabel}>until next tick ({timerLabel(project)})</Text>
        </View>

        {project.sshPublicKey ? (
          <View style={styles.keyBox}>
            <Text style={styles.keyLabel}>SSH public key — add as a write deploy key on GitHub</Text>
            <Text style={styles.key} selectable>
              {project.sshPublicKey}
            </Text>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(project.sshPublicKey || '');
                Alert.alert('Copied');
              }}
            >
              <Text style={styles.link}>Copy key</Text>
            </Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(deployKeysUrl(project.owner, project.repo))}>
              <Text style={styles.link}>Open GitHub deploy keys</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <Stat label="This slot" value={String(thisSlot)} />
          <Stat label="This hour" value={String(thisHour)} />
          <Stat label="Left today" value={String(plan?.total ?? '—')} />
          <Stat label="Target" value={String(plan?.target ?? '—')} />
        </View>

        {plan ? <HourGrid plan={plan} currentHour={hour} /> : <ActivityIndicator color="#3fb950" style={{ marginTop: 20 }} />}

        <Pressable style={styles.quick} onPress={onQuickCommit} disabled={quickRunning}>
          {quickRunning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.quickText}>Commit +1 now</Text>
          )}
        </Pressable>
        <Text style={styles.quickHint}>Sends now if online, otherwise queues until you are back.</Text>

        <Pressable style={styles.primary} onPress={onRunNow} disabled={running}>
          {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Run scheduled tick</Text>}
        </Pressable>

        <View style={styles.timerSection}>
          <TimerPicker value={timerDraft} onChange={setTimerDraft} />
          <Pressable style={styles.secondary} onPress={onSaveTimer}>
            <Text style={styles.secondaryText}>Save timer settings</Text>
          </Pressable>
        </View>

        <Pressable style={styles.secondary} onPress={onToggle}>
          <Text style={styles.secondaryText}>{project.enabled ? 'Pause project' : 'Resume project'}</Text>
        </Pressable>

        <Pressable style={styles.danger} onPress={onDelete}>
          <Text style={styles.dangerText}>Delete repo</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' },
  muted: { color: '#8b949e' },
  hero: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  repo: { color: '#e6edf3', fontSize: 18, fontWeight: '700' },
  branch: { color: '#8b949e', marginTop: 4, fontSize: 12 },
  countdown: { color: '#3fb950', fontSize: 40, fontWeight: '800', marginTop: 16, fontVariant: ['tabular-nums'] },
  countdownLabel: { color: '#8b949e', fontSize: 12, textAlign: 'center' },
  keyBox: {
    marginTop: 12,
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  keyLabel: { color: '#8b949e', fontSize: 12, marginBottom: 8 },
  key: { color: '#c9d1d9', fontSize: 11, lineHeight: 16 },
  link: { color: '#3fb950', fontWeight: '700', marginTop: 10 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: {
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 12,
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  statValue: { color: '#3fb950', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  quick: {
    marginTop: 24,
    backgroundColor: '#1f6feb',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  quickText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  quickHint: { color: '#8b949e', fontSize: 11, textAlign: 'center', marginTop: 6, marginBottom: 4 },
  primary: {
    marginTop: 12,
    backgroundColor: '#238636',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  timerSection: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#161b22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  secondary: {
    marginTop: 10,
    backgroundColor: '#21262d',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  secondaryText: { color: '#e6edf3', fontWeight: '600' },
  danger: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f85149',
    backgroundColor: '#21262d',
  },
  dangerText: { color: '#f85149', fontWeight: '700' },
});
