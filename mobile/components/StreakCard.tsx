import { StyleSheet, Text, View } from 'react-native';
import { timerLabel } from '@/lib/planner';
import type { Project } from '@/lib/types';

interface Props {
  project: Project;
  commitsToday: number;
  commitsLeft: number;
}

export function StreakCard({ project, commitsToday, commitsLeft }: Props) {
  return (
    <View style={[styles.card, !project.enabled && styles.paused]}>
      <View style={styles.header}>
        <Text style={styles.name}>{project.name}</Text>
        <View style={[styles.badge, project.enabled ? styles.active : styles.inactive]}>
          <Text style={styles.badgeText}>{project.enabled ? 'ACTIVE' : 'PAUSED'}</Text>
        </View>
      </View>
      <Text style={styles.repo}>
        {project.owner}/{project.repo} · {timerLabel(project)}
      </Text>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{commitsToday}</Text>
          <Text style={styles.statLabel}>total today</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{commitsLeft}</Text>
          <Text style={styles.statLabel}>left today</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161b22',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  paused: { opacity: 0.65 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#e6edf3', fontSize: 18, fontWeight: '700' },
  repo: { color: '#8b949e', marginTop: 4, fontSize: 13 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  active: { backgroundColor: '#238636' },
  inactive: { backgroundColor: '#6e7681' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  stats: { flexDirection: 'row', marginTop: 14, gap: 24 },
  stat: {},
  statValue: { color: '#3fb950', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#8b949e', fontSize: 12, marginTop: 2 },
});
