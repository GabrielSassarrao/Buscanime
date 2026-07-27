import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme-context';

export default function SearchScreen() {
  const { theme, isDarkMode, allowNsfw } = useTheme(); 
  const router = useRouter();

  const [searchText, setSearchText] = useState('');
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const resetAndSearch = () => {
    if (searchText.trim().length < 3) {
      setErrorMsg("Digite pelo menos 3 letras para pesquisar.");
      return;
    }
    setPage(1);
    setHasMore(true);
    setAnimeList([]);
    fetchAnimes(1);
  };

  const fetchAnimes = async (pageNumber: number) => {
    if (pageNumber === 1) { setLoading(true); setErrorMsg(""); }
    const queryTerm = searchText.trim();

    try {
      // CORREÇÃO: nsfwParam = '&sfw' restaurado!
      const nsfwParam = allowNsfw ? '' : '&sfw';
      const urlJikan = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(queryTerm)}&page=${pageNumber}&limit=24${nsfwParam}`;
      
      const response = await fetch(urlJikan);
      if (!response.ok) throw new Error("Jikan falhou");

      const data = await response.json();
      const newAnimes = data.data || [];
      if (newAnimes.length === 0 || (data.pagination && !data.pagination.has_next_page)) setHasMore(false);
      
      processarAnimes(newAnimes, pageNumber);

    } catch (error) {
      console.log("Jikan caiu! Ativando API Suprema (AniList - Pesquisa)...");

      try {
        const adultFilter = allowNsfw ? '' : ', isAdult: false';
        const queryGraphQL = `
          query ($search: String, $page: Int) {
            Page(page: $page, perPage: 24) {
              pageInfo { hasNextPage }
              media(search: $search, type: ANIME, sort: POPULARITY_DESC${adultFilter}) {
                idMal
                title { romaji }
                coverImage { extraLarge }
                averageScore
                seasonYear
                status
                episodes
              }
            }
          }
        `;

        const resAniList = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            query: queryGraphQL,
            variables: { search: queryTerm, page: pageNumber }
          })
        });

        if (!resAniList.ok) throw new Error("AniList falhou");

        const dataAniList = await resAniList.json();
        const anilistItems = dataAniList.data.Page.media || [];
        
        if (!dataAniList.data.Page.pageInfo.hasNextPage) setHasMore(false);

        const animesTraduzidos = anilistItems
          .filter((item: any) => item.idMal) 
          .map((item: any) => ({
            mal_id: item.idMal,
            title: item.title.romaji || "Sem Título",
            images: {
              jpg: { image_url: item.coverImage.extraLarge, large_image_url: item.coverImage.extraLarge }
            },
            score: item.averageScore ? (item.averageScore / 10).toFixed(2) : null,
            year: item.seasonYear || '?',
            status: item.status === 'RELEASING' ? 'Currently Airing' : 'Finished Airing',
            episodes: item.episodes
          }));

        processarAnimes(animesTraduzidos, pageNumber);

      } catch (erroReserva) {
        if (pageNumber === 1) setErrorMsg("🌐 Servidores instáveis. Nenhuma API respondeu.");
        console.error("Erro AniList:", erroReserva);
        setLoading(false); setLoadingMore(false);
      }
    }
  };

  const processarAnimes = (novos: any[], pageNumber: number) => {
    if (novos.length === 0 && pageNumber === 1) {
      setErrorMsg("Nenhum anime encontrado com esse nome.");
    } else if (novos.length > 0) {
      setAnimeList(prev => {
        const existingIds = new Set(prev.map((a: any) => a.mal_id));
        const unique = novos.filter(a => !existingIds.has(a.mal_id));
        return pageNumber === 1 ? novos : [...prev, ...unique];
      });
      setPage(pageNumber);
    }
    setLoading(false); setLoadingMore(false);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      setLoadingMore(true);
      fetchAnimes(page + 1);
    }
  };

  const abrirNoGoogle = (nomeAnime: string) => {
     const url = `https://www.google.com/search?q=assistir+${encodeURIComponent(nomeAnime)}+online`;
     Linking.openURL(url);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <View style={{flexDirection: 'row', alignItems: 'center', marginVertical: 15}}>
          <TouchableOpacity onPress={() => router.back()} style={{padding: 5, marginRight: 10}}>
             <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text, marginVertical: 0 }]}>Pesquisar</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Digite o nome..."
            placeholderTextColor={theme.subtext}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={resetAndSearch}
          />
        </View>
        <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.tint, borderColor: theme.tint }]} onPress={resetAndSearch}>
          <Ionicons name="search" size={20} color={isDarkMode ? theme.background : "#fff"} />
        </TouchableOpacity>
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 20 }} />
      ) : errorMsg !== "" && animeList.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, textAlign: 'center', fontWeight: 'bold', color: theme.subtext }}>{errorMsg}</Text>
        </View>
      ) : (
        <FlatList
          data={animeList}
          keyExtractor={(item, index) => item.mal_id.toString() + index}
          numColumns={1}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={theme.tint} style={{ margin: 20 }} /> : null}
          renderItem={({ item }) => (
            <View style={[styles.cardContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TouchableOpacity 
                style={styles.cardContent}
                onPress={() => router.push({ pathname: "/details", params: { animeData: JSON.stringify(item) } })}
              >
                <Image source={{ uri: item.images?.jpg?.image_url }} style={styles.poster} />
                <View style={styles.info}>
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={[styles.details, { color: theme.subtext }]}>Ano: {item.year || '?'}</Text>
                  
                  <Text style={[styles.status, { color: item.status === 'Currently Airing' ? '#34C759' : theme.subtext }]}>
                    {item.status === 'Currently Airing' ? '🟢 Lançando' : '🔴 Concluído'}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={[styles.externalButtonsContainer, { borderTopColor: theme.border }]}>
                <Text style={{ color: theme.subtext, fontSize: 11, marginBottom: 5 }}>Onde assistir:</Text>
                <View style={styles.buttonsRow}>
                  <TouchableOpacity 
                    style={[styles.extButton, { backgroundColor: '#2196F3', flex: 1, justifyContent: 'center', alignItems: 'center' }]} 
                    onPress={() => abrirNoGoogle(item.title)}>
                    <Ionicons name="logo-google" size={14} color="#fff" style={{marginRight: 5}} />
                    <Text style={styles.extButtonText}>Pesquisar no Google</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 15 },
  headerTitle: { fontSize: 26, fontWeight: 'bold' },
  searchRow: { flexDirection: 'row', marginBottom: 15, gap: 8 },
  inputContainer: { flex: 1, height: 50, borderWidth: 1, borderRadius: 8, justifyContent: 'center' },
  input: { paddingHorizontal: 15, fontSize: 16 },
  iconButton: { width: 50, height: 50, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cardContainer: { borderRadius: 10, marginBottom: 15, elevation: 3, borderWidth: 1, overflow: 'hidden' },
  cardContent: { flexDirection: 'row', padding: 10 },
  poster: { width: 70, height: 100, borderRadius: 6 },
  info: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  details: { fontSize: 14 },
  status: { fontSize: 12, marginTop: 5, fontWeight: 'bold' },
  externalButtonsContainer: { padding: 10, paddingTop: 5, borderTopWidth: 1 },
  buttonsRow: { flexDirection: 'row', gap: 8 },
  extButton: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 5, flexDirection: 'row' },
  extButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});