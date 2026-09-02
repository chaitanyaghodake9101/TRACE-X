import React, { createContext, useContext, useEffect, useState } from 'react';
import { themeApi } from '../services/api';
import { ThemeConfiguration } from '../types';

interface ThemeContextType {
  activeTheme: ThemeConfiguration | null;
  refreshTheme: () => Promise<void>;
  backgroundMode: string;
}

const DEFAULT_THEME: ThemeConfiguration = {
  id: 'default-fallback',
  name: 'Default Cyber Cyan',
  primary_color: '#06b6d4',
  accent_color: '#3b82f6',
  background_mode: 'slate',
  font_family: 'Inter',
  border_radius: '0.75rem',
  is_active: true,
  custom_css_vars: {
    '--color-primary': '#06b6d4',
    '--color-accent': '#3b82f6',
    '--bg-canvas': '#020617'
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const ThemeContext = createContext<ThemeContextType>({
  activeTheme: DEFAULT_THEME,
  refreshTheme: async () => {},
  backgroundMode: 'slate'
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTheme, setActiveTheme] = useState<ThemeConfiguration>(DEFAULT_THEME);
  const [backgroundMode, setBackgroundMode] = useState<string>('slate');

  const applyThemeTokens = (theme: ThemeConfiguration) => {
    try {
      const root = document.documentElement;
      root.style.setProperty('--color-brand-primary', theme.primary_color || '#06b6d4');
      root.style.setProperty('--color-brand-accent', theme.accent_color || '#3b82f6');
      root.style.setProperty('--theme-border-radius', theme.border_radius || '0.75rem');

      if (theme.custom_css_vars) {
        Object.entries(theme.custom_css_vars).forEach(([k, v]) => {
          if (typeof v === 'string') {
            root.style.setProperty(k, v);
          }
        });
      }
      setBackgroundMode(theme.background_mode || 'slate');
    } catch (e) {
      console.warn('ThemeProvider token application failed, falling back to default styling:', e);
    }
  };

  const loadTheme = async () => {
    try {
      const theme = await themeApi.getActiveTheme();
      if (theme && theme.primary_color) {
        setActiveTheme(theme);
        applyThemeTokens(theme);
      } else {
        applyThemeTokens(DEFAULT_THEME);
      }
    } catch (e) {
      // Safe Hard Fallback to default CSS
      applyThemeTokens(DEFAULT_THEME);
    }
  };

  useEffect(() => {
    loadTheme();
  }, []);

  return (
    <ThemeContext.Provider value={{ activeTheme, refreshTheme: loadTheme, backgroundMode }}>
      <div className={`min-h-screen text-slate-100 ${backgroundMode === 'oled' ? 'bg-black' : 'bg-slate-950'}`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
