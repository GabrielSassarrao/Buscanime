import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
// Mantendo a correção para versões novas do Expo
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
  
  // Controle de etapas: 'initial' -> 'choice' -> 'individual' -> 'syncing'
  const [stage, setStage] = useState('initial'); 
  const [mergedList, setMergedList] = useState<any[]>([]); 
  const [backupIds, setBackupIds] = useState(new Set()); 
  
  // Estados para a sincronização automática
  const [syncProgress, setSyncProgress] = useState(0);
  const [totalToSync, setTotalToSync] = useState(0);
  const [currentAnimeName, setCurrentAnimeName] = useState("");

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

      let listaBackup: any[] = [];
      if (Array.isArray(dadosBackup)) listaBackup = dadosBackup;
      else if (dadosBackup.favorites) listaBackup = dadosBackup.favorites;
      else if (dadosBackup.animes) listaBackup = dadosBackup.animes;

      if (!listaBackup.length) {
        Alert.alert("Erro", "Nenhum anime encontrado no backup.");
        setLoading(false);
        return;
      }

      const jsonAtual = await AsyncStorage.getItem('favorites');
      const listaAtual = jsonAtual ? JSON.parse(jsonAtual) : [];

      // Lógica de Mesclagem
      const mapaUnificado = new Map();
      listaAtual.forEach((anime: any) => mapaUnificado.set(anime.mal_id, { ...anime }));

      const idsDoBackup = new Set();
      listaBackup.forEach((anime: any) => {
        idsDoBackup.add(anime.mal_id);
        // Backup sobrescreve para garantir dados novos, mas preserva watchedEpisodes se preferir
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

  // --- 2. PREPARAR LISTA E INICIAR SYNC ---
  const aplicarDecisao = async (tipo: 'all_watched' | 'all_unwatched' | 'manual') => {
    if (tipo === 'manual') {
      setStage('individual');
      return;
    }

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

    // Em vez de salvar e sair, inicia a sincronização
    iniciarSincronizacaoAutomatica(listaParaSalvar);
  };

  const iniciarSincronizacaoAutomatica = async (lista: any[]) => {
    setStage('syncing');
    setTotalToSync(lista.length);
    setSyncProgress(0);

    const listaAtualizada = [];

    // Loop de Sincronização
    for (let i = 0; i < lista.length; i++) {
        const item = lista[i];
        setCurrentAnimeName(item.title);
        setSyncProgress(i + 1);

        try {
            // Delay curto para não bloquear a API
            await new Promise(resolve => setTimeout(resolve, 800));

            const response = await fetch(`https://api.jikan.moe/v4/anime/${item.mal_id}`);
            
            if (response.status === 429) {
                // Se der limite, espera mais um pouco
                await new Promise(resolve => setTimeout(resolve, 2000));
                i--; // Tenta o mesmo item de novo
                continue;
            }

            const data = await response.json();
            
            if (data.data) {
                const fresh = data.data;
                // Atualiza APENAS metadados, mantém progresso do usuário
                listaAtualizada.push({
                    ...item,
                    title: fresh.title,
                    image: fresh.images?.jpg?.large_image_url || fresh.images?.jpg?.image_url,
                    total_episodes: fresh.episodes,
                    status: fresh.status, // Atualiza "Currently Airing" ou "Finished"
                    score: fresh.score,
                    start_date: fresh.aired?.from, // DATA REAL PARA ORDENAÇÃO
                    year: fresh.year
                });
            } else {
                listaAtualizada.push(item);
            }

        } catch (error) {
            console.log("Erro ao atualizar item:", item.title);
            listaAtualizada.push(item); // Mantém o original se falhar
        }
    }

    // Salva a lista final polida e atualizada
    await AsyncStorage.setItem('favorites', JSON.stringify(listaAtualizada));
    
    Alert.alert(
        "Restauração Completa! 🎉", 
        "Seus animes foram restaurados e atualizados com as datas e status mais recentes.",
        [{ text: "OK", onPress: () => router.push('/(tabs)/favorites') }]
    );
  };

  // Funções auxiliares da seleção manual
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

  const confirmarManual = () => {
      iniciarSincronizacaoAutomatica(mergedList);
  };

  // --- RENDERIZAÇÃO ---

  // TELA DE SINCRONIZAÇÃO (AUTOMÁTICA)
  if (stage === 'syncing') {
    const porcentagem = Math.round((syncProgress / totalToSync) * 100) || 0;
    
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={[styles.card, { alignItems: 'center', justifyContent: 'center', minHeight: 300 }]}>
                <ActivityIndicator size="large" color="#3b82f6" style={{ marginBottom: 20 }} />
                <Text style={styles.title}>Atualizando Dados...</Text>
                
                <Text style={[styles.description, { marginBottom: 10 }]}>
                    Buscando informações oficiais (Datas, Status, Notas) para garantir que sua lista fique perfeita.
                </Text>

                <Text style={{ color: '#fff', fontSize: 40, fontWeight: 'bold', marginVertical: 20 }}>
                    {porcentagem}%
                </Text>

                <Text style={{ color: '#94a3b8', fontSize: 14 }}>
                    Processando: {currentAnimeName}
                </Text>
                
                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 5 }}>
                    ({syncProgress} de {totalToSync})
                </Text>
            </View>
        </View>
    );
  }

  // TELA 1: SELEÇÃO
  if (stage === 'initial') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header Personalizado */}
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Restaurar</Text>
            <View style={{ width: 28 }} />
        </View>
        
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="cloud-download" size={64} color="#3b82f6" />
            </View>
            <Text style={styles.description}>
              Selecione o arquivo .json. O app irá restaurar e **atualizar automaticamente** as datas e status de cada anime.
            </Text>
            <TouchableOpacity style={styles.button} onPress={handleSelecionarArquivo} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Selecionar Arquivo</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // TELA 2: DECISÃO DE STATUS
  if (stage === 'choice') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
            <TouchableOpacity onPress={() => setStage('initial')} style={styles.backButton}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Status dos Animes</Text>
            <View style={{ width: 28 }} />
        </View>
        
        <View style={styles.content}>
          <View style={[styles.card, { alignItems: 'stretch' }]}>
            <Text style={styles.title}>Backup Carregado</Text>
            <Text style={[styles.description, { marginBottom: 20 }]}>
              Encontramos {backupIds.size} animes no arquivo.
              {"\n"}Como deseja marcar o progresso deles?
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

  // TELA 3: LISTA MANUAL
  return (
    <View style={[styles.container, { paddingHorizontal: 0 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
            <TouchableOpacity onPress={() => setStage('choice')} style={styles.backButton}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Revisão Final</Text>
            <View style={{ width: 28 }} />
      </View>
      
      <View style={{ padding: 15, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' }}>
        <Text style={{ color: '#cbd5e1', textAlign: 'center', fontSize: 13 }}>
          Marque os animes que já assistiu. Ao finalizar, o app vai baixar os dados atualizados.
        </Text>
      </View>

      <FlatList
        data={mergedList}
        keyExtractor={(item) => item.mal_id.toString()}
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
        <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981' }]} onPress={confirmarManual}>
            <Text style={styles.buttonText}>Finalizar e Atualizar ({mergedList.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, backgroundColor: '#0f172a' },
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  
  card: { backgroundColor: '#1e293b', padding: 24, borderRadius: 16, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8, width: '100%' },
  iconContainer: { marginBottom: 20, backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 20, borderRadius: 50 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 10, textAlign: 'center' },
  description: { color: '#cbd5e1', fontSize: 16, textAlign: 'center', marginBottom: 30, lineHeight: 24 },
  
  button: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 8, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  optionBtn: { padding: 15, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 10, width: '100%' },
  
  listItem: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 10, marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  poster: { width: 50, height: 75, borderRadius: 5, resizeMode: 'cover' },
  itemTitle: { fontWeight: 'bold', fontSize: 14, color: '#f1f5f9', marginBottom: 4 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1e293b', padding: 20, borderTopWidth: 1, borderTopColor: '#334155' }
});