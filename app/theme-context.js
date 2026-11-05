import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemScheme === 'dark' || true); 
  const [allowNsfw, setAllowNsfw] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const themeVal = await AsyncStorage.getItem('theme');
        if (themeVal !== null) setIsDarkMode(themeVal === 'dark');
        
        const nsfwVal = await AsyncStorage.getItem('nsfw');
        setAllowNsfw(nsfwVal === 'true');
      } catch (e) { console.log(e); }
    };
    loadSettings();
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      AsyncStorage.setItem('theme', newVal ? 'dark' : 'light');
      return newVal;
    });
  };

  const setNsfwEnabled = (value) => {
    setAllowNsfw(value);
    AsyncStorage.setItem('nsfw', value ? 'true' : 'false');
  };

  const theme = {
    dark: isDarkMode,
    // Fundo: Azul Escuro Profundo vs Cinza Claro
    background: isDarkMode ? '#0A1A2F' : '#F2F2F7', 
    // Texto: Branco Puro vs Preto
    text: isDarkMode ? '#FFFFFF' : '#000000',       
    // Cartões: Azul um pouco mais claro vs Branco
    card: isDarkMode ? '#112240' : '#FFFFFF',       
    // DESTAQUE (Correção do botão branco):
    // No escuro usa Azul Claro (#0A84FF), no claro usa Azul Padrão (#007AFF)
    tint: isDarkMode ? '#0A84FF' : '#007AFF',       
    tabBar: isDarkMode ? '#0A1A2F' : '#FFFFFF',     
    border: isDarkMode ? '#1B3A57' : '#C6C6C8',     
    // Subtexto: Cinza Claro vs Cinza Escuro
    subtext: isDarkMode ? '#CBD5E0' : '#3C3C43',    
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode, allowNsfw, setNsfwEnabled }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);