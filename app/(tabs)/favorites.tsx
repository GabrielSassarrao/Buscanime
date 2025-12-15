import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SortModal from '../../components/SortModal';
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

  const getDate = (dateStr) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const processList = (list, sort, filter) => {
    let result = [...list];

    // --- FILTROS ---
    if (filter === 'watched') result = result.filter(item => item.watched === true);
    if (filter === 'unwatched') result = result.filter(item => !item.watched);
    if (filter === 'seasonal') result = result.filter(item => item.status === 'Currently Airing');

    // --- ORDENAÇÃO ---
    if (sort === 'az') {
        result.sort((a, b) => a.title.localeCompare(b.title));
    }
    else if (sort === 'score') {
        result.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    else if (sort === 'newest') {
        // Ordena do ano maior para o menor (2025 -> 2024 -> 2023...)
        result.sort((a, b) => getDate(b.start_date) - getDate(a.start_date));
    }
    else if (sort === 'oldest') {
        // Ordena do ano menor para o maior (2000 -> 2001 -> 2002...)
        result.sort((a, b) => getDate(a.start_date) - getDate(b.start_date));
    }

    setDisplayList(result);
  };

  // Função para formatar o ano bonito
  const getYearLabel = (dateStr) => {
    if (!dateStr) return '???';
    return new Date(dateStr).getFullYear();
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
          <Text style={[styles.emptyText, { color: theme.subtext }]}>Nenhum anime encontrado.</Text>
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
                
                {/* LINHA DE DESTAQUE: ANO E NOTA */}
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8}}>
                    {/* Badge do Ano */}
                    <View style={{
                        backgroundColor: theme.tint + '20', // Cor do tema com transparência
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: theme.tint
                    }}>
                        <Text style={{color: theme.tint, fontSize: 11, fontWeight: 'bold'}}>
                            {getYearLabel(item.start_date)}
                        </Text>
                    </View>

                    {/* Nota */}
                    <Text style={{color: theme.subtext, fontSize: 11, fontWeight: '600'}}>
                        ⭐ {item.score || '-'}
                    </Text>
                </View>

                {/* Ícones de Status e Badge Lançando */}
                <View style={{flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
                   {item.isFavorite && <Ionicons name="heart" size={16} color="#FF3B30" />}
                   {item.watched && <Ionicons name="checkmark-circle" size={16} color="#34C759" />}
                   
                   {item.status === 'Currently Airing' && (
                     <Text style={{fontSize: 10, color: '#34C759', fontWeight: 'bold'}}>● Lançando</Text>
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
  title: { fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
});