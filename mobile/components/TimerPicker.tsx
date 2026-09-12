import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TIMER_INTERVAL_OPTIONS, type TimerConfig, type TimerMode } from '@/lib/types';

interface Props {
  value: TimerConfig;
  onChange: (timer: TimerConfig) => void;
}

export function TimerPicker({ value, onChange }: Props) {
  const setMode = (mode: TimerMode) => onChange({ ...value, mode });

  const toggleFixedTime = (time: string) => {
    const current = value.fixedTimes ?? [];
    const next = current.includes(time) ? current.filter((t) => t !== time) : [...current, time].sort();
    onChange({ ...value, mode: 'fixed_times', fixedTimes: next });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Commit timer</Text>
      <View style={styles.row}>
        <ModeChip label="Interval" active={value.mode === 'interval'} onPress={() => setMode('interval')} />
        <ModeChip label="Fixed times" active={value.mode === 'fixed_times'} onPress={() => setMode('fixed_times')} />
      </View>

      {value.mode === 'interval' ? (
        <View style={styles.chips}>
          {TIMER_INTERVAL_OPTIONS.map((mins) => (
            <Pressable
              key={mins}
              style={[styles.chip, value.intervalMinutes === mins && styles.chipActive]}
              onPress={() => onChange({ ...value, mode: 'interval', intervalMinutes: mins })}
            >
              <Text style={[styles.chipText, value.intervalMinutes === mins && styles.chipTextActive]}>
                {mins < 60 ? `${mins}m` : mins === 60 ? '1h' : `${mins / 60}h`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Text style={styles.hint}>Tap times when commits should run (local time).</Text>
          <View style={styles.chips}>
            {['06:00', '09:00', '12:00', '14:00', '18:00', '20:00', '22:00'].map((time) => {
              const selected = (value.fixedTimes ?? []).includes(time);
              return (
                <Pressable
                  key={time}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => toggleFixedTime(time)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{time}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={styles.customInput}
            placeholder="Custom HH:MM (e.g. 15:30)"
            placeholderTextColor="#6e7681"
            onSubmitEditing={(e) => {
              const t = e.nativeEvent.text.trim();
              if (/^\d{1,2}:\d{2}$/.test(t)) toggleFixedTime(t.padStart(5, '0').replace(/^(\d):/, '0$1:'));
            }}
          />
        </>
      )}
    </View>
  );
}

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.modeChip, active && styles.modeChipActive]} onPress={onPress}>
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  title: { color: '#c9d1d9', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    backgroundColor: '#161b22',
  },
  modeChipActive: { borderColor: '#3fb950', backgroundColor: '#1a2e1a' },
  modeChipText: { color: '#8b949e', fontWeight: '600' },
  modeChipTextActive: { color: '#3fb950' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    backgroundColor: '#161b22',
  },
  chipActive: { borderColor: '#3fb950', backgroundColor: '#1a2e1a' },
  chipText: { color: '#8b949e', fontWeight: '600' },
  chipTextActive: { color: '#3fb950' },
  hint: { color: '#8b949e', fontSize: 12, marginBottom: 8 },
  customInput: {
    marginTop: 10,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e6edf3',
  },
});
