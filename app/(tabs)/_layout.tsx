import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '../theme-context';

export default function TabLayout() {
  const { theme } = useTheme();
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border, height: 60, paddingBottom: 5 },
      tabBarActiveTintColor: theme.tint,
      tabBarInactiveTintColor: theme.subtext,
      tabBarLabelStyle: { fontSize: 12, fontWeight: 'bold' }
    }}>
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => <Ionicons name="menu" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pesquisar',
          tabBarIcon: ({ color }) => <Ionicons name="search" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoritos',
          tabBarIcon: ({ color }) => <Ionicons name="heart" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}