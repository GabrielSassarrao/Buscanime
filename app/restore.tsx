import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-context';

export default function RestoreScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  
  // Estados principais
  const [loading, setLoading] = useState(false);
  
  // Estados para o fluxo de conflito
  const [step, setStep] = useState('upload'); // 'upload', 'decision', 'manual'
  const [conflicts, setConflicts] = useState([]); // Lista de animes que existem nos dois lugares
  const [safeList, setSafeList] = useState([]); // Lista de animes que NÃO tem conflito (serão salvos direto)
  
  // No modo manual, usamos isso para controlar as escolhas do usuário
  const [manualSelection, setManualSelection] = useState([]);

  // =======================================================
  // 1. LEITURA E ANÁLISE DO ARQUIVO
  // =======================================================
  const handleFileSelection = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setLoading(true);
      const fileUri = result.assets[0].uri;
      let content = "";

      // Leitura compatível com Web e Mobile
      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        content = await response.text();
      } else {
        content = await FileSystem.readAsStringAsync(fileUri);
      }

      const backupList = JSON.parse(content);

      if (!Array.isArray(backupList)) {
        alert("Arquivo inválido!");
        setLoading(false);
        return;
      }

      // Carrega lista atual do celular
      const currentData = await AsyncStorage.getItem('favorites');
      const currentList = currentData ? JSON.parse(currentData) : [];

      // SEPARA O QUE É CONFLITO DO QUE É NOVO
      const currentIds = new Set(currentList.map(item => item.mal_id));
      
      const novosAnimes = [];
      const animesConflitantes = []; // Existem no backup E na lista atual

      // Analisa o backup
      backupList.forEach(itemBackup => {
        if (currentIds.has(itemBackup.mal_id)) {
          // Encontra o item original para comparar (opcional, mas bom ter)
          const original = currentList.find(i => i.mal_id === itemBackup.mal_id);
          // Adiciona ao conflito, preservando dados do backup mas guardando ref
          animesConflitantes.push({ ...itemBackup, _originalWatched: original.watched });
        } else {
          novosAnimes.push(itemBackup);
        }
      });

      // Lista "Segura" = (Itens atuais que não estão no conflito) + (Novos itens do backup)
      // Basicamente, removemos os duplicados da lista atual temporariamente para reinserir depois de resolvido
      const itensAtuaisSemConflito = currentList.filter(curr => !animesConflitantes.find(c => c.mal_id === curr.mal_id));
      
      const listaBaseParaSalvar = [...itensAtuaisSemConflito, ...novosAnimes];

      setSafeList(listaBaseParaSalvar);
      setConflicts(animesConflitantes);

      // DECISÃO DE FLUXO
      if (animesConflitantes.length > 0) {
        // Se tem conflito, vai para tela de decisão
        setManualSelection(animesConflitantes); // Prepara estado manual
        setStep('decision');
        setLoading(false);
      } else {
        // Se não tem conflito, salva direto
        await saveFinalList(listaBaseParaSalvar);
      }

    } catch (error) {
      console.log(error);
      alert("Erro ao ler arquivo.");
      setLoading(false);
    }
  };

  // =======================================================
  // 2. LÓGICA DE RESOLUÇÃO
  // =======================================================
  
  // Função final que salva tudo no AsyncStorage
  const saveFinalList = async (fullList) => {
    try {
      setLoading(true);
      await AsyncStorage.setItem('favorites', JSON.stringify(fullList));
      
      const msg = `Backup restaurado!\nTotal de animes: ${fullList.length}`;
      if (Platform.OS === 'web') {
        alert(msg);
        router.push("/favorites");
      } else {
        Alert.alert("Sucesso", msg, [{ text: "OK", onPress: () => router.push("/favorites") }]);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  // Resolve todos de uma vez (Tudo Visto ou Tudo Não Visto)
  const resolveAll = (statusWatched) => {
    const resolvedConflicts = conflicts.map(item => ({
      ...item,
      watched: statusWatched
    }));
    
    // Junta: Lista Segura + Lista Resolvida
    const finalList = [...safeList, ...resolvedConflicts];
    saveFinalList(finalList);
  };

  // Salva a decisão manual (um por um)
  const saveManualSelection = () => {
    // manualSelection já está atualizado pelos Switches
    const finalList = [...safeList, ...manualSelection];
    saveFinalList(finalList);
  };

  // Alterna o status na lista manual
  const toggleManualItem = (id) => {
    setManualSelection(prev => prev.map(item => {
      if (item.mal_id === id) {
        return { ...item, watched: !item.watched };
      }
      return item;
    }));
  };

  // =======================================================
  // 3. RENDERIZAÇÃO
  // =======================================================

  // TELA 1: UPLOAD (Padrão)
  if (step === 'upload') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Restaurar Backup" backAction={() => router.back()} theme={theme} />
        
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="cloud-download" size={60} color={theme.tint} style={{ marginBottom: 20 }} />
          <Text style={[styles.text, { color: theme.text }]}>
            Selecione o arquivo de backup (.json).
          </Text>
          <Text style={[styles.subtext, { color: theme.subtext }]}>
            Se houver animes repetidos entre sua lista e o backup, nós perguntaremos o que fazer.
          </Text>

          <ButtonMain 
            text="Selecionar Arquivo" 
            icon="folder-open" 
            onPress={handleFileSelection} 
            loading={loading} 
            theme={theme} 
          />
        </View>
      </View>
    );
  }

  // TELA 2: DECISÃO (Conflitos encontrados)
  if (step === 'decision') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Conflitos Encontrados" backAction={() => setStep('upload')} theme={theme} />
        
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.warningTitle, { color: theme.text }]}>Atenção!</Text>
          <Text style={[styles.text, { color: theme.text, textAlign: 'center' }]}>
            Encontramos <Text style={{fontWeight:'bold'}}>{conflicts.length} animes</Text> que já estão na sua lista, mas também estão no backup.
          </Text>
          <Text style={[styles.subtext, { color: theme.subtext, marginBottom: 20 }]}>
            Como deseja definir o status "Visto" para esses animes repetidos?
          </Text>

          <ButtonOption 
            text="Marcar TODOS como VISTOS" 
            sub="Ignora o status anterior e marca tudo como assistido."
            icon="checkmark-done-circle" 
            color="#34C759"
            onPress={() => resolveAll(true)}
          />

          <ButtonOption 
            text="Marcar TODOS como NÃO VISTOS" 
            sub="Remove o visto de todos os duplicados."
            icon="ellipse-outline" 
            color="#FF3B30"
            onPress={() => resolveAll(false)}
          />

          <ButtonOption 
            text="Decidir Um por Um" 
            sub="Escolher manualmente na lista."
            icon="list" 
            color="#007AFF"
            onPress={() => setStep('manual')}
          />
        </View>
      </View>
    );
  }

  // TELA 3: MANUAL (Lista com Switch)
  if (step === 'manual') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Ajuste Manual" backAction={() => setStep('decision')} theme={theme} />
        
        <Text style={{ color: theme.subtext, marginBottom: 10, textAlign: 'center' }}>
          Ative a chave para marcar como VISTO.
        </Text>

        <FlatList
          data={manualSelection}
          keyExtractor={(item) => item.mal_id.toString()}
          style={{ flex: 1, marginBottom: 20 }}
          renderItem={({ item }) => (
            <View style={[styles.listItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.animeName, { color: theme.text }]} numberOfLines={1}>
                  {item.title || item.nome}
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 12 }}>
                  ID: {item.mal_id}
                </Text>
              </View>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
                <Text style={{ color: item.watched ? '#34C759' : theme.subtext, fontSize: 12, fontWeight: 'bold' }}>
                  {item.watched ? "VISTO" : "NÃO VISTO"}
                </Text>
                <Switch
                  value={item.watched}
                  onValueChange={() => toggleManualItem(item.mal_id)}
                  trackColor={{ false: "#767577", true: theme.tint }}
                  thumbColor={"#fff"}
                />
              </View>
            </View>
          )}
        />

        <ButtonMain 
          text={`Confirmar (${manualSelection.length} animes)`} 
          icon="save" 
          onPress={saveManualSelection} 
          loading={loading} 
          theme={theme} 
        />
      </View>
    );
  }
}

