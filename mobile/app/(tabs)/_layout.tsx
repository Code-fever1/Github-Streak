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
        tabBarInactiveTintColor: '#6e7681',
        tabBarStyle: {
          backgroundColor: '#0d1117',
          borderTopColor: '#21262d',
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
        sceneStyle: { backgroundColor: '#0d1117' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon label="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Pipeline',
          tabBarIcon: ({ color }) => <TabIcon label="◎" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20, lineHeight: 22 },
});
