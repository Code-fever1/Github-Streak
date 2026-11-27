import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { THEME } from '@/constants/theme';
import type { DayCommitStats } from '@/lib/github-commits';

const WEEKS = 12;
const CELL = 13;
const GAP = 3;

function level(total: number): number {
  if (total <= 0) return 0;
  if (total === 1) return 1;
  if (total <= 3) return 2;
  if (total <= 6) return 3;
  return 4;
}

const LEVEL_APP = [THEME.surfaceElevated, '#0E4429', '#006D32', '#26A641', THEME.accent];
const LEVEL_OTHER = [THEME.surfaceElevated, '#3D2C0A', '#6B4A0A', '#B08800', THEME.warn];

interface Props {
  days: DayCommitStats[];
  loading?: boolean;
  error?: string | null;
}

export function CommitCalendar({ days, loading, error }: Props) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const cells = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - WEEKS * 7 + 1);
    const grid: Array<{ key: string; stats?: DayCommitStats }> = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      grid.push({ key, stats: byDate.get(key) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return grid;
  }, [byDate]);

  const weekCols = useMemo(() => {
    const cols: (typeof cells)[] = [];
    let col: typeof cells = [];
    for (let i = 0; i < cells.length; i++) {
      const dow = localDayOfWeek(cells[i].key);
      if (col.length === 0 && dow > 0) {
        for (let pad = 0; pad < dow; pad++) col.push({ key: `pad-${i}-${pad}` });
      }
      col.push(cells[i]);
      if (col.length === 7) {
        cols.push(col);
        col = [];
      }
    }
    if (col.length) {
      while (col.length < 7) col.push({ key: `pad-end-${col.length}` });
      cols.push(col);
    }
    return cols.slice(-WEEKS);
  }, [cells]);

  const today = days.find((d) => d.date === formatToday()) ?? null;

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryTitle}>On GitHub today</Text>
        {loading ? (
          <Text style={styles.summaryMuted}>Loading…</Text>
        ) : (
          <Text style={styles.summaryValue}>
            {today ? today.total : 0}{' '}
            <Text style={styles.summarySub}>
              ({today?.app ?? 0} app · {today?.other ?? 0} other)
            </Text>
          </Text>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridRow}>
        {weekCols.map((col, wi) => (
          <View key={`w-${wi}`} style={styles.weekCol}>
            {col.map((cell) => {
              if (!cell.stats) {
                return <View key={cell.key} style={[styles.cell, styles.cellEmpty]} />;
              }
              const { total, app, other } = cell.stats;
              const lv = level(total);
              const useOther = other > 0 && app === 0;
              const palette = useOther ? LEVEL_OTHER : LEVEL_APP;
              return (
                <View
                  key={cell.key}
                  style={[styles.cell, { backgroundColor: palette[lv] }]}
                  accessibilityLabel={`${cell.key}: ${total} commits`}
                />
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.legend}>
        <View style={styles.legendGroup}>
          <Text style={styles.legendLabel}>App</Text>
          <View style={styles.legendCells}>
            {LEVEL_APP.map((c, i) => (
              <View key={`a-${i}`} style={[styles.legendCell, { backgroundColor: c }]} />
            ))}
          </View>
        </View>
        <View style={styles.legendGroup}>
          <Text style={styles.legendLabel}>Other</Text>
          <View style={styles.legendCells}>
            {LEVEL_OTHER.map((c, i) => (
              <View key={`o-${i}`} style={[styles.legendCell, { backgroundColor: c }]} />
            ))}
          </View>
        </View>
      </View>
      <Text style={styles.caption}>Counts match commits on your branch author dates from the GitHub API.</Text>
    </View>
  );
}

function localDayOfWeek(key: string): number {
  const [y, m, d] = key.split('-').map((p) => Number(p));
  if (!y || !m || !d) return 0;
  return new Date(y, m - 1, d).getDay();
}

function formatToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: THEME.space.md,
  },
  summaryTitle: { color: THEME.textPrimary, fontWeight: '600', fontSize: 13 },
  summaryValue: {
    color: THEME.accent,
    fontWeight: '700',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  summarySub: { color: THEME.textSecondary, fontWeight: '500', fontSize: 12 },
  summaryMuted: { color: THEME.textSecondary, fontSize: 13 },
  gridRow: { flexDirection: 'row', gap: GAP },
  weekCol: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  cellEmpty: { backgroundColor: THEME.surfaceElevated },
  legend: {
    marginTop: THEME.space.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.space.lg,
    alignItems: 'center',
  },
  legendGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { color: THEME.textMuted, fontSize: 11, fontWeight: '600' },
  legendCells: { flexDirection: 'row', gap: 3 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  caption: { color: THEME.textMuted, fontSize: 11, marginTop: THEME.space.sm, lineHeight: 15 },
  error: { color: THEME.danger, fontSize: 13, lineHeight: 18 },
});
