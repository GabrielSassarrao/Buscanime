import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme-context';

export default function HomeScreen() {
  const { theme, isDarkMode } = useTheme();
  const router = useRouter();

  const [searchText, setSearchText] = useState('');
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const resetAndSearch = () => {
    setPage(1);
    setHasMore(true);
    setAnimeList([]);
    fetchAnimes(1);
  };

  const fetchAnimes = async (pageNumber) => {
    if (pageNumber === 1) setLoading(true);
    try {
      const url = `https://api.jikan.moe/v4/anime?q=${searchText}&page=${pageNumber}&limit=24`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        if (pageNumber === 1) Alert.alert("Calma", "Muitos pedidos. Espere um pouco.");
        return;
      }

      const data = await response.json();
      const newAnimes = data.data || [];

      if (newAnimes.length === 0) {
        setHasMore(false);
      } else {
        setAnimeList(prev => {
          const existingIds = new Set(prev.map(a => a.mal_id));
          const unique = newAnimes.filter(a => !existingIds.has(a.mal_id));
          return pageNumber === 1 ? newAnimes : [...prev, ...unique];
        });
        setPage(pageNumber);
      }
    } catch (error) { console.error(error); } 
    finally { setLoading(false); setLoadingMore(false); }
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      setLoadingMore(true);
      fetchAnimes(page + 1);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <Text style={[styles.headerTitle, { color: theme.text }]}>Buscanime</Text>

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
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={animeList}
          keyExtractor={(item, index) => item.mal_id.toString() + index}
          numColumns={1}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore && <ActivityIndicator size="small" color={theme.tint} style={{ margin: 20 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: "/details", params: { animeData: JSON.stringify(item) } })}
            >
              <Image source={{ uri: item.images.jpg.image_url }} style={styles.poster} />
              <View style={styles.info}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.details, { color: theme.subtext }]}>Ano: {item.year || '?'}</Text>
                <Text style={[styles.status, { color: item.status === 'Currently Airing' ? 'green' : theme.subtext }]}>
                  {item.status === 'Currently Airing' ? '🟢 Lançando' : '🔴 Concluído'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 15 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', marginVertical: 15, textAlign: 'center' },
  searchRow: { flexDirection: 'row', marginBottom: 15, gap: 8 },
  inputContainer: { flex: 1, height: 50, borderWidth: 1, borderRadius: 8, justifyContent: 'center' },
  input: { paddingHorizontal: 15, fontSize: 16 },
  iconButton: { width: 50, height: 50, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', borderRadius: 10, marginBottom: 15, elevation: 3, padding: 10, borderWidth: 1 },
  poster: { width: 70, height: 100, borderRadius: 6 },
  info: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  details: { fontSize: 14 },
  status: { fontSize: 12, marginTop: 5, fontWeight: 'bold' }
});