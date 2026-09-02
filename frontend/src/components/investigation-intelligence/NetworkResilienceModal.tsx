import React, { useState, useEffect } from 'react';
import { ResilienceTestRun, ResilienceNodeMetric, ResilienceMonteCarloRun } from '../../types';
import { intelligenceApi } from '../../services/api';

interface NetworkResilienceModalProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkResilienceModal: React.FC<NetworkResilienceModalProps> = ({
  caseId,
  isOpen,
  onClose,
}) => {
  const [latestRun, setLatestRun] = useState<ResilienceTestRun | null>(null);
  const [nodeMetrics, setNodeMetrics] = useState<ResilienceNodeMetric[]>([]);
  const [monteCarlo, setMonteCarlo] = useState<ResilienceMonteCarloRun | null>(null);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [_loading, setLoading] = useState(false);
  const [runningTest, setRunningTest] = useState(false);

  useEffect(() => {
    if (isOpen && caseId) {
      loadData();
    }
  }, [isOpen, caseId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const run = await intelligenceApi.resilience.getLatest(caseId);
      setLatestRun(run);

      const metrics = await intelligenceApi.resilience.getNodeMetrics(caseId);
      setNodeMetrics(metrics);
    } catch (err) {
      console.error('Failed to load resilience data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunStressTest = async (testType: string = 'node_removal') => {
    setRunningTest(true);
    try {
      const run = await intelligenceApi.resilience.runTest(caseId, {
        test_type: testType,
        removal_fraction: 0.2,
      });
      setLatestRun(run);
      const metrics = await intelligenceApi.resilience.getNodeMetrics(caseId);
      setNodeMetrics(metrics);
    } catch (err) {
      console.error('Failed to run resilience stress test:', err);
    } finally {
      setRunningTest(false);
    }
  };

  const handleRunMonteCarlo = async () => {
    setRunningTest(true);
    try {
      const mc = await intelligenceApi.resilience.runMonteCarlo(caseId, {
        seed: 42,
        iterations: 50,
        perturbation_rate: 0.15,
      });
      setMonteCarlo(mc);
    } catch (err) {
      console.error('Failed to run Monte Carlo stress test:', err);
    } finally {
      setRunningTest(false);
    }
  };

  if (!isOpen) return null;

  const filteredMetrics = nodeMetrics.filter((m) => {
    if (filterTier === 'all') return true;
    return m.stability_classification === filterTier;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xl">
              🕸️
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Network Resilience & Stress-Testing Analyzer
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-700/40">
                  Topological Diagnostics
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Stress-test graph persistence against node removals, single points of failure (SPOFs), and cascading disruptions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Dashboard Bar */}
        <div className="p-6 bg-slate-950/60 border-b border-slate-800 grid grid-cols-4 gap-4">
          <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Network Fragmentation
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {latestRun ? `${(latestRun.fragmentation_index * 100).toFixed(1)}%` : '0.0%'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {latestRun && latestRun.fragmentation_index > 0.4
                ? '🔴 High Fragility Risk'
                : '🟢 Robust Structure'}
            </div>
          </div>

          <div className="p-3 bg-red-950/20 border border-red-800/30 rounded-xl">
            <div className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">
              Fragile / SPOF Nodes
            </div>
            <div className="text-xl font-bold font-mono text-red-300 mt-1">
              {latestRun?.fragile_node_count || 0}
            </div>
            <div className="text-[10px] text-red-400/80 mt-0.5">Single Points of Failure</div>
          </div>

          <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              Sensitive Nodes
            </div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1">
              {latestRun?.sensitive_node_count || 0}
            </div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">Moderate Centrality Shift</div>
          </div>

          <div className="p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-xl">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Stable Core Nodes
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
              {latestRun?.stable_node_count || 0}
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Redundant Path Redundancy</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase">Filter:</span>
            {['all', 'FRAGILE', 'SENSITIVE', 'STABLE'].map((tier) => (
              <button
                key={tier}
                onClick={() => setFilterTier(tier)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  filterTier === tier
                    ? 'bg-slate-700 text-white border-slate-500'
                    : 'bg-slate-800/40 text-slate-400 border-slate-700/60 hover:text-slate-200'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunStressTest('node_removal')}
              disabled={runningTest}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-1.5"
            >
              <span>⚡</span> Run Target Removal
            </button>
            <button
              onClick={handleRunMonteCarlo}
              disabled={runningTest}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/50 transition flex items-center gap-1.5"
            >
              <span>🎲</span> 50-Run Monte Carlo
            </button>
          </div>
        </div>

        {/* Node Metrics Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {monteCarlo && (
            <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🎲</span> Seeded Monte Carlo Simulation ({monteCarlo.iterations} Iterations · Seed {monteCarlo.seed})
                </span>
                <span className="text-xs font-mono text-indigo-400 font-bold">
                  Mean Fragmentation: {(monteCarlo.mean_fragmentation * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {monteCarlo.critical_bridges_json.map((bridge) => (
                  <span
                    key={bridge.entity_id}
                    className="px-2.5 py-1 rounded-md bg-indigo-900/40 border border-indigo-700/50 text-xs text-indigo-200 font-mono"
                  >
                    {bridge.entity_name} ({bridge.criticality_score * 100}% Disruption)
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Entity Structural Stability Classification
            </h4>
            <div className="border border-slate-700/60 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Entity Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Stability Tier</th>
                    <th className="p-3">Betweenness Delta</th>
                    <th className="p-3">Disruption Impact</th>
                    <th className="p-3">Structural Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  {filteredMetrics.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-semibold text-white">{m.entity_name}</td>
                      <td className="p-3 text-slate-400 capitalize">{m.entity_type}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${
                            m.stability_classification === 'FRAGILE'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : m.stability_classification === 'SENSITIVE'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {m.stability_classification === 'FRAGILE'
                            ? '🔴 FRAGILE'
                            : m.stability_classification === 'SENSITIVE'
                            ? '🟡 SENSITIVE'
                            : '🟢 STABLE'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {m.baseline_betweenness.toFixed(3)} → {m.stress_betweenness.toFixed(3)} (
                        {m.centrality_shift_percent.toFixed(1)}%)
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        <div className="w-16 bg-slate-700 rounded-full h-1.5 inline-block mr-2 align-middle">
                          <div
                            className={`h-1.5 rounded-full ${
                              m.disruption_impact_score > 0.6 ? 'bg-red-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${m.disruption_impact_score * 100}%` }}
                          />
                        </div>
                        {m.disruption_impact_score.toFixed(2)}
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs">{m.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
