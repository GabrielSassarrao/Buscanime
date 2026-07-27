import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme-context';

export default function HomeScreen() {
  const { theme, isDarkMode } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
           <Ionicons name="film-outline" size={80} color={theme.tint} style={{ marginBottom: 10 }} />
           <Text style={[styles.appName, { color: theme.text }]}>Buscanime</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="information-circle" size={40} color={theme.tint} style={{ marginBottom: 10 }} />
          <Text style={[styles.title, { color: theme.text }]}>Aviso Importante</Text>
          
          <Text style={[styles.text, { color: theme.subtext }]}>
            Este aplicativo é uma ferramenta de <Text style={{fontWeight: 'bold', color: theme.text}}>gerenciamento e rastreamento</Text> de animes.
          </Text>

          <View style={{alignItems: 'flex-start'}}>
            <Text style={[styles.text, { color: theme.subtext }]}>
              • <Text style={{fontWeight: 'bold', color: theme.text}}>Não hospedamos</Text> nenhum vídeo.
            </Text>
            <Text style={[styles.text, { color: theme.subtext }]}>
              • <Text style={{fontWeight: 'bold', color: theme.text}}>Não distribuímos</Text> conteúdo protegido por direitos autorais.
            </Text>
            <Text style={[styles.text, { color: theme.subtext }]}>
              • Apenas organizamos as informações públicas do MyAnimeList.
            </Text>
          </View>

          <Text style={[styles.footerText, { color: theme.subtext }]}>
            Utilize o menu inferior para navegar.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  appName: { fontSize: 28, fontWeight: 'bold' },
  card: { padding: 25, borderRadius: 15, borderWidth: 1, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  text: { fontSize: 16, textAlign: 'left', lineHeight: 24, marginBottom: 10 },
  footerText: { fontSize: 14, textAlign: 'center', marginTop: 20, opacity: 0.7, fontStyle: 'italic' }
});