import { Tabs } from 'expo-router';
import { StyleSheet, Text, type ColorValue } from 'react-native';

function TabIcon({ label, color }: { label: string; color: ColorValue }) {
  return <Text style={[styles.icon, { color }]}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3fb950',
        tabBarInactiveTintColor: '#8b949e',
        tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#30363d' },
        headerStyle: { backgroundColor: '#161b22' },
        headerTintColor: '#e6edf3',
        sceneStyle: { backgroundColor: '#0d1117' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color }) => <TabIcon label="📁" color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => <TabIcon label="⏱" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20, lineHeight: 22 },
});
