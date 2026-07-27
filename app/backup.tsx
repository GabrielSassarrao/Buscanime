import AsyncStorage from '@react-native-async-storage/async-storage';
// Mantendo a correção do erro de versão do Expo
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function BackupScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const gerarBackup = async () => {
    setLoading(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const result = await AsyncStorage.multiGet(keys);
      
      const data = result.reduce((acc: { [key: string]: any }, [key, value]) => {
        if (value) {
            try {
              acc[key] = JSON.parse(value);
            } catch (e) {
              acc[key] = value;
            }
        }
        return acc;
      }, {});

      data['backup_date'] = new Date().toISOString();
      const jsonString = JSON.stringify(data, null, 2);
      
      const fileUri = FileSystem.cacheDirectory + 'buscanime_backup.json';

      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: 'utf8' 
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Salvar Backup'
        });
      } else {
        Alert.alert("Erro", "Compartilhamento indisponível.");
      }

    } catch (error: any) {
      Alert.alert("Erro", "Falha ao gerar backup: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Esconde o header padrão para usarmos o nosso personalizado */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Cabeçalho com Botão Voltar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup</Text>
        <View style={{ width: 28 }} /> 
      </View>
      
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
              <Ionicons name="cloud-upload" size={64} color="#3b82f6" />
          </View>

          <Text style={styles.description}>
            Gere um arquivo .json com todos os seus favoritos e configurações para salvar externamente.
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{margin: 20}} />
          ) : (
            <TouchableOpacity style={styles.button} onPress={gerarBackup}>
              <Text style={styles.buttonText}>Gerar Arquivo de Backup</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Cor correta (Slate 900)
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50, // Ajuste para barra de status
    paddingBottom: 20,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#1e293b', // Cor correta do cartão (Slate 800)
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  iconContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 20,
    borderRadius: 50,
  },
  description: {
    color: '#cbd5e1', // Texto cinza claro
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24
  },
  button: {
    backgroundColor: '#3b82f6', // Azul padrão
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});