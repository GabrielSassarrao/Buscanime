import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';

export default function InitialResults() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { theme, allowNsfw } = useTheme();
  
  const [animes, setAnimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  useEffect(() => {
    fetchAnimes(1);
  }, []);

  const fetchAnimes = async (pageNumber: number) => {
    if (pageNumber === 1) { setLoading(true); setErrorMsg(""); }
    try {
      // CORREÇÃO: '&sfw' sem o '=true' para a Jikan voltar a funcionar!
      const nsfwParam = allowNsfw ? '' : '&sfw';
      const letterParam = params.letter ? `&letter=${params.letter}` : '';
      const urlJikan = `https://api.jikan.moe/v4/anime?order_by=title&sort=asc&limit=24&page=${pageNumber}${letterParam}${nsfwParam}`;
      
      const response = await fetch(urlJikan);
      if (!response.ok) throw new Error("Jikan falhou");

      const data = await response.json();
      const newAnimes = data.data || [];
      if (newAnimes.length === 0 || (data.pagination && !data.pagination.has_next_page)) setHasMore(false);
      
      processarAnimes(newAnimes, pageNumber);

    } catch (error) { 
      console.log("Jikan caiu! Ativando API Suprema (AniList - A a Z)...");
      try {
        // O AniList exige 3 letras. Como é só 1 letra, fazemos a tentativa, mas preparamos o aviso amigável se ele recusar.
        const adultFilter = allowNsfw ? '' : ', isAdult: false';
        const queryGraphQL = `
          query ($search: String, $page: Int) {
            Page(page: $page, perPage: 24) {
              pageInfo { hasNextPage }
              media(search: $search, type: ANIME, sort: TITLE_ROMAJI_ASC${adultFilter}) {
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
            variables: { search: params.letter, page: pageNumber }
          })
        });
        
        if (!resAniList.ok) throw new Error("AniList falhou");

        const dataAniList = await resAniList.json();
        const anilistItems = dataAniList.data?.Page?.media || [];
        if (!dataAniList.data?.Page?.pageInfo?.hasNextPage) setHasMore(false);

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
        
      } catch (e) {
        if (pageNumber === 1) {
            setErrorMsg("🌐 A Jikan caiu e a API reserva exige no mínimo 3 letras para pesquisar.");
        }
        console.error("Erro AniList:", e);
        setLoading(false); setLoadingMore(false);
      }
    } 
  };

  const processarAnimes = (novos: any[], pageNumber: number) => {
    if (novos.length > 0) {
      setAnimes(prev => {
         const existingIds = new Set(prev.map((a: any) => a.mal_id));
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
      fetchAnimes(page + 1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          title: `Iniciados com "${params.letter}"`, 
          headerShown: true, 
          headerStyle: { backgroundColor: theme.background }, 
          headerTintColor: theme.text, 
          headerBackTitle: 'Voltar',
          headerRight: () => null 
        }} 
      />
      
      {loading && page === 1 ? (
        <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 50 }} />
      ) : errorMsg !== "" && animes.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: '#FF3B30' }]}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => fetchAnimes(1)} style={[styles.retryBtn, { backgroundColor: theme.tint }]}>
            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={animes}
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
                  {item.year || '?'} • {item.score ? `⭐ ${item.score}` : '-'}
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