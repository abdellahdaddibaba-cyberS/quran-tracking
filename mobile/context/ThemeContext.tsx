import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const Colors = {
  light: {
    background: '#f0f4f8',       // خلفية رمادية فاتحة واضحة
    surface: '#ffffff',           // بطاقات بيضاء
    surfaceAlt: '#e8edf2',        // بطاقات بديلة
    border: '#c8d3e0',            // حدود واضحة
    text: '#1a1a2e',              // نص أسود داكن واضح
    textMuted: '#4a5568',         // نص رمادي متوسط مقروء
    textSecondary: '#2d3748',     // نص ثانوي داكن
    primary: '#2563eb',           // أزرق أغمق للوضوح
    success: '#16a34a',           // أخضر داكن
    danger: '#dc2626',            // أحمر داكن
    warning: '#d97706',           // برتقالي داكن
    gold: '#b45309',              // ذهبي داكن
    goldBg: 'rgba(180, 83, 9, 0.12)',
    successBg: 'rgba(22, 163, 74, 0.12)',
    dangerBg: 'rgba(220, 38, 38, 0.12)',
    surfaceTrans: '#e2e8f0',      // خلفية البطاقات الشفافة - رمادي واضح
    surfaceTransHover: '#cbd5e1',  // عند التمرير
  },
  dark: {
    background: '#0f172a',
    surface: '#1e293b',
    surfaceAlt: '#334155',
    border: 'rgba(255,255,255,0.1)',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    textSecondary: '#cbd5e1',
    primary: '#3b82f6',
    success: '#22c55e',
    danger: '#ef4444',
    warning: '#f59e0b',
    gold: '#eab308',
    goldBg: 'rgba(234, 179, 8, 0.1)',
    successBg: 'rgba(34, 197, 94, 0.1)',
    dangerBg: 'rgba(239, 68, 68, 0.1)',
    surfaceTrans: 'rgba(255, 255, 255, 0.05)',
    surfaceTransHover: 'rgba(255, 255, 255, 0.08)',
  }
};

type ThemeContextType = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  colors: typeof Colors.light;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  colors: Colors.dark,
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
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};
