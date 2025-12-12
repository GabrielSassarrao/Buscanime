import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ThemeProvider } from './theme-context';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export default function RootLayout() {
  useEffect(() => { checkUpdates(); }, []);

  const checkUpdates = async () => {
    try {
      const saved = await AsyncStorage.getItem('favorites');
      if (!saved) return;
      const favorites = JSON.parse(saved);
      const airingAnimes = favorites.filter(a => a.status === 'Currently Airing');

      for (const anime of airingAnimes) {
        await new Promise(r => setTimeout(r, 1000));
        const response = await fetch(`https://api.jikan.moe/v4/anime/${anime.mal_id}`);
        const data = await response.json();
        if (data.data) {
          const liveEpisodes = data.data.episodes;
          const savedEpisodes = anime.total_episodes;
          if (liveEpisodes && (savedEpisodes === null || liveEpisodes > savedEpisodes)) {
            await Notifications.scheduleNotificationAsync({
              content: { title: "Novo Episódio! 🎉", body: `Saiu episódio novo de ${anime.title}.` },
              trigger: null,
            });
            anime.total_episodes = liveEpisodes;
          }
        }
      }
      await AsyncStorage.setItem('favorites', JSON.stringify(favorites));
    } catch (error) { console.log(error); }
  };

  return (
    <ThemeProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="details" options={{ title: 'Detalhes', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="season" options={{ title: 'Temporada' }} />
        <Stack.Screen name="filter" options={{ title: 'Gêneros', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="filter-results" options={{ title: 'Resultados', headerBackTitle: 'Filtros' }} />
      </Stack>
    </ThemeProvider>
  );
}