import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  
  // Estado para controlar o Menu de Links (Onde Assistir)
  const [modalVisible, setModalVisible] = useState(false);
  
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

  // --- FUNÇÃO NOVA: ABRIR LINKS ---
  const openStreamingLink = (platform) => {
    const titleEncoded = encodeURIComponent(anime.title);
    let url = '';

    switch(platform) {
      case 'google':
        // Busca inteligente no Google por "Nome do Anime + Assistir Online + PT-BR"
        url = `https://www.google.com/search?q=assistir+${titleEncoded}+online+legendado+pt-br`;
        break;
      case 'crunchyroll':
        url = `https://www.crunchyroll.com/pt-br/search?q=${titleEncoded}`;
        break;
      case 'youtube':
        url = `https://www.youtube.com/results?search_query=${titleEncoded}+episodio+1+legendado`;
        break;
      case 'netflix':
        // A busca do Netflix via web funciona bem
        url = `https://www.netflix.com/search?q=${titleEncoded}`;
        break;
      default:
        return;
    }

    Linking.openURL(url).catch(err => Alert.alert("Erro", "Não foi possível abrir o link."));
    setModalVisible(false); // Fecha o menu depois de clicar
  };

  if (!anime) return <View style={styles.center}><ActivityIndicator size="large" color={theme.tint} /></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <Stack.Screen options={{ title: 'Detalhes', headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.text, headerRight: null }} />

      <Image source={{ uri: imageUrl }} style={styles.cover} />
      
      <View style={[styles.content, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>{anime.title}</Text>
        
        {/* BOTÕES DE AÇÃO (FAVORITAR / VISTO) */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, { 
              backgroundColor: isFavorite ? '#FF3B30' : theme.card, 
              borderColor: isFavorite ? '#FF3B30' : theme.border, 
              borderWidth: 1, flex: 1
            }]} 
            onPress={() => saveData(!isFavorite, isWatched, watchedEpisodes)}
          >
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={20} color={isFavorite ? "white" : theme.text} />
            <Text style={[styles.btnText, { color: isFavorite ? "white" : theme.text }]}>{isFavorite ? 'Favorito' : 'Favoritar'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { 
              backgroundColor: isWatched ? '#34C759' : theme.card, 
              borderColor: isWatched ? '#34C759' : theme.border, 
              borderWidth: 1, flex: 1
            }]} 
            onPress={toggleGlobalWatched}
          >
            <Ionicons name={isWatched ? "checkmark-circle" : "ellipse-outline"} size={20} color={isWatched ? "white" : theme.text} />
            <Text style={[styles.btnText, { color: isWatched ? "white" : theme.text }]}>{isWatched ? 'Visto Tudo' : 'Visto'}</Text>
          </TouchableOpacity>
        </View>

        {/* --- NOVO BOTÃO: ONDE ASSISTIR --- */}
        <TouchableOpacity 
          style={[styles.watchButton, { backgroundColor: theme.tint }]} 
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="tv" size={22} color="#FFF" />
          <Text style={styles.watchButtonText}>Onde Assistir / Links</Text>
        </TouchableOpacity>

        <View style={styles.infoRow}>
          <Text style={[styles.badge, { backgroundColor: theme.card, color: theme.text }]}>{anime.year || '?'}</Text>
          <Text style={[styles.badge, { backgroundColor: theme.card, color: theme.text }]}>{anime.episodes || '?'} Eps</Text>
          <Text style={[styles.badge, { backgroundColor: theme.card, color: theme.text }]}>Nota: {anime.score || '-'}</Text>
        </View>

        {/* TRACKER DE EPISÓDIOS */}
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
                    style={[styles.epBox, { 
                        backgroundColor: isEpWatched ? '#34C759' : theme.card,
                        borderColor: isEpWatched ? '#34C759' : theme.border
                      }]}
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
        <Text style={[styles.synopsis, { color: theme.text }]}>{synopsis}</Text>

        {/* --- MODAL DE LINKS (O MENU QUE SOBE) --- */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Onde assistir?</Text>
              <Text style={[styles.modalSubtitle, { color: theme.subtext }]}>Selecione uma fonte para buscar {anime.title}:</Text>
              
              <TouchableOpacity style={styles.modalOption} onPress={() => openStreamingLink('google')}>
                <Ionicons name="logo-google" size={24} color={theme.text} />
                <Text style={[styles.modalOptionText, { color: theme.text }]}>Buscar Opções (Google)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption} onPress={() => openStreamingLink('crunchyroll')}>
                <Text style={{fontSize: 24}}>🟠</Text> 
                <Text style={[styles.modalOptionText, { color: '#F47521', fontWeight: 'bold' }]}>Crunchyroll</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption} onPress={() => openStreamingLink('netflix')}>
                <Text style={{fontSize: 24}}>🔴</Text>
                <Text style={[styles.modalOptionText, { color: '#E50914', fontWeight: 'bold' }]}>Netflix</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption} onPress={() => openStreamingLink('youtube')}>
                <Ionicons name="logo-youtube" size={24} color="#FF0000" />
                <Text style={[styles.modalOptionText, { color: theme.text }]}>YouTube</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.closeButton, { backgroundColor: theme.background }]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.closeButtonText, { color: theme.text }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
  
  actionButtons: { flexDirection: 'row', gap: 10, marginBottom: 15 }, // Ajustei para caber melhor
  actionBtn: { flexDirection: 'row', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  btnText: { fontWeight: 'bold', fontSize: 14 },

  // Estilos do Botão Onde Assistir
  watchButton: { flexDirection: 'row', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
  watchButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

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

  // Estilos do Modal (Menu)
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, marginBottom: 20, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#ccc', gap: 15 },
  modalOptionText: { fontSize: 16, fontWeight: '500' },
  closeButton: { marginTop: 20, padding: 15, borderRadius: 10, alignItems: 'center' },
  closeButtonText: { fontWeight: 'bold' }
});