// --- Componentes Auxiliares para limpar o código ---

const Header = ({ title, backAction, theme }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={backAction} style={{ padding: 5 }}>
      <Ionicons name="arrow-back" size={24} color={theme.text} />
    </TouchableOpacity>
    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
    <View style={{ width: 30 }} />
  </View>
);

const ButtonMain = ({ text, icon, onPress, loading, theme }) => (
  <TouchableOpacity 
    style={[styles.button, { backgroundColor: theme.tint }]} 
    onPress={onPress}
    disabled={loading}
  >
    {loading ? <ActivityIndicator color="#fff" /> : (
      <>
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={styles.buttonText}>{text}</Text>
      </>
    )}
  </TouchableOpacity>
);

const ButtonOption = ({ text, sub, icon, color, onPress }) => (
  <TouchableOpacity style={[styles.optionBtn, { borderColor: color }]} onPress={onPress}>
    <Ionicons name={icon} size={28} color={color} />
    <View style={{ flex: 1 }}>
      <Text style={[styles.optionTitle, { color: color }]}>{text}</Text>
      <Text style={styles.optionSub}>{sub}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  card: { padding: 20, borderRadius: 15, borderWidth: 1, alignItems: 'center', width: '100%' },
  text: { fontSize: 16, lineHeight: 24, marginBottom: 10 },
  subtext: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  warningTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  
  button: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 10, width: '100%', justifyContent: 'center', gap: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Estilos da Lista Manual
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1 },
  animeName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },

  // Estilos dos Botões de Opção
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 12, width: '100%', gap: 15, backgroundColor: 'rgba(255,255,255,0.05)' },
  optionTitle: { fontSize: 15, fontWeight: 'bold' },
  optionSub: { fontSize: 12, color: '#888' },
});