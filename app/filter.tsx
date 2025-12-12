import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';

const GENRES = [
  { id: 1, name: 'Ação' }, { id: 2, name: 'Aventura' }, { id: 4, name: 'Comédia' }, { id: 8, name: 'Drama' }, 
  { id: 10, name: 'Fantasia' }, { id: 24, name: 'Sci-Fi' }, { id: 14, name: 'Terror' }, { id: 22, name: 'Romance' }, 
  { id: 36, name: 'Slice of Life' }, { id: 30, name: 'Esportes' }, { id: 7, name: 'Mistério' }, { id: 37, name: 'Sobrenatural' }, 
  { id: 41, name: 'Suspense' }, { id: 9, name: 'Ecchi' }, { id: 62, name: 'Isekai' }, { id: 17, name: 'Artes Marciais' }, 
  { id: 18, name: 'Mecha' }, { id: 38, name: 'Militar' }, { id: 23, name: 'Escolar' }, { id: 35, name: 'Harém' }, 
  { id: 13, name: 'Histórico' }, { id: 6, name: 'Demônios' }, { id: 11, name: 'Jogo' }, { id: 31, name: 'Super Poderes' }, 
  { id: 40, name: 'Psicológico' }, { id: 27, name: 'Shounen' }, { id: 25, name: 'Shoujo' }, { id: 42, name: 'Seinen' }, 
  { id: 43, name: 'Josei' }, { id: 15, name: 'Kids' }, { id: 28, name: 'BL' }, { id: 26, name: 'GL' }, { id: 12, name: 'Hentai' }
];

export default function FilterScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [selected, setSelected] = useState([]);

  const toggleGenre = (id) => {
    if (selected.includes(id)) setSelected(selected.filter(item => item !== id));
    else setSelected([...selected, id]);
  };

  const applyFilter = () => {
    if (selected.length === 0) { Alert.alert("Atenção", "Selecione pelo menos um gênero."); return; }
    router.push({ pathname: "/filter-results", params: { genreIds: selected.join(',') } });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Selecione os Gêneros ({selected.length}):</Text>
      <FlatList
        data={GENRES} keyExtractor={item => item.id.toString()} numColumns={2} contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <TouchableOpacity style={[styles.item, { borderColor: isSelected ? theme.tint : theme.border, backgroundColor: isSelected ? theme.tint : theme.card, borderWidth: isSelected ? 2 : 1 }]} onPress={() => toggleGenre(item.id)}>
              <Text style={[styles.itemText, { color: isSelected ? '#fff' : theme.text }]}>{item.name}</Text>
              {isSelected && <Ionicons name="checkmark-circle" size={16} color="#fff" />}
            </TouchableOpacity>
          );
        }}
      />
      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.clearBtn} onPress={() => setSelected([])}><Text style={styles.clearText}>Limpar</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.applyBtn, { backgroundColor: theme.tint }]} onPress={applyFilter}><Text style={styles.applyText}>Aplicar Filtro</Text></TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  item: { flex: 1, margin: 5, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  itemText: { fontWeight: '600', fontSize: 14, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, paddingTop: 10 },
  clearBtn: { padding: 10 },
  clearText: { color: 'red', fontWeight: 'bold', fontSize: 16 },
  applyBtn: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
  applyText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});