import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SortModal from '../../components/SortModal'; // Certifique-se de adicionar a opção no Modal
import { useTheme } from '../theme-context';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState([]);
  const [displayList, setDisplayList] = useState([]);
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [sortOption, setSortOption] = useState('az');
  const [filterOption, setFilterOption] = useState('all');

  const loadFavorites = async () => {
    try {
      const saved = await AsyncStorage.getItem('favorites');
      if (saved) {
        const list = JSON.parse(saved);
        setFavorites(list);
        processList(list, sortOption, filterOption);
      }
    } catch (error) { console.log(error); }
  };

  useFocusEffect(useCallback(() => { loadFavorites(); }, []));

  useEffect(() => {
    if (favorites.length > 0) processList(favorites, sortOption, filterOption);
  }, [sortOption, filterOption, favorites]);

  // Função auxiliar para garantir datas válidas na ordenação
  const getDate = (dateStr: string) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const processList = (list: any[], sort: string, filter: string) => {
    let result = [...list];

    // --- FILTROS ---
    if (filter === 'watched') {
        result = result.filter(item => item.watched === true);
    }
    else if (filter === 'unwatched') {
        result = result.filter(item => !item.watched);
    }
    // NOVO FILTRO: Animes da Temporada (Lançando)
    else if (filter === 'seasonal') {
        result = result.filter(item => item.status === 'Currently Airing');
    }

    // --- ORDENAÇÃO ---
    if (sort === 'az') {
        result.sort((a, b) => a.title.localeCompare(b.title));
    }
    else if (sort === 'score') {
        result.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    else if (sort === 'newest') {
        // Ordena estritamente por data (Mais Recente primeiro)
        result.sort((a, b) => getDate(b.start_date) - getDate(a.start_date));
    }
    else if (sort === 'oldest') {
        // Ordena estritamente por data (Mais Antigo primeiro)
        result.sort((a, b) => getDate(a.start_date) - getDate(b.start_date));
    }

    setDisplayList(result);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
           <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.text }]}>Minha Lista 📂</Text>
        
        <TouchableOpacity 
          onPress={() => setModalVisible(true)}
          style={styles.iconButton}
        >
           <Ionicons name="filter" size={28} color={theme.tint} />
        </TouchableOpacity>
      </View>

      <SortModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)}
        sortOption={sortOption} setSortOption={setSortOption}
        filterOption={filterOption} setFilterOption={setFilterOption}
      />

      {favorites.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.subtext }]}>Sua lista está vazia.</Text>
        </View>
      ) : displayList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.subtext }]}>Nenhum anime encontrado com este filtro.</Text>
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item) => item.mal_id.toString()}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: "/details", params: { animeData: JSON.stringify(item) } })}
            >
              <Image source={{ uri: item.image || item.images?.jpg?.large_image_url }} style={styles.poster} />
              <View style={styles.info}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
                
                {/* Indicadores de Status */}
                <View style={{flexDirection: 'row', gap: 8, marginTop: 5, flexWrap: 'wrap'}}>
                   {item.isFavorite && <Ionicons name="heart" size={16} color="#FF3B30" />}
                   {item.watched && <Ionicons name="checkmark-circle" size={16} color="#34C759" />}
                   
                   {/* Badge para animes da temporada */}
                   {item.status === 'Currently Airing' && (
                     <View style={{flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(52, 199, 89, 0.15)', paddingHorizontal: 6, borderRadius: 4}}>
                        <Text style={{fontSize: 10, color: '#34C759', fontWeight: 'bold'}}>Lançando</Text>
                     </View>
                   )}
                </View>

                <View style={{marginTop: 5}}>
                    <Text style={{color: theme.subtext, fontSize: 11}}>Nota: {item.score || '-'}</Text>
                    {item.start_date && (
                        <Text style={{color: theme.subtext, fontSize: 10}}>
                            {new Date(item.start_date).getFullYear()}
                        </Text>
                    )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 10
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  iconButton: { padding: 5 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16 },
  card: { 
    flexDirection: 'row', 
    marginHorizontal: 15,
    marginBottom: 10, 
    borderRadius: 10, 
    padding: 10, 
    elevation: 2, 
    borderWidth: 1 
  },
  poster: { width: 60, height: 90, borderRadius: 5 },
  info: { marginLeft: 10, flex: 1, justifyContent: 'center' },
  title: { fontWeight: 'bold', fontSize: 15 },
});