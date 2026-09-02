import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { HelpWidget } from '../components/HelpWidget';
import { useTheme } from '../components/ThemeProvider';
import { themeApi } from '../services/api';
import { ThemeConfiguration } from '../types';
import {
  Palette,
  RotateCcw,
  Save,
  History
} from 'lucide-react';

const PRESET_THEMES = [
  {
    name: 'Cyber Cyan (Default)',
    primary: '#06b6d4',
    accent: '#3b82f6',
    bg: 'slate',
    font: 'Inter',
    radius: '0.75rem'
  },
  {
    name: 'Tactical Emerald',
    primary: '#10b981',
    accent: '#06b6d4',
    bg: 'oled',
    font: 'Inter',
    radius: '0.5rem'
  },
  {
    name: 'Midnight Purple',
    primary: '#a855f7',
    accent: '#ec4899',
    bg: 'midnight',
    font: 'Outfit',
    radius: '1rem'
  },
  {
    name: 'Crimson Defense',
    primary: '#f43f5e',
    accent: '#fb923c',
    bg: 'slate',
    font: 'Inter',
    radius: '0.5rem'
  },
  {
    name: 'Deep Oceanic Navy',
    primary: '#38bdf8',
    accent: '#818cf8',
    bg: 'navy',
    font: 'Inter',
    radius: '0.75rem'
  }
];

