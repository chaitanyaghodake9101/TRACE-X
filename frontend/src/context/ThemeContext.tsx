import React, { createContext, useContext, useEffect, useState } from 'react';
import { themeApi } from '../services/api';
import { ThemeConfiguration } from '../types';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: 'dark' | 'light';
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
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

export const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  resolvedTheme: 'dark',
  isDark: true,
  toggleTheme: () => {},
  setThemeMode: () => {},
  activeTheme: DEFAULT_THEME,
  refreshTheme: async () => {},
  backgroundMode: 'slate'
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('tracex_theme_mode');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch (e) {
      // localStorage unavailable fallback
    }
    return 'dark'; // Law enforcement tactical dark mode default
  });

  const [activeTheme, setActiveTheme] = useState<ThemeConfiguration>(DEFAULT_THEME);
  const [backgroundMode, setBackgroundMode] = useState<string>('slate');

  // Compute resolved dark/light state based on system or explicit preference
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => {
    if (themeMode === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return themeMode === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    let resolved: 'dark' | 'light' = 'dark';
    if (themeMode === 'system') {
      resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolved = themeMode;
    }

    setResolvedTheme(resolved);
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [themeMode]);

  // Listen to system preference changes if in 'system' mode
  useEffect(() => {
    if (themeMode !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(newResolved);
      const root = document.documentElement;
      if (newResolved === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.setAttribute('data-theme', 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem('tracex_theme_mode', mode);
    } catch (e) {
      console.warn('Could not persist theme mode to localStorage:', e);
    }
  };

  const toggleTheme = () => {
    const nextMode: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

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
      applyThemeTokens(DEFAULT_THEME);
    }
  };

  useEffect(() => {
    loadTheme();
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        isDark,
        toggleTheme,
        setThemeMode,
        activeTheme,
        refreshTheme: loadTheme,
        backgroundMode
      }}
    >
      <div
        className={`min-h-screen transition-colors duration-300 ${
          isDark
            ? backgroundMode === 'oled'
              ? 'bg-black text-slate-100'
              : 'bg-slate-950 text-slate-100'
            : 'bg-slate-50 text-slate-900'
        }`}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
