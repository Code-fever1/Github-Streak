import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { THEME } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME.accent,
        tabBarInactiveTintColor: THEME.textMuted,
        tabBarStyle: {
          backgroundColor: THEME.bg,
          borderTopColor: THEME.border,
          borderTopWidth: 1,
          height: 66 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        sceneStyle: { backgroundColor: THEME.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <AppIcon name="dashboard" color={color} size={20} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="github"
        options={{
          title: 'GitHub',
          tabBarIcon: ({ color, focused }) => (
            <AppIcon name="github" color={color} size={20} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="charge"
        options={{
          title: 'Charge',
          tabBarIcon: ({ color, focused }) => (
            <AppIcon name="charge" color={color} size={20} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="notification"
        options={{
          title: 'Notification',
          tabBarIcon: ({ color, focused }) => (
            <AppIcon name="notification" color={color} size={20} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <AppIcon name="settings" color={color} size={20} active={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
