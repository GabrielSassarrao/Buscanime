import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
// Mantendo a correção do erro de versão
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function RestoreScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Controle de etapas da restauração
  const [stage, setStage] = useState('initial'); // 'initial' | 'choice' | 'individual'
  const [mergedList, setMergedList] = useState<any[]>([]); 
  const [backupIds, setBackupIds] = useState(new Set()); 

  // --- CABEÇALHO PERSONALIZADO (Reutilizável) ---
  const CustomHeader = ({ title }: { title: string }) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 28 }} />
    </View>
  );

  // --- 1. SELEÇÃO DO ARQUIVO ---
  const handleSelecionarArquivo = async () => {
    setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      const arquivo = result.assets[0];
      const conteudoTexto = await FileSystem.readAsStringAsync(arquivo.uri, { encoding: 'utf8' });

      let dadosBackup;
      try {
        dadosBackup = JSON.parse(conteudoTexto);
      } catch (e) {
        throw new Error("Arquivo inválido.");
      }

      // Normalização dos dados
      let listaBackup: any[] = [];
      if (Array.isArray(dadosBackup)) listaBackup = dadosBackup;
      else if (dadosBackup.favorites) listaBackup = dadosBackup.favorites;
      else if (dadosBackup.animes) listaBackup = dadosBackup.animes;
      else if (dadosBackup.dados && dadosBackup.dados.animes) listaBackup = dadosBackup.dados.animes;

      if (!listaBackup.length) {
        Alert.alert("Erro", "Nenhum anime encontrado no backup.");
        setLoading(false);
        return;
      }

      // Mesclagem
      const jsonAtual = await AsyncStorage.getItem('favorites');
      const listaAtual = jsonAtual ? JSON.parse(jsonAtual) : [];

      const mapaUnificado = new Map();
      listaAtual.forEach((anime: any) => mapaUnificado.set(anime.mal_id, { ...anime }));

      const idsDoBackup = new Set();
      listaBackup.forEach((anime: any) => {
        idsDoBackup.add(anime.mal_id);
        const existente = mapaUnificado.get(anime.mal_id);
        if (existente) {
             mapaUnificado.set(anime.mal_id, { ...existente, ...anime }); 
        } else {
             mapaUnificado.set(anime.mal_id, { ...anime });
        }
      });

      setMergedList(Array.from(mapaUnificado.values()));
      setBackupIds(idsDoBackup);
      setStage('choice'); 

    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. APLICAR DECISÃO ---
  const aplicarDecisao = async (tipo: 'all_watched' | 'all_unwatched' | 'manual') => {
    if (tipo === 'manual') {
      setStage('individual');
      return;
    }

    setLoading(true);
    const listaParaSalvar = mergedList.map(anime => {
      if (backupIds.has(anime.mal_id)) {
        const isWatched = (tipo === 'all_watched');
        let watchedEpisodes = anime.watchedEpisodes || [];
        
        if (isWatched && anime.total_episodes) {
           watchedEpisodes = Array.from({ length: anime.total_episodes }, (_, i) => i + 1);
        } else if (!isWatched) {
           watchedEpisodes = [];
        }
        return { ...anime, watched: isWatched, watchedEpisodes };
      }
      return anime;
    });

    await salvarFinal(listaParaSalvar);
  };

  const salvarFinal = async (lista: any[]) => {
    try {
      await AsyncStorage.setItem('favorites', JSON.stringify(lista));
      Alert.alert("Sucesso", "Backup restaurado com sucesso!", [
        { text: "OK", onPress: () => router.push('/(tabs)/favorites') }
      ]);
    } catch (e) {
      Alert.alert("Erro", "Falha ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const toggleIndividual = (id: number) => {
    setMergedList(prev => prev.map(item => {
       if (item.mal_id === id) {
          const novoStatus = !item.watched;
          let eps = item.watchedEpisodes || [];
          if (novoStatus && item.total_episodes) eps = Array.from({ length: item.total_episodes }, (_, i) => i + 1);
          else if (!novoStatus) eps = [];
          return { ...item, watched: novoStatus, watchedEpisodes: eps };
       }
       return item;
    }));
  };

  // --- RENDERIZAÇÃO ---
  
  // Tela 1: Inicial
  if (stage === 'initial') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <Stack.Screen options={{ headerShown: false }} />
        <CustomHeader title="Restaurar" />
        
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="cloud-download" size={64} color="#3b82f6" />
            </View>
            <Text style={styles.description}>
              Selecione o arquivo .json. Os dados serão combinados com sua lista atual.
            </Text>
            <TouchableOpacity style={styles.button} onPress={handleSelecionarArquivo} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Selecionar Arquivo</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Tela 2: Escolha de Ação
  if (stage === 'choice') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <CustomHeader title="Conflito de Dados" />
        
        <View style={styles.content}>
          <View style={[styles.card, { alignItems: 'stretch' }]}>
            <Text style={styles.title}>Backup Carregado</Text>
            <Text style={[styles.description, { marginBottom: 20 }]}>
              Identificamos {backupIds.size} animes no arquivo.
              {"\n"}Como deseja marcar o status deles?
            </Text>

            <TouchableOpacity style={[styles.optionBtn, { backgroundColor: '#10b981' }]} onPress={() => aplicarDecisao('all_watched')}>
              <Ionicons name="checkmark-done-circle" size={24} color="#fff" />
              <Text style={styles.buttonText}>Marcar Todos VISTOS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.optionBtn, { backgroundColor: '#ef4444' }]} onPress={() => aplicarDecisao('all_unwatched')}>
              <Ionicons name="close-circle" size={24} color="#fff" />
              <Text style={styles.buttonText}>Marcar Todos NÃO VISTOS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.optionBtn, { backgroundColor: '#3b82f6' }]} onPress={() => aplicarDecisao('manual')}>
              <Ionicons name="list" size={24} color="#fff" />
              <Text style={styles.buttonText}>Escolher Manualmente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Tela 3: Lista Individual
  return (
    <View style={[styles.container, { paddingHorizontal: 0 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <CustomHeader title="Revisão Final" />
      
      <View style={{ padding: 15, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' }}>
        <Text style={{ color: '#cbd5e1', textAlign: 'center', fontSize: 13 }}>
          Esta é a lista final combinada. Marque o check nos animes que você JÁ ASSISTIU.
        </Text>
      </View>

      <FlatList
        data={mergedList}
        keyExtractor={item => item.mal_id.toString()}
        contentContainerStyle={{ padding: 10, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <Image source={{ uri: item.image || item.images?.jpg?.image_url }} style={styles.poster} />
            <View style={{ flex: 1, marginLeft: 10, justifyContent: 'center' }}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                   {backupIds.has(item.mal_id) ? '📦 Do Backup' : '📱 Do Celular'}
                </Text>
            </View>
            <View style={{ alignItems: 'center', marginLeft: 5 }}>
                <Text style={{ color: '#fff', fontSize: 10, marginBottom: 5 }}>{item.watched ? 'Visto' : 'Ver'}</Text>
                <Switch 
                    value={item.watched} 
                    onValueChange={() => toggleIndividual(item.mal_id)}
                    trackColor={{ false: "#475569", true: "#3b82f6" }}
                    thumbColor={"#f1f5f9"}
                />
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981' }]} onPress={() => salvarFinal(mergedList)}>
            <Text style={styles.buttonText}>Salvar e Concluir ({mergedList.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a', // Cor de fundo correta
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#0f172a'
  },
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  
  card: { 
    backgroundColor: '#1e293b', // Cor do cartão correta
    padding: 24, 
    borderRadius: 16, 
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    width: '100%'
  },
  iconContainer: { 
    marginBottom: 20, 
    backgroundColor: 'rgba(59, 130, 246, 0.1)', 
    padding: 20, 
    borderRadius: 50 
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center'
  },
  description: { 
    color: '#cbd5e1', 
    fontSize: 16, 
    textAlign: 'center', 
    marginBottom: 30,
    lineHeight: 24
  },
  button: { 
    backgroundColor: '#3b82f6', 
    paddingVertical: 14, 
    borderRadius: 8, 
    width: '100%', 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  optionBtn: {
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 10,
    width: '100%'
  },
  // Estilos da Lista
  listItem: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  poster: { width: 50, height: 75, borderRadius: 5, resizeMode: 'cover' },
  itemTitle: { fontWeight: 'bold', fontSize: 14, color: '#f1f5f9', marginBottom: 4 },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#1e293b',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  }
});