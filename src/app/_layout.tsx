import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { AudioProvider } from '@/context/AudioContext';

function AppNavigator() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ animationTypeForReplace: 'pop' }} />
      <Stack.Screen name="game" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AudioProvider>
        <StatusBar hidden />
        <AppNavigator />
      </AudioProvider>
    </ThemeProvider>
  );
}
