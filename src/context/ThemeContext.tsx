import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
  };
}

const lightColors = {
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#111111',
  textSecondary: '#666666',
  border: '#EEEEEE',
  primary: '#FF5722',
};

const darkColors = {
  background: '#0F0F0F',
  card: '#1A1A1A',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  border: '#2A2A2A',
  primary: '#FF7043',
};

export const ThemeContext = createContext<ThemeContextType>({
  darkMode: false,
  toggleDarkMode: () => {},
  colors: lightColors,
});

export const ThemeProvider = ({ children }: any) => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@gasbid:theme').then(val => {
      if (val === 'dark') setDarkMode(true);
    });
  }, []);

  const toggleDarkMode = async () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    await AsyncStorage.setItem('@gasbid:theme', newVal ? 'dark' : 'light');
  };

  const colors = darkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
