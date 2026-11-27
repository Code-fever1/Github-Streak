import { StyleSheet, Text, View } from 'react-native';

import { THEME } from '@/constants/theme';
import { timerLabel } from '@/lib/planner';
import type { Project } from '@/lib/types';

interface Props {
  project: Project;
  commitsToday: number;
  commitsLeft: number;
  target?: number;
  isQuiet?: boolean;
  queuedCount?: number;
  failedCount?: number;
}

/** Minimalist repo summary card displaying schedule cadence, pipeline badges, and today's progress. */
export function StreakCard({
  project,
  commitsToday,
  commitsLeft,
  target,
  isQuiet,
  queuedCount = 0,
  failedCount = 0,
}: Props) {
  const showProgress = target !== undefined && target > 0;
  const progressPct = showProgress
    ? Math.min(100, Math.max(0, Math.round((commitsToday / target) * 100)))
    : 0;
  const showChips = queuedCount > 0 || failedCount > 0;

  return (
    <View style={[styles.card, !project.enabled && styles.paused]}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {project.name}
        </Text>
        <View style={[styles.badge, project.enabled ? styles.active : styles.inactive]}>
          <View
            style={[
              styles.dot,
              { backgroundColor: project.enabled ? THEME.accent : THEME.textMuted },
            ]}
          />
          <Text style={[styles.badgeText, project.enabled ? styles.activeText : styles.inactiveText]}>
            {project.enabled ? 'Active' : 'Paused'}
          </Text>
        </View>
      </View>

      <Text style={styles.repo} numberOfLines={1}>
        {project.owner}/{project.repo} · {project.branch} · {timerLabel(project)}
        {isQuiet ? ' · Quiet' : ''}
      </Text>

      {showChips ? (
        <View style={styles.chipsRow}>
          {queuedCount > 0 ? (
            <View style={styles.chipQueued}>
              <Text style={styles.chipQueuedText}>+{queuedCount} in pipeline</Text>
            </View>
          ) : null}
          {failedCount > 0 ? (
            <View style={styles.chipFailed}>
              <Text style={styles.chipFailedText}>{failedCount} failed</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showProgress ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      ) : null}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, styles.statValueToday]}>{commitsToday}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{commitsLeft}</Text>
          <Text style={styles.statLabel}>Left</Text>
        </View>
        {target !== undefined ? (
          <View style={styles.stat}>
            <Text style={[styles.statValue, styles.statValueMuted]}>{target}</Text>
            <Text style={styles.statLabel}>Target</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.space.lg,
    marginBottom: THEME.space.sm,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  paused: { opacity: 0.72 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: THEME.space.sm,
  },
  name: { color: THEME.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  repo: { color: THEME.textSecondary, marginTop: 4, fontSize: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  active: { backgroundColor: THEME.accentSoft, borderColor: THEME.accentBorder },
  inactive: { backgroundColor: THEME.surfaceElevated, borderColor: THEME.border },
  badgeText: { fontSize: 11, fontWeight: '600' },
  activeText: { color: THEME.accent },
  inactiveText: { color: THEME.textSecondary },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: THEME.space.sm },
  chipQueued: {
    backgroundColor: THEME.purpleSoft,
    borderWidth: 1,
    borderColor: THEME.purpleBorder,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipQueuedText: { color: THEME.purple, fontSize: 11, fontWeight: '600' },
  chipFailed: {
    backgroundColor: THEME.dangerSoft,
    borderWidth: 1,
    borderColor: THEME.dangerBorder,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipFailedText: { color: THEME.danger, fontSize: 11, fontWeight: '600' },
  progressTrack: {
    height: 4,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.surfaceElevated,
    overflow: 'hidden',
    marginTop: THEME.space.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.accent,
  },
  stats: { flexDirection: 'row', marginTop: THEME.space.md, gap: THEME.space.xl },
  stat: { minWidth: 44 },
  statValue: {
    color: THEME.textPrimary,
    fontSize: 19,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statValueToday: { color: THEME.accent },
  statValueMuted: { color: THEME.textSecondary },
  statLabel: { color: THEME.textMuted, fontSize: 11, marginTop: 2, fontWeight: '600' },
});
