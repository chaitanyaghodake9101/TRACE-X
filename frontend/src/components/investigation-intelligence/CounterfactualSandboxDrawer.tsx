import React, { useState, useEffect } from 'react';
import {
  SimulationBranch,
  Evidence,
  Hypothesis,
} from '../../types';
import { intelligenceApi } from '../../services/api';

interface CounterfactualSandboxDrawerProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
  evidenceList: Evidence[];
  hypothesesList: Hypothesis[];
}

export const CounterfactualSandboxDrawer: React.FC<CounterfactualSandboxDrawerProps> = ({
  caseId,
  isOpen,
  onClose,
  evidenceList,
  hypothesesList,
}) => {
  const [branches, setBranches] = useState<SimulationBranch[]>([]);
  const [activeBranch, setActiveBranch] = useState<SimulationBranch | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchDesc, setBranchDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [_loading, setLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && caseId) {
      loadBranches();
    }
  }, [isOpen, caseId]);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const data = await intelligenceApi.simulations.listBranches(caseId);
      setBranches(data);
      if (data.length > 0 && !activeBranch) {
        loadBranchDetails(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load simulation branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBranchDetails = async (branchId: string) => {
    try {
      const branch = await intelligenceApi.simulations.getBranch(branchId);
      setActiveBranch(branch);
    } catch (err) {
      console.error('Failed to load branch details:', err);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;

    try {
      const newBranch = await intelligenceApi.simulations.createBranch(caseId, {
        name: branchName,
        description: branchDesc,
      });
      setBranchName('');
      setBranchDesc('');
      setIsCreating(false);
      await loadBranches();
      loadBranchDetails(newBranch.id);
    } catch (err) {
      console.error('Failed to create simulation branch:', err);
    }
  };

  const handleToggleEvidence = async (evidenceId: string) => {
    if (!activeBranch) return;

    try {
      const existingOverride = activeBranch.evidence_overrides?.find(
        (o) => o.evidence_id === evidenceId
      );

      if (existingOverride) {
        // Remove override
        await intelligenceApi.simulations.deleteOverride(existingOverride.id);
      } else {
        // Add exclusion override
        await intelligenceApi.simulations.addOverride(activeBranch.id, {
          evidence_id: evidenceId,
          is_excluded: true,
          notes: 'Excluded from simulation branch scenario',
        });
      }
      loadBranchDetails(activeBranch.id);
    } catch (err) {
      console.error('Failed to toggle evidence in simulation:', err);
    }
  };

  const handleSubmitReviewRequest = async () => {
    if (!activeBranch) return;
    setReviewSubmitting(true);
    try {
      await intelligenceApi.simulations.requestReview(activeBranch.id, reviewNotes);
      setShowReviewModal(false);
      setReviewNotes('');
      loadBranchDetails(activeBranch.id);
    } catch (err) {
      console.error('Failed to submit simulation review request:', err);
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-all">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-700/80 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-lg">
              🧪
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Counterfactual Investigation Sandbox
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
                  Sandboxed
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Simulate "what-if" evidentiary scenarios with zero impact on official case records.
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

        {/* Branch Selector Bar */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 overflow-x-auto py-1">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Branches:</span>
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => loadBranchDetails(b.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition shrink-0 ${
                  activeBranch?.id === b.id
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition shrink-0"
          >
            + New Branch
          </button>
        </div>

        {/* New Branch Form */}
        {isCreating && (
          <form onSubmit={handleCreateBranch} className="p-4 bg-slate-800/80 border-b border-slate-700 space-y-3">
            <input
              type="text"
              placeholder="Branch Name (e.g., What-if CDR is Inadmissible)"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
            <input
              type="text"
              placeholder="Description / Hypothesized context"
              value={branchDesc}
              onChange={(e) => setBranchDesc(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500"
              >
                Initialize Branch
              </button>
            </div>
          </form>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeBranch ? (
            <>
              {/* Branch Status & Description */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">{activeBranch.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{activeBranch.description || 'No description provided.'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    {activeBranch.status}
                  </span>
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition"
                  >
                    Propose Official Review
                  </button>
                </div>
              </div>

              {/* Hypothesis Shift Radar / Deltas */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
                  <span>📊</span> Heuer ACH Likelihood Delta Shifts
                </h4>
                <div className="space-y-3">
                  {activeBranch.hypothesis_deltas && activeBranch.hypothesis_deltas.length > 0 ? (
                    activeBranch.hypothesis_deltas.map((delta) => {
                      const hyp = hypothesesList.find((h: Hypothesis) => h.id === delta.hypothesis_id);
                      const isShifted = Math.abs(delta.delta_score) > 0.05;
                      const isUp = delta.delta_score > 0;

                      return (
                        <div
                          key={delta.id}
                          className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 transition hover:border-slate-600"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="text-sm font-semibold text-white">
                                {delta.hypothesis_title || hyp?.title || 'Case Hypothesis'}
                              </h5>
                              <p className="text-xs text-slate-400 mt-1">{delta.diagnostic_rationale}</p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold shrink-0 ${
                                isShifted
                                  ? isUp
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  : 'bg-slate-700/40 text-slate-400'
                              }`}
                            >
                              {isUp ? '+' : ''}
                              {(delta.delta_score * 100).toFixed(1)}% Shift
                            </span>
                          </div>

                          {/* Visual Likelihood Comparison Bar */}
                          <div className="mt-3 pt-3 border-t border-slate-700/40 grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="flex justify-between text-slate-400 mb-1">
                                <span>Official Likelihood:</span>
                                <span className="font-mono text-slate-300">
                                  {(delta.original_normalized_score * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                                <div
                                  className="bg-slate-400 h-1.5 rounded-full"
                                  style={{ width: `${delta.original_normalized_score * 100}%` }}
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-slate-400 mb-1">
                                <span>Simulated Likelihood:</span>
                                <span className="font-mono text-indigo-300 font-bold">
                                  {(delta.simulated_normalized_score * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    isUp ? 'bg-emerald-400' : 'bg-rose-400'
                                  }`}
                                  style={{ width: `${delta.simulated_normalized_score * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 bg-slate-800/30 rounded-xl text-center text-xs text-slate-400 border border-slate-800">
                      No hypothesis deltas calculated yet. Adjust evidence toggles below to calculate shifts.
                    </div>
                  )}
                </div>
              </div>

              {/* What-If Evidentiary Overrides */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
                  <span>⚡</span> Evidence Inclusion & Overrides
                </h4>
                <div className="space-y-2">
                  {evidenceList.map((ev) => {
                    const isExcluded = activeBranch.evidence_overrides?.some(
                      (o) => o.evidence_id === ev.id && o.is_excluded
                    );

                    return (
                      <div
                        key={ev.id}
                        className={`p-3 rounded-lg border flex items-center justify-between transition ${
                          isExcluded
                            ? 'bg-red-950/20 border-red-800/40 opacity-75'
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`p-1.5 rounded text-xs uppercase font-mono ${
                              ev.source_type === 'fir'
                                ? 'bg-blue-900/40 text-blue-300'
                                : ev.source_type === 'cdr'
                                ? 'bg-cyan-900/40 text-cyan-300'
                                : 'bg-slate-700/40 text-slate-300'
                            }`}
                          >
                            {ev.source_type}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-2">
                              {ev.title}
                              {isExcluded && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-normal">
                                  Excluded in Scenario
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Hash: {ev.sha256_hash.slice(0, 16)}...
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleEvidence(ev.id)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                            isExcluded
                              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                          }`}
                        >
                          {isExcluded ? 'Re-Include' : 'Exclude (What-If)'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
              <span className="text-3xl">🧪</span>
              <p className="text-sm font-medium">No simulation branch selected.</p>
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium"
              >
                Create your first branch
              </button>
            </div>
          )}
        </div>

        {/* Review Request Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📋</span> Submit Simulation to Senior Investigator Review
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Submitting this review request does <strong>not</strong> alter official case records directly. It logs an audit proposal for senior review to assess whether case strategy should pivot.
              </p>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Explain the investigative rationale for this simulation scenario..."
                className="w-full h-24 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReviewRequest}
                  disabled={reviewSubmitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review Proposal'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
