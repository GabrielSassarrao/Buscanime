import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme-context';

export default function MenuScreen() {
  const router = useRouter();
  const { theme, toggleTheme, isDarkMode, allowNsfw, setNsfwEnabled } = useTheme();

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
        {/* BOTÃO DA BUSCA A-Z */}
        <TouchableOpacity style={[styles.button, { backgroundColor: '#A259FF' }]} onPress={() => router.push("/initial-selector")}>
          <Ionicons name="text" size={22} color="#fff" />
          <Text style={styles.buttonText}>Busca por Inicial (A-Z)</Text>
        </TouchableOpacity>
      </View>

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
      <Text style={{ textAlign: 'center', color: theme.subtext, marginTop: 10 }}>Buscanime v2.2.1</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 30, fontWeight: 'bold', marginBottom: 20 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10, marginLeft: 5 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionText: { fontSize: 16, fontWeight: '500' },
  button: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 10, gap: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});