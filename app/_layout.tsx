import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { ThemeProvider } from './theme-context'; // Nota: Aqui usa um ponto (.) pois está na mesma pasta

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="details" options={{ title: 'Detalhes', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="season" options={{ title: 'Temporada' }} />
        <Stack.Screen name="filter" options={{ title: 'Gêneros' }} />
        <Stack.Screen name="filter-results" options={{ title: 'Resultados' }} />
      </Stack>
    </ThemeProvider>
  );
}