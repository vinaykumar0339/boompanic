import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { GameSessionProvider } from '@/game/GameSession';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => { void SplashScreen.hideAsync(); }, []);
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <GameSessionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="game" options={{ gestureEnabled: false }} />
        </Stack>
      </GameSessionProvider>
    </ThemeProvider>
  );
}
