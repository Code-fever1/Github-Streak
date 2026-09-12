import '@/lib/polyfills';
import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

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
    background: '#0d1117',
    card: '#161b22',
    text: '#e6edf3',
    border: '#30363d',
    primary: '#3fb950',
  },
};

function SchedulerHost({ children }: { children: ReactNode }) {
  useAutoScheduler();
  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    registerBackgroundTask().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#0d1117' }}>
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
                    headerStyle: { backgroundColor: '#161b22' },
                    headerTintColor: '#e6edf3',
                  }}
                />
                <Stack.Screen
                  name="project/[id]"
                  options={{
                    title: 'Project',
                    headerStyle: { backgroundColor: '#161b22' },
                    headerTintColor: '#e6edf3',
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