export const AdminThemePage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfiguration | null>(null);
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#06b6d4');
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [backgroundMode, setBackgroundMode] = useState('slate');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [borderRadius, setBorderRadius] = useState('0.75rem');
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      const res = await themeApi.listAdminThemes();
      const current = res.find(t => t.is_active) || res[0];
      if (current) {
        setSelectedTheme(current);
        setName(current.name);
        setPrimaryColor(current.primary_color);
        setAccentColor(current.accent_color);
        setBackgroundMode(current.background_mode);
        setFontFamily(current.font_family);
        setBorderRadius(current.border_radius);
      }
    } catch (err) {
      console.error('Failed to load themes:', err);
    }
  };

  const handleApplyPreset = (p: typeof PRESET_THEMES[0]) => {
    setName(p.name);
    setPrimaryColor(p.primary);
    setAccentColor(p.accent);
    setBackgroundMode(p.bg);
    setFontFamily(p.font);
    setBorderRadius(p.radius);
  };

  const handleSaveAndApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        name,
        primary_color: primaryColor,
        accent_color: accentColor,
        background_mode: backgroundMode,
        font_family: fontFamily,
        border_radius: borderRadius,
        is_active: true,
        custom_css_vars: {
          '--color-brand-primary': primaryColor,
          '--color-brand-accent': accentColor,
          '--theme-border-radius': borderRadius
        }
      };

      if (selectedTheme && selectedTheme.id !== 'default-fallback') {
        await themeApi.updateTheme(selectedTheme.id, payload);
        await themeApi.applyTheme(selectedTheme.id);
      } else {
        const created = await themeApi.createTheme(payload);
        await themeApi.applyTheme(created.id);
      }

      await refreshTheme();
      await loadThemes();
      alert('Theme successfully updated and applied system-wide!');
    } catch (err) {
      console.error('Failed to save theme:', err);
      alert('Failed to save theme. Ensure colors are valid HEX codes.');
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (versionNumber: number) => {
    if (!selectedTheme) return;
    if (!confirm(`Rollback to Version ${versionNumber}?`)) return;
    try {
      setSaving(true);
      await themeApi.rollbackTheme(selectedTheme.id, versionNumber);
      await refreshTheme();
      await loadThemes();
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to rollback theme:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="inline-flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Branding & Design System Engine</span>
                </div>
                <h1 className="text-2xl font-bold text-white">Dynamic Theme & Palette Customizer</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure real-time law enforcement institutional palettes with CSS variable tokens and fallback safety.
                </p>
              </div>

              {selectedTheme?.versions && selectedTheme.versions.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold border border-slate-800 transition"
                >
                  <History className="w-4 h-4 text-cyan-400" />
                  <span>Version Snapshots ({selectedTheme.versions.length})</span>
                </button>
              )}
            </div>

            {/* Version History Drawer */}
            {showHistory && selectedTheme?.versions && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <h3 className="text-xs font-bold uppercase text-cyan-400 flex items-center gap-1.5">
                  <History className="w-4 h-4" /> Theme Version Changelog
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedTheme.versions.map(v => (
                    <div key={v.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-white">Version {v.version_number}</span>
                        <span className="text-slate-400 ml-2 text-[11px]">{new Date(v.created_at).toLocaleString()}</span>
                        {v.change_notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{v.change_notes}</p>}
                      </div>
                      <button
                        onClick={() => handleRollback(v.version_number)}
                        className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded text-xs font-semibold flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Rollback</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Studio Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Left Column: Config Controls */}
              <div className="lg:col-span-2 space-y-6">
                {/* Presets Bar */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Curated Presets</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {PRESET_THEMES.map(p => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition flex items-center space-x-2.5"
                      >
                        <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: p.primary }} />
                        <span className="text-xs font-semibold text-slate-200 truncate">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customizer Form */}
                <form onSubmit={handleSaveAndApply} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Theme Title</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Delhi Police Cyber Ops"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Typography Font</label>
                      <select
                        value={fontFamily}
                        onChange={e => setFontFamily(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="Inter">Inter (Clean Modern Sans)</option>
                        <option value="Outfit">Outfit (High Tech Geometric)</option>
                        <option value="Roboto">Roboto (Standard UI)</option>
                        <option value="JetBrains Mono">JetBrains Mono (Forensic Terminal)</option>
                      </select>
                    </div>

                    {/* Primary Color Picker */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Primary Color (Hex)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={primaryColor.startsWith('#') ? primaryColor : '#06b6d4'}
                          onChange={e => setPrimaryColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          required
                          value={primaryColor}
                          onChange={e => setPrimaryColor(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Accent Color Picker */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Accent Highlight (Hex)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={accentColor.startsWith('#') ? accentColor : '#3b82f6'}
                          onChange={e => setAccentColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          required
                          value={accentColor}
                          onChange={e => setAccentColor(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Background Canvas Mode */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Background Mode</label>
                      <select
                        value={backgroundMode}
                        onChange={e => setBackgroundMode(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="slate">Dark Slate (#020617)</option>
                        <option value="midnight">Deep Midnight (#09090b)</option>
                        <option value="oled">Pure OLED Black (#000000)</option>
                        <option value="navy">Tactical Navy (#0a192f)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Corner Border Radius</label>
                      <select
                        value={borderRadius}
                        onChange={e => setBorderRadius(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="0.25rem">Sharp (4px)</option>
                        <option value="0.5rem">Medium (8px)</option>
                        <option value="0.75rem">Rounded (12px - Standard)</option>
                        <option value="1rem">Pill Smooth (16px)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 text-white rounded-xl text-xs font-semibold shadow-lg transition flex items-center space-x-2"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Applying...' : 'Save & Deploy Theme Live'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Live Interactive Sandbox Preview */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Component Preview</h3>

                <div
                  className="p-6 rounded-2xl border border-slate-800 space-y-5 shadow-2xl transition-all"
                  style={{
                    backgroundColor: backgroundMode === 'oled' ? '#000000' : backgroundMode === 'navy' ? '#0a192f' : '#0f172a',
                    borderRadius: borderRadius,
                    fontFamily: fontFamily
                  }}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
                      <span className="text-xs font-bold text-white">TRACE-X Live Canvas</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded text-white font-semibold" style={{ backgroundColor: accentColor }}>
                      PREVIEW
                    </span>
                  </div>

                  {/* Sample Card */}
                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">4D Evidence Score</span>
                      <span className="text-xs font-mono font-bold" style={{ color: primaryColor }}>
                        88.5% High Quality
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: '88.5%', backgroundColor: primaryColor }} />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Calculated across source credibility, temporal decay, and cross-corroboration.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      className="px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition"
                      style={{ backgroundColor: primaryColor, borderRadius: borderRadius }}
                    >
                      Primary Action
                    </button>
                    <button
                      type="button"
                      className="px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg border border-slate-700 bg-slate-800/80"
                      style={{ borderRadius: borderRadius }}
                    >
                      Secondary
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <HelpWidget />
    </div>
  );
};
