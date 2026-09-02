import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { HelpWidget } from '../components/HelpWidget';
import { featureFlagsApi } from '../services/api';
import { FeatureFlag } from '../types';
import {
  Sliders,
  Radio,
  Clock
} from 'lucide-react';

export const AdminFeatureFlagsPage: React.FC = () => {
  const navigate = useNavigate();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    try {
      const res = await featureFlagsApi.listAdminFlags();
      setFlags(res);
    } catch (err) {
      console.error('Failed to load feature flags:', err);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      setTogglingKey(flag.key);
      const updated = await featureFlagsApi.toggleFlag(flag.key, !flag.is_enabled);
      setFlags(prev => prev.map(f => (f.key === flag.key ? updated : f)));
    } catch (err) {
      console.error('Failed to toggle flag:', err);
      alert('Failed to update feature flag.');
    } finally {
      setTogglingKey(null);
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
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="inline-flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Runtime Configuration & Outbox Sync</span>
                </div>
                <h1 className="text-2xl font-bold text-white">Feature Flags Command Matrix</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dynamically enable or disable platform modules without redeployment. State changes are broadcasted via WebSocket outbox.
                </p>
              </div>

              <div className="inline-flex items-center space-x-2 px-3.5 py-2 bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 rounded-xl text-xs font-semibold">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Real-time Outbox Sync Active</span>
              </div>
            </div>

            {/* Matrix Cards */}
            <div className="space-y-4">
              {flags.map(flag => {
                const isBusy = togglingKey === flag.key;

                return (
                  <div
                    key={flag.key}
                    className={`p-6 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      flag.is_enabled
                        ? 'bg-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-950/20'
                        : 'bg-slate-900/40 border-slate-800/80 opacity-75'
                    }`}
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center space-x-2.5">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                            flag.is_enabled
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {flag.category}
                        </span>
                        <h3 className="text-sm font-bold text-white">{flag.name}</h3>
                        <span className="text-xs font-mono text-slate-500">{flag.key}</span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{flag.description}</p>

                      <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2 pt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Last updated: {new Date(flag.updated_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(flag)}
                        disabled={isBusy}
                        className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          flag.is_enabled ? 'bg-cyan-500' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            flag.is_enabled ? 'translate-x-7' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-xs font-semibold text-slate-200 min-w-[70px]">
                        {flag.is_enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      <HelpWidget />
    </div>
  );
};
