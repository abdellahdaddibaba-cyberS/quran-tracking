import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const Colors = {
  light: {
    background: '#f1f5f9',
    surface: '#ffffff',
    card: '#ffffff',
    surfaceAlt: '#e8edf2',
    border: '#dbe4ef',
    text: '#0f172a',
    textMuted: '#64748b',
    textSecondary: '#334155',
    primary: '#1d4ed8',
    success: '#059669',
    danger: '#dc2626',
    warning: '#d97706',
    gold: '#b45309',
    goldBg: 'rgba(180, 83, 9, 0.12)',
    successBg: 'rgba(5, 150, 105, 0.1)',
    dangerBg: 'rgba(220, 38, 38, 0.1)',
    primaryBg: 'rgba(29, 78, 216, 0.1)',
    surfaceTrans: '#f8fafc',
    surfaceTransHover: '#e2e8f0',
    headerGradient: ['#ecfdf5', '#f0f9ff'] as readonly [string, string],
  },
  dark: {
    background: '#0b1220',
    surface: '#1e293b',
    card: '#162032',
    surfaceAlt: '#334155',
    border: 'rgba(148, 163, 184, 0.18)',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    textSecondary: '#cbd5e1',
    primary: '#60a5fa',
    success: '#34d399',
    danger: '#f87171',
    warning: '#fbbf24',
    gold: '#facc15',
    goldBg: 'rgba(250, 204, 21, 0.12)',
    successBg: 'rgba(52, 211, 153, 0.12)',
    dangerBg: 'rgba(248, 113, 113, 0.12)',
    primaryBg: 'rgba(96, 165, 250, 0.12)',
    surfaceTrans: 'rgba(255, 255, 255, 0.06)',
    surfaceTransHover: 'rgba(255, 255, 255, 0.1)',
    headerGradient: ['#0f172a', '#134e4a'] as readonly [string, string],
  },
};

export const Typography = {
  regular: 'Cairo-Regular',
  semiBold: 'Cairo-SemiBold',
  bold: 'Cairo-Bold',
  black: 'Cairo-Black',
};

type ThemeContextType = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  colors: typeof Colors.light;
  typography: typeof Typography;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  colors: Colors.dark,
  typography: Typography,
});

export const useAppTheme = () => useContext(ThemeContext);

export const AppThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    AsyncStorage.getItem('appTheme').then(saved => {
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      }
    });
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem('appTheme', newTheme);
      return newTheme;
    });
  };

  const colors = theme === 'dark' ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors, typography: Typography }}>
      {children}
    </ThemeContext.Provider>
  );
};
