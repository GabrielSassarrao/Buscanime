import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';

const genreTranslations = { "Action": "Ação", "Adventure": "Aventura", "Comedy": "Comédia", "Drama": "Drama", "Fantasy": "Fantasia", "Horror": "Terror", "Mystery": "Mistério", "Romance": "Romance", "Sci-Fi": "Ficção", "Slice of Life": "Cotidiano", "Sports": "Esportes", "Supernatural": "Sobrenatural", "Suspense": "Suspense", "Ecchi": "Ecchi", "Hentai": "Hentai", "Isekai": "Isekai" };

export default function Details() {
  const params = useLocalSearchParams();
  const initialData = params.animeData ? JSON.parse(params.animeData) : null;
  
  const [anime, setAnime] = useState(initialData);
  const [loading, setLoading] = useState(false);
  
  const [isFavorite, setIsFavorite] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  
  const [synopsis, setSynopsis] = useState('');
  const [translating, setTranslating] = useState(false);
  const { theme, isDarkMode } = useTheme();

  // --- CORREÇÃO DO ERRO DO JPG AQUI ---
  // O uso de ?.jpg impede o crash se 'images' não existir
  const imageUrl = anime?.images?.jpg?.large_image_url || anime?.image || 'https://placehold.co/400x600/png';

  useEffect(() => {
    if (initialData) {
      checkStatus();
      fetchFullDetails(initialData.mal_id);
    }
  }, []);

  const fetchFullDetails = async (id) => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.jikan.moe/v4/anime/${id}`);
      const data = await response.json();
      if (data.data) {
        setAnime(data.data);
        const originalText = data.data.synopsis ? data.data.synopsis.replace('[Written by MAL Rewrite]', '') : 'Sem sinopse disponível.';
        setSynopsis(originalText);
      }
    } catch (error) { 
      if (initialData?.synopsis) setSynopsis(initialData.synopsis); 
    } 
    finally { setLoading(false); }
  };

  const checkStatus = async () => {
    try {
      const savedAnimes = await AsyncStorage.getItem('favorites');
      const parsedAnimes = savedAnimes ? JSON.parse(savedAnimes) : [];
      const found = parsedAnimes.find((fav) => fav.mal_id === initialData.mal_id);
      
      if (found) {
        setIsFavorite(found.isFavorite || false);
        setIsWatched(found.watched || false);
      }
    } catch (error) { console.log(error); }
  };

  const updateStorage = async (newFav, newWatch) => {
    try {
      const savedAnimes = await AsyncStorage.getItem('favorites');
      let parsedAnimes = savedAnimes ? JSON.parse(savedAnimes) : [];
      
      parsedAnimes = parsedAnimes.filter((fav) => fav.mal_id !== anime.mal_id);

      if (!newFav && !newWatch) {
        // Removeu tudo
      } else {
        const animeToSave = {
          mal_id: anime.mal_id,
          title: anime.title,
          image: imageUrl, // Salva a URL já corrigida
          total_episodes: anime.episodes,
          status: anime.status,
          score: anime.score,
          start_date: anime.aired?.from,
          isFavorite: newFav,
          watched: newWatch
        };
        parsedAnimes.push(animeToSave);
      }

      await AsyncStorage.setItem('favorites', JSON.stringify(parsedAnimes));
      setIsFavorite(newFav);
      setIsWatched(newWatch);

    } catch (error) { Alert.alert('Erro', 'Falha ao salvar.'); }
  };

  const handleTranslate = async () => {
    if (!synopsis || translating) return;
    setTranslating(true);
    try {
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(synopsis.substring(0, 500))}&langpair=en|pt-BR`);
      const data = await response.json();
      if (data.responseData?.translatedText) setSynopsis(data.responseData.translatedText + "...");
    } catch (error) { Alert.alert("Erro", "Verifique internet."); } finally { setTranslating(false); }
  };

  if (!anime) return <View style={styles.center}><ActivityIndicator size="large" color={theme.tint} /></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <Stack.Screen options={{ title: 'Detalhes', headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.tint }} />

      <Image source={{ uri: imageUrl }} style={styles.cover} />
      
      <View style={[styles.content, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>{anime.title}</Text>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, { 
              backgroundColor: isFavorite ? '#FF3B30' : theme.card, 
              borderColor: isFavorite ? '#FF3B30' : theme.border, 
              borderWidth: 1,
              marginRight: 10 
            }]} 
            onPress={() => updateStorage(!isFavorite, isWatched)}
          >
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={20} color={isFavorite ? "white" : theme.text} />
            <Text style={[styles.btnText, { color: isFavorite ? "white" : theme.text }]}>
              {isFavorite ? 'Favorito' : 'Favoritar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { 
              backgroundColor: isWatched ? '#34C759' : theme.card, 
              borderColor: isWatched ? '#34C759' : theme.border, 
              borderWidth: 1
            }]} 
            onPress={() => updateStorage(isFavorite, !isWatched)}
          >
            <Ionicons name={isWatched ? "checkmark-circle" : "ellipse-outline"} size={20} color={isWatched ? "white" : theme.text} />
            <Text style={[styles.btnText, { color: isWatched ? "white" : theme.text }]}>
              {isWatched ? 'Visto' : 'Marcar Visto'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Text style={[styles.badge, { backgroundColor: theme.card, color: theme.subtext }]}>{anime.year || '?'}</Text>
          <Text style={[styles.badge, { backgroundColor: theme.card, color: theme.subtext }]}>{anime.episodes || '?'} Eps</Text>
          <Text style={[styles.badge, { backgroundColor: theme.card, color: theme.subtext }]}>Nota: {anime.score || '-'}</Text>
        </View>

        <View style={styles.genres}>
          {anime.genres && anime.genres.map((g) => (
            <Text key={g.name} style={[styles.genreText, { color: theme.tint, backgroundColor: isDarkMode ? '#001a33' : '#eef6ff' }]}>#{genreTranslations[g.name] || g.name}</Text>
          ))}
        </View>

        <View style={styles.synopsisHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Sinopse</Text>
          <TouchableOpacity onPress={handleTranslate} style={styles.translateBtn} disabled={translating}>
            <Text style={[styles.translateText, { color: theme.tint }]}>{translating ? "Traduzindo..." : "Traduzir"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.synopsis, { color: theme.subtext }]}>{synopsis}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cover: { width: '100%', height: 350, resizeMode: 'cover' },
  content: { flex: 1, marginTop: -30, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, shadowOpacity: 0.1, elevation: 5 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  actionButtons: { flexDirection: 'row', marginBottom: 20 },
  actionBtn: { flexDirection: 'row', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 5, flex: 1 },
  btnText: { fontWeight: 'bold', fontSize: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 15 },
  badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, fontSize: 12, fontWeight: 'bold', overflow: 'hidden' },
  genres: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 },
  genreText: { fontSize: 12, margin: 4, padding: 6, borderRadius: 6 },
  synopsisHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  translateBtn: { padding: 5 },
  translateText: { fontWeight: 'bold', fontSize: 14 },
  synopsis: { lineHeight: 24, fontSize: 15, textAlign: 'justify' },
});