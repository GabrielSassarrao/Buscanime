import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export type SortOption = 'alphabetical' | 'newest' | 'oldest' | 'rating';
export type WatchStatusFilter = 'all' | 'watched' | 'unwatched';
export type AiringStatusFilter = 'all' | 'finished' | 'airing';

export default function FavoritesScreen() {
  // Exemplo de lista inicial (substitua pelo seu estado ou carregamento real do AsyncStorage)
  const [favoritesList, setFavoritesList] = useState<any[]>([]);

  // Estados de Filtro e Busca
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');
  const [watchFilter, setWatchFilter] = useState<WatchStatusFilter>('all');
  const [airingFilter, setAiringFilter] = useState<AiringStatusFilter>('all');

  // Lógica de Filtragem e Ordenação Otimizada
  const filteredAndSortedFavorites = useMemo(() => {
    return favoritesList
      .filter((anime) => {
        // 1. Busca por Nome ou Ano
        const query = searchQuery.trim().toLowerCase();
        if (query) {
          const titleMatch = (anime.title || '').toLowerCase().includes(query);
          const yearString = String(anime.year || anime.aired?.prop?.from?.year || '');
          const yearMatch = yearString.includes(query);
          if (!titleMatch && !yearMatch) return false;
        }

        // 2. Filtro Categoria 1: Visto / Não Visto / Todos
        const totalEps = anime.episodes || anime.totalEpisodes || 0;
        const watchedEpsCount = Array.isArray(anime.watchedEpisodes)
          ? anime.watchedEpisodes.length
          : 0;
        const isMarkedWatched =
          anime.watched === true ||
          anime.statusUser === 'watched' ||
          (totalEps > 0 && watchedEpsCount >= totalEps);

        if (watchFilter === 'watched' && !isMarkedWatched) return false;
        if (watchFilter === 'unwatched' && isMarkedWatched) return false;

        // 3. Filtro Categoria 2: Finalizado / Em Andamento / Todos
        const rawStatus = (anime.status || '').toLowerCase();
        const isAiring =
          rawStatus.includes('airing') ||
          rawStatus.includes('releasing') ||
          rawStatus.includes('lancando') ||
          rawStatus.includes('lançando') ||
          rawStatus.includes('andamento');
        const isFinished =
          rawStatus.includes('finished') ||
          rawStatus.includes('complete') ||
          rawStatus.includes('finalizado') ||
          rawStatus.includes('concluido');

        if (airingFilter === 'airing' && !isAiring) return false;
        if (airingFilter === 'finished' && !isFinished) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'alphabetical') {
          return (a.title || '').localeCompare(b.title || '');
        }
        if (sortBy === 'rating') {
          return (Number(b.score) || 0) - (Number(a.score) || 0);
        }
        const yearA = Number(a.year || a.aired?.prop?.from?.year || 0);
        const yearB = Number(b.year || b.aired?.prop?.from?.year || 0);
        if (sortBy === 'newest') return yearB - yearA;
        if (sortBy === 'oldest') return yearA - yearB;
        return 0;
      });
  }, [favoritesList, searchQuery, sortBy, watchFilter, airingFilter]);

  return (
    <View style={styles.container}>
      {/* Barra de Pesquisa */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar por nome ou ano..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros rápidos (Exemplos visuais de alternância) */}
      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {/* Exemplo de Filtro de Assistidos */}
          <TouchableOpacity 
            style={[styles.filterChip, watchFilter === 'all' && styles.chipActive]} 
            onPress={() => setWatchFilter('all')}
          >
            <Text style={styles.chipText}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, watchFilter === 'watched' && styles.chipActive]} 
            onPress={() => setWatchFilter('watched')}
          >
            <Text style={styles.chipText}>Vistos</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, watchFilter === 'unwatched' && styles.chipActive]} 
            onPress={() => setWatchFilter('unwatched')}
          >
            <Text style={styles.chipText}>Não Vistos</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Lista de Animes Filtrados */}
      <FlatList
        data={filteredAndSortedFavorites}
        keyExtractor={(item, index) => String(item.mal_id || index)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image 
              source={{ uri: item.images?.jpg?.image_url || item.image }} 
              style={styles.cardImage} 
            />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardDetails}>Ano: {item.year || 'N/A'} | Nota: ⭐ {item.score || 'N/A'}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum anime encontrado com esses filtros.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1A2F',
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxHeight: 40,
  },
  filterChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#3B82F6',
  },
  chipText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardImage: {
    width: 60,
    height: 80,
  },
  cardInfo: {
    flex: 1,
    padding: 12,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDetails: {
    color: '#94A3B8',
    fontSize: 14,
  },
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
  },
});