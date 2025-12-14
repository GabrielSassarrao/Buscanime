import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function InitialSelector() {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const [selectedLetter, setSelectedLetter] = useState(null);

  const handleSelect = (letter) => {
    setSelectedLetter(prev => prev === letter ? null : letter);
  };

  const handleApply = () => {
    if (selectedLetter) {
      router.push({
        pathname: "/initial-results",
        params: { letter: selectedLetter }
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Busca Alfabética</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>Selecione uma letra inicial:</Text>
        
        <View style={styles.grid}>
          {alphabet.map((letter) => (
            <TouchableOpacity
              key={letter}
              style={[
                styles.letterButton,
                { 
                  backgroundColor: selectedLetter === letter ? theme.tint : theme.card,
                  borderColor: selectedLetter === letter ? theme.tint : theme.border 
                }
              ]}
              onPress={() => handleSelect(letter)}
            >
              <Text style={[
                styles.letterText, 
                { color: selectedLetter === letter ? '#FFF' : theme.text }
              ]}>
                {letter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
        <TouchableOpacity 
          style={[styles.actionBtn, { borderColor: theme.border, borderWidth: 1 }]} 
          onPress={() => setSelectedLetter(null)}
        >
          <Text style={{ color: theme.text, fontWeight: 'bold' }}>Limpar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: selectedLetter ? theme.tint : theme.border, opacity: selectedLetter ? 1 : 0.5 }]} 
          onPress={handleApply}
          disabled={!selectedLetter}
        >
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Aplicar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, paddingTop: 40 },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { textAlign: 'center', marginBottom: 20, fontSize: 16 },
  scrollContent: { padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  letterButton: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  letterText: { fontSize: 20, fontWeight: 'bold' },
  footer: { flexDirection: 'row', padding: 20, gap: 15, borderTopWidth: 1 },
  actionBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }
});