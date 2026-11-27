import '@/lib/polyfills';
import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { THEME } from '@/constants/theme';
import { ProjectsProvider } from '@/context/ProjectsContext';
import { registerBackgroundTask } from '@/lib/background';
import { useAutoScheduler } from '@/hooks/useAutoScheduler';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: THEME.bg,
    card: THEME.surface,
    text: THEME.textPrimary,
    border: THEME.border,
    primary: THEME.accent,
  },
};

function SchedulerHost({ children }: { children: ReactNode }) {
  useAutoScheduler();
  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const t = setTimeout(() => registerBackgroundTask().catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: THEME.bg }}>
        <ProjectsProvider>
          <SchedulerHost>
            <ThemeProvider value={theme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="add-project"
                  options={{
                    title: 'Add repo',
                    presentation: 'modal',
                    headerStyle: { backgroundColor: THEME.surface },
                    headerTintColor: THEME.textPrimary,
                  }}
                />
                <Stack.Screen
                  name="project/[id]"
                  options={{
                    title: 'Project',
                    headerStyle: { backgroundColor: THEME.surface },
                    headerTintColor: THEME.textPrimary,
                  }}
                />
              </Stack>
            </ThemeProvider>
          </SchedulerHost>
        </ProjectsProvider>
      </View>
    </SafeAreaProvider>
  );
}
