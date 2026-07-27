import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';

export default function SeasonScreen() {
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  const router = useRouter();
  const { theme, isDarkMode, allowNsfw } = useTheme();

  useEffect(() => {
    fetchSeason(1);
  }, []);

  const fetchSeason = async (pageNumber) => {
    if (pageNumber === 1) { setLoading(true); setErrorMsg(""); }
    
    try {
      // 1. TENTA A JIKAN
      const urlJikan = `https://api.jikan.moe/v4/seasons/now?page=${pageNumber}&limit=24`;
      const response = await fetch(urlJikan);
      
      if (!response.ok) throw new Error("Jikan falhou");
      
      const data = await response.json();
      const newAnimes = data.data || [];
      if (newAnimes.length === 0 || (data.pagination && !data.pagination.has_next_page)) setHasMore(false);
      
      processarAnimes(newAnimes, pageNumber);

    } catch (error) { 
      console.log("Jikan caiu! Ativando API Suprema (AniList)...");
      try {
        // 2. TENTA O ANILIST (GraphQL - Imune a CORS e bloqueios de Web)
        const seasonStr = getAniListSeason();
        const yearStr = new Date().getFullYear();
        
        const query = `
          query ($season: MediaSeason, $seasonYear: Int, $page: Int) {
            Page(page: $page, perPage: 24) {
              pageInfo { hasNextPage }
              media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC, isAdult: ${allowNsfw ? 'null' : 'false'}) {
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
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: { season: seasonStr, seasonYear: yearStr, page: pageNumber }
          })
        });

        if (!resAniList.ok) throw new Error("AniList falhou");

        const dataAniList = await resAniList.json();
        const anilistItems = dataAniList.data.Page.media || [];
        
        if (!dataAniList.data.Page.pageInfo.hasNextPage) setHasMore(false);

        // Converte o AniList para ficar IDÊNTICO ao Jikan
        const animesTraduzidos = anilistItems
          .filter(item => item.idMal) // Filtro anti-bug: só pega anime que existe no MyAnimeList
          .map(item => ({
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

      } catch (e) {
        if (pageNumber === 1) setErrorMsg("🌐 Rede completamente inacessível.");
        console.error("Erro AniList:", e);
        setLoading(false); setLoadingMore(false);
      }
    } 
  };

  const getAniListSeason = () => {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'SPRING';
    if (month >= 6 && month <= 8) return 'SUMMER';
    if (month >= 9 && month <= 11) return 'FALL';
    return 'WINTER';
  };

  const processarAnimes = (novos, pageNumber) => {
    if (novos.length > 0) {
      setAnimeList(prev => {
        const existingIds = new Set(prev.map(a => a.mal_id));
        const unique = novos.filter(a => !existingIds.has(a.mal_id));
        return pageNumber === 1 ? novos : [...prev, ...unique];
      });
      setPage(pageNumber);
    } else if (pageNumber === 1) {
      setErrorMsg("Nenhum anime encontrado.");
    }
    setLoading(false); setLoadingMore(false);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      setLoadingMore(true);
      fetchSeason(page + 1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <Stack.Screen 
        options={{ title: 'Temporada Atual', headerShown: true, headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.text, headerBackTitle: 'Voltar' }} 
      />

      {loading && page === 1 ? (
        <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 50 }} />
      ) : errorMsg !== "" && animeList.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: '#FF3B30' }]}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => fetchSeason(1)} style={[styles.retryBtn, { backgroundColor: theme.tint }]}>
            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={animeList}
          keyExtractor={(item, index) => item.mal_id.toString() + index}
          numColumns={2}
          columnWrapperStyle={styles.row}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={theme.tint} style={{ margin: 20 }} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: "/details", params: { animeData: JSON.stringify(item) } })}
            >
              <Image source={{ uri: item.images?.jpg?.image_url }} style={styles.poster} />
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.statusText, { color: item.status === 'Currently Airing' ? '#34C759' : theme.subtext }]}>
                   {item.status === 'Currently Airing' ? '🟢 Lançando' : '🔴 Concluído'}
                </Text>
                <Text style={[styles.details, { color: theme.subtext }]}>
                  {item.year || 'Atual'} • {item.score ? `⭐ ${item.score}` : '-'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 5 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, textAlign: 'center', fontWeight: 'bold', marginBottom: 20 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  row: { justifyContent: 'space-between', marginBottom: 10 },
  card: { width: '48%', borderRadius: 10, padding: 8, borderWidth: 1, alignItems: 'center' },
  poster: { width: '100%', height: 220, borderRadius: 8, resizeMode: 'cover' },
  textContainer: { marginTop: 8, width: '100%', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  statusText: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  details: { fontSize: 11 },
});