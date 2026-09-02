import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ShieldCheck, ShieldAlert,
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Save
} from 'lucide-react';
import { adminApi } from '../services/api';
import { SystemHealthData, TamperingAnalyticsData } from '../types';
import { Navbar } from '../components/Navbar';

export const AdminHealthPage: React.FC = () => {
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [tamperData, setTamperData] = useState<TamperingAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retentionYears, setRetentionYears] = useState(7);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  const fetchHealthMetrics = async () => {
    try {
      setLoading(true);
      const [hRes, tRes] = await Promise.all([
        adminApi.getSystemHealth(),
        adminApi.getTamperingAnalytics()
      ]);
      setHealthData(hRes);
      setTamperData(tRes);
    } catch (err) {
      console.error('Failed to load system health metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthMetrics();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      await adminApi.updateConfig({ retention_years: retentionYears });
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update config', err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      default: return <XCircle className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/admin/officers')}
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-cyan-400 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Officers Directory</span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <Activity className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-100">System Health & Infrastructure Diagnostics</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live monitoring of relational databases, graph connectivity, cryptographic integrity, and compliance policies.
            </p>
          </div>

          <button
            onClick={fetchHealthMetrics}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 transition-colors shadow self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* Global Key Stats Chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-[10px] uppercase font-mono text-slate-400">System Status</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${healthData?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-lg font-bold text-slate-100 capitalize">{healthData?.status || 'Active'}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-[10px] uppercase font-mono text-slate-400">Total Cases</span>
            <div className="text-lg font-bold text-cyan-400 mt-1 font-mono">{healthData?.total_cases ?? 0}</div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-[10px] uppercase font-mono text-slate-400">Hashed Evidence Items</span>
            <div className="text-lg font-bold text-emerald-400 mt-1 font-mono">{healthData?.total_evidence ?? 0}</div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-[10px] uppercase font-mono text-slate-400">Total Active Officers</span>
            <div className="text-lg font-bold text-purple-400 mt-1 font-mono">{healthData?.total_users ?? 0}</div>
          </div>
        </div>

        {/* Infrastructure Components Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider font-mono">
            Infrastructure Component Diagnostics
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {healthData?.components.map((comp) => (
              <div key={comp.name} className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    {getStatusIcon(comp.status)}
                    <h3 className="text-sm font-bold text-slate-200">{comp.name}</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold border ${
                    comp.status === 'healthy' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'
                  }`}>
                    {comp.status}
                  </span>
                </div>

                {comp.latency_ms !== undefined && (
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Response Latency:</span>
                    <span className="font-mono text-cyan-400 font-semibold">{comp.latency_ms} ms</span>
                  </div>
                )}

                {comp.details && (
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-1">
                    {Object.entries(comp.details).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                        <span className="text-slate-300 truncate max-w-[200px]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tampering Analytics & Compliance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tampering Metrics Card */}
          <div className="lg:col-span-2 p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 text-cyan-400 font-bold text-sm">
                <ShieldCheck className="w-5 h-5" />
                <h3>Cryptographic Tamper-Detection Overview</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">NIST SHA-256 Engine</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
                <span className="text-[10px] uppercase font-mono text-emerald-400">Verified ✅</span>
                <p className="text-xl font-extrabold text-emerald-300 font-mono mt-0.5">{tamperData?.verified_count ?? 0}</p>
              </div>
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl">
                <span className="text-[10px] uppercase font-mono text-rose-400">Compromised ⚠️</span>
                <p className="text-xl font-extrabold text-rose-300 font-mono mt-0.5">{tamperData?.compromised_count ?? 0}</p>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-[10px] uppercase font-mono text-slate-400">Tamper Rate</span>
                <p className="text-xl font-extrabold text-slate-200 font-mono mt-0.5">{tamperData?.tamper_rate_percentage ?? 0}%</p>
              </div>
            </div>

            {tamperData?.recent_compromised_items && tamperData.recent_compromised_items.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-semibold text-rose-400 flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Recent Tamper Violations Detected</span>
                </span>
                <div className="space-y-1 text-xs">
                  {tamperData.recent_compromised_items.map((item) => (
                    <div key={item.evidence_id} className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-lg flex items-center justify-between text-slate-300">
                      <div>
                        <strong className="text-rose-200">{item.title}</strong>
                        <div className="text-[10px] text-slate-500 font-mono">Case: {item.case_number} • SHA-256: {item.sha256_hash.slice(0, 16)}...</div>
                      </div>
                      <span className="text-[10px] text-rose-400 font-mono">{new Date(item.updated_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Retention Policy Settings Form */}
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-slate-200">Evidentiary Retention Policy</h3>
            <p className="text-xs text-slate-400">
              Configure statutory retention periods for electronic evidence records and immutable audit event logs.
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Evidence Retention Period (Years)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={retentionYears}
                  onChange={(e) => setRetentionYears(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <span className="text-[10px] text-slate-500 block mt-1">Standard statutory baseline: 7 years.</span>
              </div>

              {configSuccess && (
                <div className="p-2 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Retention policy saved.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingConfig}
                className="w-full inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-600/30 text-xs transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingConfig ? 'Saving...' : 'Update Policy'}</span>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
