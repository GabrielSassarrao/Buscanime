import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useTheme } from '../app/theme-context';

export default function SortModal({ visible, onClose, sortOption, setSortOption, filterOption, setFilterOption }) {
  const { theme } = useTheme();

  const sortOptions = [
    { label: '🔤 Ordem Alfabética (A-Z)', value: 'az' },
    { label: '📅 Lançamento (Novo)', value: 'newest' },
    { label: '📅 Lançamento (Antigo)', value: 'oldest' },
    { label: '⭐ Melhor Avaliados', value: 'score' },
  ];

  // ADICIONADO: Opção 'seasonal' para filtrar animes lançando
  const filterOptions = [
    { label: 'Todos', value: 'all' },
    { label: '✅ Vistos', value: 'watched' },
    { label: '⭕ Não Vistos', value: 'unwatched' },
    { label: '🟢 Lançando', value: 'seasonal' }, 
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              
              {/* Seção 1: Ordenação */}
              <Text style={[styles.sectionTitle, { color: theme.subtext }]}>ORDENAR POR</Text>
              <View style={styles.row}>
                {sortOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, { backgroundColor: sortOption === opt.value ? theme.tint : 'transparent', borderColor: theme.border }]}
                    onPress={() => setSortOption(opt.value)}
                  >
                    <Text style={{ color: sortOption === opt.value ? '#fff' : theme.text, fontSize: 12, fontWeight: 'bold' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Seção 2: Filtrar Vistos */}
              <Text style={[styles.sectionTitle, { color: theme.subtext, marginTop: 15 }]}>FILTRAR STATUS</Text>
              <View style={styles.row}>
                {filterOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, { backgroundColor: filterOption === opt.value ? theme.tint : 'transparent', borderColor: theme.border }]}
                    onPress={() => setFilterOption(opt.value)}
                  >
                    <Text style={{ color: filterOption === opt.value ? '#fff' : theme.text, fontSize: 12, fontWeight: 'bold' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.card }]} onPress={onClose}>
                <Text style={{ color: theme.tint, fontWeight: 'bold', fontSize: 16 }}>Pronto</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 20, padding: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 10,  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, marginBottom: 5 },
  closeBtn: { alignItems: 'center', marginTop: 20, padding: 10 },
});