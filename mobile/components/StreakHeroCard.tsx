import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { THEME } from '@/constants/theme';
import type { StreakSummary } from '@/lib/github-commits';

const LEVEL_APP = [THEME.surfaceElevated, '#0E4429', '#006D32', '#26A641', '#22C55E'] as const;
const LEVEL_OTHER = [THEME.surfaceElevated, '#3D2C0A', '#6B4A0A', '#B08800', '#F59E0B'] as const;

function level(total: number): number {
  if (total <= 0) return 0;
  if (total === 1) return 1;
  if (total <= 3) return 2;
  if (total <= 6) return 3;
  return 4;
}

interface Props {
  summary: StreakSummary;
  loading: boolean;
  error: string | null;
  plannedMade: number;
  plannedTarget: number;
  plannedLeft: number;
  hasProjects: boolean;
  onOpenCalendar: () => void;
  onRetryHistory: () => void;
  footer?: ReactNode;
}

/** Swiss-minimalist GitHub streak hero card with 7-day cadence strip and optional scheduler footer. */
export const StreakHeroCard = memo(function StreakHeroCard({
  summary,
  loading,
  error,
  plannedMade,
  plannedTarget,
  plannedLeft,
  hasProjects,
  onOpenCalendar,
  onRetryHistory,
  footer,
}: Props) {
  const secured = summary.todaySecured || plannedMade > 0;
  const atRisk = !secured && summary.currentStreak > 0;

  const pillBg = secured ? THEME.accentSoft : atRisk ? THEME.warnSoft : THEME.surfaceElevated;
  const pillBorder = secured ? THEME.accentBorder : atRisk ? THEME.warnBorder : THEME.border;
  const dotColor = secured ? THEME.accent : atRisk ? THEME.warn : THEME.textMuted;
  const pillTextColor = secured ? THEME.accent : atRisk ? THEME.warn : THEME.textSecondary;
  const pillLabel = secured ? 'Today secured' : atRisk ? 'At risk today' : 'No commits yet';

  const progressPct =
    plannedTarget > 0 ? Math.min(100, Math.max(0, Math.round((plannedMade / plannedTarget) * 100))) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>GITHUB STREAK</Text>
        <View style={[styles.pill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={[styles.pillText, { color: pillTextColor }]}>{pillLabel}</Text>
        </View>
      </View>

      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          <View style={styles.streakRow}>
            <Text style={styles.streakValue}>
              {loading && summary.currentStreak === 0 ? '—' : String(summary.currentStreak)}
            </Text>
            <Text style={styles.streakUnit}>
              {summary.currentStreak === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <Text style={styles.subline}>
            {summary.bestStreak > 0 ? `12w best ${summary.bestStreak}d` : 'Branch commit streak'}
          </Text>
        </View>

        <View style={styles.rightCol}>
          <Text style={styles.todayValue}>
            {loading && summary.todayTotal === 0 ? '…' : String(summary.todayTotal)}
          </Text>
          <Text style={styles.todayLabel}>today on GitHub</Text>
          {summary.todayTotal > 0 ? (
            <Text style={styles.todaySplit}>
              {summary.todayApp} app · {summary.todayOther} other
            </Text>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
          <Pressable onPress={onRetryHistory} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {hasProjects && plannedTarget > 0 ? (
        <View style={styles.planBlock}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>Daily target</Text>
            <Text style={styles.planMeta}>
              {plannedMade} / {plannedTarget} · {plannedLeft} left
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.stripWrap, pressed && styles.pressed]}
        onPress={onOpenCalendar}
        accessibilityRole="button"
        accessibilityLabel="Open GitHub commit calendar"
      >
        <View style={styles.stripHeader}>
          <Text style={styles.stripTitle}>7-DAY CADENCE</Text>
          <View style={styles.stripLinkRow}>
            <Text style={styles.stripLink}>Calendar</Text>
            <AppIcon name="chevron" color={THEME.info} size={14} />
          </View>
        </View>
        <View style={styles.daysRow}>
          {summary.last7Days.map((day) => {
            const lv = level(day.total);
            const useOther = day.other > 0 && day.app === 0;
            const bg = (useOther ? LEVEL_OTHER : LEVEL_APP)[lv];
            return (
              <View key={day.date} style={styles.dayCol}>
                <View
                  style={[
                    styles.dayTile,
                    { backgroundColor: bg },
                    day.isToday && styles.dayTileToday,
                  ]}
                >
                  <Text style={[styles.dayCount, lv >= 3 && styles.dayCountBright]}>
                    {day.total > 0 ? String(day.total) : '·'}
                  </Text>
                </View>
                <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
                  {day.shortDay}
                </Text>
              </View>
            );
          })}
        </View>
      </Pressable>

      {footer ? <View style={styles.footerSlot}>{footer}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: THEME.space.lg,
    marginBottom: THEME.space.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.space.md,
    gap: THEME.space.sm,
  },
  eyebrow: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '600' },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: THEME.space.md,
  },
  leftCol: { flex: 1 },
  rightCol: { alignItems: 'flex-end' },
  streakRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  streakValue: {
    color: THEME.textPrimary,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  streakUnit: { color: THEME.textSecondary, fontSize: 14, fontWeight: '600' },
  subline: { color: THEME.textMuted, fontSize: 12, fontWeight: '500', marginTop: 2 },
  todayValue: {
    color: THEME.accent,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  todayLabel: { color: THEME.textSecondary, fontSize: 11, fontWeight: '500', marginTop: 2 },
  todaySplit: { color: THEME.textMuted, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.space.sm,
    marginTop: THEME.space.md,
    paddingHorizontal: THEME.space.md,
    paddingVertical: THEME.space.sm,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.dangerSoft,
    borderWidth: 1,
    borderColor: THEME.dangerBorder,
  },
  errorText: { color: THEME.danger, fontSize: 12, flex: 1, lineHeight: 16 },
  retryText: { color: THEME.info, fontSize: 12, fontWeight: '700' },
  planBlock: { marginTop: THEME.space.lg },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planTitle: { color: THEME.textSecondary, fontSize: 12, fontWeight: '600' },
  planMeta: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 4,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.accent,
  },
  stripWrap: {
    marginTop: THEME.space.lg,
    paddingTop: THEME.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.border,
  },
  pressed: { opacity: 0.78 },
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.space.sm,
  },
  stripTitle: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  stripLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stripLink: { color: THEME.info, fontSize: 12, fontWeight: '600' },
  daysRow: { flexDirection: 'row', gap: 6 },
  dayCol: { flex: 1, alignItems: 'center', gap: 5 },
  dayTile: {
    width: '100%',
    height: 30,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTileToday: { borderWidth: 1.5, borderColor: THEME.info },
  dayCount: {
    color: THEME.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dayCountBright: { color: '#052E16' },
  dayLabel: { color: THEME.textMuted, fontSize: 10, fontWeight: '600' },
  dayLabelToday: { color: THEME.textPrimary, fontWeight: '700' },
  footerSlot: {
    marginTop: THEME.space.md,
    paddingTop: THEME.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.border,
  },
});
