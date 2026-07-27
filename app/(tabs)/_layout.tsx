import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '../theme-context';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Esconde a barra cinza padrão no topo das abas
        tabBarStyle: { 
            backgroundColor: theme.tabBar,
            borderTopColor: theme.border,
            height: 60, 
            paddingBottom: 5
        },
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.subtext,
        tabBarLabelStyle: { fontSize: 12, fontWeight: 'bold' }
      }}>
      
      {/* 1. MENU (Esquerda) */}
      <Tabs.Screen 
        name="menu" 
        options={{ 
            title: 'Menu',
            tabBarIcon: ({ color }) => <Ionicons name="menu" size={24} color={color} />
        }} 
      />

      {/* 2. INÍCIO (Direita) */}
      <Tabs.Screen 
        name="index" 
        options={{ 
            title: 'Início',
            tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />
        }} 
      />
      
      {/* ITENS OCULTOS DA BARRA INFERIOR (Mas acessíveis por navegação) */}
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="details" options={{ href: null }} />
      <Tabs.Screen name="season" options={{ href: null }} />
      <Tabs.Screen name="filter" options={{ href: null }} />
      <Tabs.Screen name="filter-results" options={{ href: null }} />
    </Tabs>
  );
}