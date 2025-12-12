import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [allowNsfw, setAllowNsfw] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const themeVal = await AsyncStorage.getItem('theme');
        if (themeVal === 'dark') setIsDarkMode(true);
        
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

  // FUNÇÃO DESTRVADA: Recebe true/false direto
  const setNsfwEnabled = (value) => {
    setAllowNsfw(value);
    AsyncStorage.setItem('nsfw', value ? 'true' : 'false');
  };

  const theme = {
    dark: isDarkMode,
    background: isDarkMode ? '#121212' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#000000',
    card: isDarkMode ? '#1E1E1E' : '#f9f9f9',
    tint: '#007AFF',
    tabBar: isDarkMode ? '#121212' : '#FFFFFF',
    border: isDarkMode ? '#333' : '#eee',
    subtext: isDarkMode ? '#aaa' : '#666',
  };

  return (
    // IMPORTANTE: Passamos setNsfwEnabled aqui
    <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode, allowNsfw, setNsfwEnabled }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);