import { StyleSheet, Text, View } from 'react-native';
import type { DailyPlan } from '@/lib/types';

interface Props {
  plan: DailyPlan;
  currentHour: number;
}

export function HourGrid({ plan, currentHour }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Today's hourly plan</Text>
      <View style={styles.grid}>
        {plan.hours.map((count, hour) => {
          const intensity = Math.min(count / 5, 1);
          const isNow = hour === currentHour;
          return (
            <View
              key={hour}
              style={[
                styles.cell,
                { backgroundColor: `rgba(63, 185, 80, ${0.15 + intensity * 0.85})` },
                isNow && styles.now,
              ]}
            >
              <Text style={styles.hour}>{hour}</Text>
              <Text style={styles.count}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  title: { color: '#8b949e', fontSize: 13, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    width: '15%',
    minWidth: 46,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  now: { borderColor: '#e6edf3' },
  hour: { color: '#c9d1d9', fontSize: 10 },
  count: { color: '#0d1117', fontSize: 12, fontWeight: '800' },
});
