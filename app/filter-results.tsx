import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';

export default function FilterResults() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();
  
  const [animes, setAnimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  useEffect(() => {
    fetchAnimes(1);
  }, []);

  const fetchAnimes = async (pageNumber) => {
    if (pageNumber === 1) setLoading(true);
    try {
      const url = `https://api.jikan.moe/v4/anime?genres=${params.genreIds}&limit=24&page=${pageNumber}&order_by=score&sort=desc`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        if(pageNumber === 1) Alert.alert("Ops", "Muitos acessos.");
        return;
      }

      const data = await response.json();
      const newAnimes = data.data || [];

      if (newAnimes.length === 0) {
        setHasMore(false);
      } else {
        setAnimes(prev => {
           const existingIds = new Set(prev.map(a => a.mal_id));
           const unique = newAnimes.filter(a => !existingIds.has(a.mal_id));
           return pageNumber === 1 ? newAnimes : [...prev, ...unique];
        });
        setPage(pageNumber);
      }
    } catch (error) { console.log(error); } 
    finally { setLoading(false); setLoadingMore(false); }
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      setLoadingMore(true);
      fetchAnimes(page + 1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* CORREÇÃO: Botão voltar ativado */}
      <Stack.Screen 
        options={{ 
          title: 'Resultados', 
          headerShown: true, 
          headerStyle: { backgroundColor: theme.background }, 
          headerTintColor: theme.text, 
          headerBackTitle: 'Voltar',
          headerRight: null 
        }} 
      />
      
      {loading && page === 1 ? (
        <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={animes}
          keyExtractor={(item, index) => item.mal_id.toString() + index}
          numColumns={2} 
          columnWrapperStyle={styles.row}
          onEndReached={handleLoadMore} 
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore && <ActivityIndicator size="small" color={theme.tint} style={{ margin: 20 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: "/details", params: { animeData: JSON.stringify(item) } })}
            >
              <Image source={{ uri: item.images.jpg.image_url }} style={styles.poster} />
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
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
  row: { justifyContent: 'space-between', marginBottom: 10 },
  card: { width: '48%', borderRadius: 10, padding: 8, borderWidth: 1, alignItems: 'center' },
  poster: { width: '100%', height: 220, borderRadius: 8, resizeMode: 'cover' },
  textContainer: { marginTop: 8, width: '100%', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  details: { fontSize: 11 },
});