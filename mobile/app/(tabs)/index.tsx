import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { StreakCard } from '@/components/StreakCard';
import { useProjects } from '@/context/ProjectsContext';
import { useClock } from '@/hooks/useClock';
import { confirmAction } from '@/lib/confirm';
import { commitsForScheduledTick } from '@/lib/planner';
import type { DailyPlan, Project } from '@/lib/types';

type ProjectRow = Project & { plan?: DailyPlan };

export default function ProjectsScreen() {
  const { projects, loading, getPlan, quickCommit, removeProject, lastTicks, pending } = useProjects();
  const { countdown } = useClock(projects, lastTicks);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [quickId, setQuickId] = useState<string | null>(null);

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
  }, [loadPlans]);

  const onQuickCommit = async (project: Project) => {
    setQuickId(project.id);
    try {
      const log = await quickCommit(project);
      Alert.alert(log.success ? (log.message.startsWith('Queued') ? 'Queued' : 'Streak +1') : 'Could not queue', log.error ?? log.message);
    } finally {
      setQuickId(null);
    }
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
    <View style={styles.container}>
      <View style={styles.timerCard}>
        <Text style={styles.timerLabel}>Next tick</Text>
        <Text style={styles.timer}>{countdown}</Text>
        <Text style={styles.timerSub}>
          {projects.filter((p) => p.enabled).length} active
          {pending > 0 ? ` · ${pending} waiting to send` : ''}
        </Text>
      </View>

      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No repo yet</Text>
          <Text style={styles.emptyText}>Paste a GitHub link. We give you an SSH key to add on GitHub.</Text>
          <Link href="/add-project" asChild>
            <Pressable style={styles.cta}>
              <Text style={styles.ctaText}>Add repo</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <>
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View>
                <Link href={`/project/${item.id}`} asChild>
                  <Pressable style={({ pressed }) => pressed && styles.cardPressed}>
                    <StreakCard
                      project={item}
                      commitsLeft={item.plan?.total ?? 0}
                      thisHour={item.plan ? commitsForScheduledTick(item, item.plan) : 0}
                    />
                  </Pressable>
                </Link>
                <View style={styles.actions}>
                  <Pressable
                    style={styles.quickBtn}
                    onPress={() => onQuickCommit(item)}
                    disabled={quickId === item.id}
                  >
                    {quickId === item.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.quickBtnText}>+1 now</Text>
                    )}
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => onDelete(item)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
          <Link href="/add-project" asChild>
            <Pressable style={styles.fab}>
              <Text style={styles.fabText}>+ Add repo</Text>
            </Pressable>
          </Link>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' },
  timerCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  timerLabel: { color: '#8b949e', fontSize: 13 },
  timer: { color: '#3fb950', fontSize: 48, fontWeight: '800', marginVertical: 4, fontVariant: ['tabular-nums'] },
  timerSub: { color: '#8b949e', fontSize: 12, textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  cardPressed: { opacity: 0.85 },
  actions: { flexDirection: 'row', gap: 8, marginTop: -4, marginBottom: 12 },
  quickBtn: {
    flex: 1,
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    paddingHorizontal: 16,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#f85149',
  },
  deleteBtnText: { color: '#f85149', fontWeight: '700', fontSize: 13 },
  empty: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { color: '#e6edf3', fontSize: 22, fontWeight: '700' },
  emptyText: { color: '#8b949e', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  cta: {
    marginTop: 20,
    backgroundColor: '#238636',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#238636',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  fabText: { color: '#fff', fontWeight: '700' },
});
