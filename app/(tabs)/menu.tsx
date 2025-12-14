import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme-context';

export default function MenuScreen() {
  const router = useRouter();
  const { theme, toggleTheme, isDarkMode, allowNsfw, setNsfwEnabled } = useTheme();
  
  // Estado para guardar os números de estatísticas
  const [stats, setStats] = useState({ favorites: 0, watched: 0 });

  // Carrega as estatísticas toda vez que entra na tela
  useFocusEffect(useCallback(() => {
    loadStats();
  }, []));

  const loadStats = async () => {
    try {
      const saved = await AsyncStorage.getItem('favorites');
      if (saved) {
        const list = JSON.parse(saved);
        // Total da lista são os Favoritos
        const totalFavorites = list.length;
        // Filtra quantos estão marcados como 'watched' (Vistos)
        const totalWatched = list.filter((item: any) => item.watched === true).length;
        
        setStats({ favorites: totalFavorites, watched: totalWatched });
      } else {
        setStats({ favorites: 0, watched: 0 });
      }
    } catch (error) {
      console.log('Erro ao carregar stats:', error);
    }
  };

  const handleSwitchChange = (newValue: boolean) => {
    if (newValue === true) {
      if (Platform.OS === 'web') {
        const aceitou = window.confirm("Conteúdo Adulto\n\nPermitir conteúdo +18 nas buscas?");
        if (aceitou) setNsfwEnabled(true);
        else setNsfwEnabled(false);
      } else {
        Alert.alert(
          "Conteúdo Adulto", 
          "Permitir conteúdo +18 nas buscas?",
          [
            { text: "Cancelar", onPress: () => setNsfwEnabled(false), style: "cancel" },
            { text: "Sim", onPress: () => setNsfwEnabled(true) }
          ]
        );
      }
    } else {
      setNsfwEnabled(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.headerTitle, { color: theme.text }]}>Menu</Text>

      {/* --- NOVA SEÇÃO: ESTATÍSTICAS --- */}
      <View style={styles.statsContainer}>
        {/* Card Favoritos */}
        <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="heart" size={24} color="#FF3B30" style={{ marginBottom: 5 }} />
          <Text style={[styles.statNumber, { color: theme.text }]}>{stats.favorites}</Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>Favoritos</Text>
        </View>

        {/* Card Vistos */}
        <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="checkmark-circle" size={24} color="#34C759" style={{ marginBottom: 5 }} />
          <Text style={[styles.statNumber, { color: theme.text }]}>{stats.watched}</Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>Vistos</Text>
        </View>
      </View>

      {/* --- SEÇÃO: MEUS DADOS (BACKUP) --- */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Meus Dados</Text>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: '#4CD964' }]} onPress={() => router.push("/backup")}>
          <Ionicons name="cloud-upload" size={22} color="#fff" />
          <Text style={styles.buttonText}>Fazer Backup</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: '#007AFF' }]} onPress={() => router.push("/restore")}>
          <Ionicons name="cloud-download" size={22} color="#fff" />
          <Text style={styles.buttonText}>Restaurar (Upload)</Text>
        </TouchableOpacity>
      </View>

      {/* --- SEÇÃO: NAVEGAÇÃO --- */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Navegação</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.tint }]} onPress={() => router.push("/search")}>
          <Ionicons name="search" size={22} color={isDarkMode ? theme.background : "#fff"} />
          <Text style={[styles.buttonText, { color: isDarkMode ? theme.background : "#fff" }]}>Pesquisar Animes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: '#FF3B30' }]} onPress={() => router.push("/favorites")}>
          <Ionicons name="heart" size={22} color="#fff" />
          <Text style={styles.buttonText}>Meus Favoritos</Text>
        </TouchableOpacity>
      </View>

      {/* --- SEÇÃO: DESCOBRIR --- */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Descobrir</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: '#FF9500' }]} onPress={() => router.push("/season")}>
          <Ionicons name="calendar" size={22} color="#fff" />
          <Text style={styles.buttonText}>Animes da Temporada</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: '#FF9500' }]} onPress={() => router.push("/filter")}>
          <Ionicons name="albums" size={22} color="#fff" />
          <Text style={styles.buttonText}>Filtrar por Gênero</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: '#A259FF' }]} onPress={() => router.push("/initial-selector")}>
          <Ionicons name="text" size={22} color="#fff" />
          <Text style={styles.buttonText}>Busca por Inicial (A-Z)</Text>
        </TouchableOpacity>
      </View>

      {/* --- SEÇÃO: PREFERÊNCIAS --- */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Preferências</Text>
        <View style={[styles.optionRow, { backgroundColor: theme.card }]}>
          <View style={styles.iconRow}>
            <Ionicons name={isDarkMode ? "moon" : "sunny"} size={22} color={theme.text} />
            <Text style={[styles.optionText, { color: theme.text }]}>{isDarkMode ? "Modo Escuro" : "Modo Claro"}</Text>
          </View>
          <Switch trackColor={{ false: "#767577", true: theme.tint }} thumbColor={isDarkMode ? "#fff" : "#f4f3f4"} onValueChange={toggleTheme} value={isDarkMode} />
        </View>
        <View style={[styles.optionRow, { backgroundColor: theme.card, marginTop: 10 }]}>
          <View style={styles.iconRow}>
            <Ionicons name={allowNsfw ? "eye" : "eye-off"} size={22} color={allowNsfw ? "#FF3B30" : theme.text} />
            <Text style={[styles.optionText, { color: theme.text }]}>Mostrar Conteúdo +18</Text>
          </View>
          <Switch trackColor={{ false: "#767577", true: "#FF3B30" }} thumbColor={allowNsfw ? "#fff" : "#f4f3f4"} onValueChange={handleSwitchChange} value={allowNsfw} />
        </View>
      </View>
      <Text style={{ textAlign: 'center', color: theme.subtext, marginTop: 10, marginBottom: 30 }}>AnimeTracker v2.3.1</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 30, fontWeight: 'bold', marginBottom: 20 },
  
  // Estilos da nova seção de Stats
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, gap: 15 },
  statBox: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20, 
    borderRadius: 15, 
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  statNumber: { fontSize: 28, fontWeight: 'bold', marginBottom: 5 },
  statLabel: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },

  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10, marginLeft: 5 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionText: { fontSize: 16, fontWeight: '500' },
  button: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 10, gap: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});