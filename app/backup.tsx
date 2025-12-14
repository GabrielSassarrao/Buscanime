import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Adicionado Platform
import { useTheme } from './theme-context';

export default function BackupScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      // 1. Pega os dados dos favoritos
      const saved = await AsyncStorage.getItem('favorites');
      if (!saved || saved === '[]') {
        Alert.alert("Atenção", "Sua lista está vazia. Nada para salvar.");
        setLoading(false);
        return;
      }

      const fileName = 'animetracker_backup.json';

      // --- ADAPTAÇÃO PARA PC (WEB) ---
      if (Platform.OS === 'web') {
        const blob = new Blob([saved], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Cria link invisível para forçar download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        // Limpeza
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert("Backup baixado! Verifique sua pasta de Downloads.");
        setLoading(false);
        return; 
      }

      // --- LÓGICA ORIGINAL (ANDROID/IOS) ---
      const fileUri = FileSystem.documentDirectory + fileName;

      // Escreve os dados no arquivo
      await FileSystem.writeAsStringAsync(fileUri, saved, { encoding: FileSystem.EncodingType.UTF8 });

      // Abre o compartilhamento
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Salvar Backup do AnimeTracker'
        });
      } else {
        Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
      }
    } catch (error) {
      Alert.alert("Erro", "Falha ao gerar backup.");
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Fazer Backup</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="cloud-upload" size={50} color={theme.tint} style={{ alignSelf: 'center', marginBottom: 20 }} />
        
        <Text style={[styles.text, { color: theme.text }]}>
          Este backup serve para passar seus dados para outros dispositivos ou para novas atualizações do nosso aplicativo.
        </Text>
        <Text style={[styles.text, { color: theme.text, marginTop: 10 }]}>
          No celular, ele abrirá o compartilhamento. No PC, ele fará o download do arquivo JSON.
        </Text>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.tint }]} 
          onPress={handleBackup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#fff" />
              <Text style={styles.buttonText}>Gerar Arquivo de Backup</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  title: { fontSize: 22, fontWeight: 'bold' },
  card: { padding: 20, borderRadius: 15, borderWidth: 1, alignItems: 'center' },
  text: { fontSize: 16, textAlign: 'justify', lineHeight: 24, marginBottom: 5 },
  button: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 10, marginTop: 20, gap: 10, width: '100%', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});