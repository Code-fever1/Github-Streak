import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useProjects } from '@/context/ProjectsContext';

export default function ActivityScreen() {
  const { logs } = useProjects();

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={logs.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Nothing yet. +1 and timer ticks show up here. Offline work is queued until you are back online.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, !item.success && styles.rowError]}>
            <View style={styles.rowHeader}>
              <Text style={styles.project}>{item.projectName}</Text>
              <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
            </View>
            {item.manual && <Text style={styles.manual}>Manual +1</Text>}
            <Text style={styles.message}>{item.message}</Text>
            {item.commits > 0 && <Text style={styles.commits}>{item.commits} commit(s)</Text>}
            {item.error && <Text style={styles.error}>{item.error}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  list: { padding: 16 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  empty: { color: '#8b949e', textAlign: 'center', lineHeight: 20 },
  row: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  rowError: { borderColor: '#f85149' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  project: { color: '#e6edf3', fontWeight: '700', flex: 1 },
  time: { color: '#8b949e', fontSize: 11 },
  manual: { color: '#1f6feb', fontSize: 11, fontWeight: '700', marginTop: 4 },
  message: { color: '#c9d1d9', marginTop: 6 },
  commits: { color: '#3fb950', marginTop: 4, fontSize: 12, fontWeight: '600' },
  error: { color: '#f85149', marginTop: 4, fontSize: 12 },
});
