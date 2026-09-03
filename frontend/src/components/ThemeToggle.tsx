import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabels?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabels = false }) => {
  const { isDark, toggleTheme, themeMode } = useTheme();

  return (
    <div className={`inline-flex items-center ${className}`}>
      <button
        onClick={toggleTheme}
        type="button"
        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode (Current: ${themeMode})`}
        aria-label="Toggle Theme"
        className={`relative p-2 rounded-xl transition-all duration-300 border flex items-center justify-center ${
          isDark
            ? 'bg-slate-900/80 hover:bg-slate-800 text-amber-300 border-slate-700/60 shadow-lg shadow-cyan-950/40 hover:border-cyan-500/40'
            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-md shadow-slate-200/50 hover:border-slate-400'
        }`}
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          {isDark ? (
            <Sun className="w-4 h-4 transition-transform duration-500 rotate-0 hover:rotate-90 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 transition-transform duration-500 -rotate-12 hover:rotate-0 text-cyan-700" />
          )}
        </div>
        {showLabels && (
          <span className={`ml-2 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </span>
        )}
      </button>
    </div>
  );
};
