import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

export type StatTone = 'green' | 'purple' | 'orange' | 'blue';

const TONES: Record<
  StatTone,
  { bg: string; border: string; value: string; iconBg: string }
> = {
  green: { bg: '#0f1f14', border: '#23863644', value: '#3fb950', iconBg: '#23863633' },
  purple: { bg: '#16122a', border: '#8957e544', value: '#a371f7', iconBg: '#8957e533' },
  orange: { bg: '#221a0f', border: '#d2992244', value: '#e3b341', iconBg: '#d2992233' },
  blue: { bg: '#0c1a2e', border: '#1f6feb44', value: '#58a6ff', iconBg: '#1f6feb33' },
};

interface Props {
  tone: StatTone;
  icon: string;
  value: string;
  label: string;
  style?: ViewStyle;
}

export function DashboardStatCard({ tone, icon, value, label, style }: Props) {
  const palette = TONES[tone];
  return (
    <View style={[styles.card, { backgroundColor: palette.bg, borderColor: palette.border }, style]}>
      <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={[styles.value, { color: palette.value }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minHeight: 112,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  icon: { fontSize: 16 },
  value: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { color: '#8b949e', fontSize: 12, marginTop: 4, lineHeight: 16 },
});
