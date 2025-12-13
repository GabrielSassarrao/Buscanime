import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';

const genreTranslations = { "Action": "Ação", "Adventure": "Aventura", "Comedy": "Comédia", "Drama": "Drama", "Fantasy": "Fantasia", "Horror": "Terror", "Mystery": "Mistério", "Romance": "Romance", "Sci-Fi": "Ficção", "Slice of Life": "Cotidiano", "Sports": "Esportes", "Supernatural": "Sobrenatural", "Suspense": "Suspense", "Ecchi": "Ecchi", "Hentai": "Hentai", "Isekai": "Isekai" };

export default function Details() {
  const params = useLocalSearchParams();
  const initialData = params.animeData ? JSON.parse(params.animeData) : null;
  
  const [anime, setAnime] = useState(initialData);
  const [loading, setLoading] = useState(false);
  
  const [isFavorite, setIsFavorite] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState([]); 
  
  const [synopsis, setSynopsis] = useState('');
  const [translating, setTranslating] = useState(false);
  const { theme, isDarkMode } = useTheme();

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
        setWatchedEpisodes(found.watchedEpisodes || []);
      }
    } catch (error) { console.log(error); }
  };

  const saveData = async (favStatus, watchStatus, episodesList) => {
    try {
      const savedAnimes = await AsyncStorage.getItem('favorites');
      let parsedAnimes = savedAnimes ? JSON.parse(savedAnimes) : [];
      parsedAnimes = parsedAnimes.filter((fav) => fav.mal_id !== anime.mal_id);

      if (favStatus || watchStatus || episodesList.length > 0) {
        const animeToSave = {
          mal_id: anime.mal_id,
          title: anime.title,
          image: imageUrl,
          total_episodes: anime.episodes,
          status: anime.status,
          score: anime.score,
          start_date: anime.aired?.from,
          isFavorite: favStatus,
          watched: watchStatus,
          watchedEpisodes: episodesList
        };
        parsedAnimes.push(animeToSave);
      }

      await AsyncStorage.setItem('favorites', JSON.stringify(parsedAnimes));
      setIsFavorite(favStatus);
      setIsWatched(watchStatus);
      setWatchedEpisodes(episodesList);
    } catch (error) { Alert.alert('Erro', 'Falha ao salvar progresso.'); }
  };

  const toggleGlobalWatched = () => {
    const newStatus = !isWatched;
    let newEpisodesList = [];
    if (newStatus && anime?.episodes) {
      newEpisodesList = Array.from({ length: anime.episodes }, (_, i) => i + 1);
    } else {
      newEpisodesList = [];
    }
    saveData(isFavorite, newStatus, newEpisodesList);
  };

  const toggleEpisode = (epNumber) => {
    let newList = [...watchedEpisodes];
    if (newList.includes(epNumber)) {
      newList = newList.filter(e => e !== epNumber);
    } else {
      newList.push(epNumber);
    }
    const allWatched = anime?.episodes && newList.length === anime.episodes;
    saveData(true, allWatched, newList);
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

  // --- NOVA FUNÇÃO: ABRIR NO GOOGLE ---
  const abrirNoGoogle = () => {
    const query = `assistir ${anime.title} online`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    Linking.openURL(url);
 };

  if (!anime) return <View style={styles.center}><ActivityIndicator size="large" color={theme.tint} /></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <Stack.Screen options={{ title: 'Detalhes', headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.text, headerRight: null }} />

      <Image source={{ uri: imageUrl }} style={styles.cover} />
      
      <View style={[styles.content, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>{anime.title}</Text>
        
        {/* BOTÕES DE AÇÃO (Favorito / Visto) */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, { 
              backgroundColor: isFavorite ? '#FF3B30' : theme.card, 
              borderColor: isFavorite ? '#FF3B30' : theme.border, 
              borderWidth: 1, marginRight: 10 
            }]} 
            onPress={() => saveData(!isFavorite, isWatched, watchedEpisodes)}
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
            onPress={toggleGlobalWatched}
          >
            <Ionicons name={isWatched ? "checkmark-circle" : "ellipse-outline"} size={20} color={isWatched ? "white" : theme.text} />
            <Text style={[styles.btnText, { color: isWatched ? "white" : theme.text }]}>
              {isWatched ? 'Visto Tudo' : 'Marcar Visto'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* NOVO BOTÃO: BUSCAR NO GOOGLE (SOZINHO) */}
        <TouchableOpacity 
          style={[styles.googleBtn, { backgroundColor: '#4285F4', borderColor: theme.border }]} 
          onPress={abrirNoGoogle}
        >
          <Ionicons name="logo-google" size={20} color="white" />
          <Text style={[styles.btnText, { color: 'white' }]}>Buscar Episódios no Google</Text>
        </TouchableOpacity>

        <View style={styles.infoRow}>
          <Text style={[styles.badge, { backgroundColor: theme.card, color: theme.text }]}>{anime.year || '?'}</Text>
          <Text style={[styles.badge, { backgroundColor: theme.card, color: theme.text }]}>{anime.episodes || '?'} Eps</Text>
          <Text style={[styles.badge, { backgroundColor: theme.card, color: theme.text }]}>Nota: {anime.score || '-'}</Text>
        </View>

        {/* GRADE DE EPISÓDIOS */}
        {anime.episodes && anime.episodes > 1 && (
          <View style={styles.trackerContainer}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 10 }]}>
              Progresso ({watchedEpisodes.length}/{anime.episodes})
            </Text>
            <View style={styles.episodesGrid}>
              {Array.from({ length: anime.episodes }, (_, i) => i + 1).map((num) => {
                const isEpWatched = watchedEpisodes.includes(num);
                return (
                  <TouchableOpacity 
                    key={num} 
                    style={[
                      styles.epBox, 
                      { 
                        backgroundColor: isEpWatched ? '#34C759' : theme.card,
                        borderColor: isEpWatched ? '#34C759' : theme.border
                      }
                    ]}
                    onPress={() => toggleEpisode(num)}
                  >
                    <Text style={[styles.epText, { color: isEpWatched ? '#FFF' : theme.text }]}>{num}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.genres}>
          {anime.genres && anime.genres.map((g) => (
            <Text key={g.name} style={[styles.genreText, { color: theme.text, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>#{genreTranslations[g.name] || g.name}</Text>
          ))}
        </View>

        <View style={styles.synopsisHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Sinopse</Text>
          <TouchableOpacity onPress={handleTranslate} style={styles.translateBtn} disabled={translating}>
            <Text style={[styles.translateText, { color: theme.tint }]}>{translating ? "Traduzindo..." : "Traduzir"}</Text>
          </TouchableOpacity>
        </View>
        {/* CORREÇÃO DA COR DA SINOPSE AQUI TAMBÉM */}
        <Text style={[styles.synopsis, { color: theme.text }]}>{synopsis}</Text>
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
  actionButtons: { flexDirection: 'row', marginBottom: 10 }, // Reduzi margem para caber o Google
  actionBtn: { flexDirection: 'row', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 5, flex: 1 },
  // Estilo do Botão Google
  googleBtn: { flexDirection: 'row', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, borderWidth: 1 },
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
  trackerContainer: { marginBottom: 20 },
  episodesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  epBox: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1 },
  epText: { fontWeight: 'bold', fontSize: 12 },
});