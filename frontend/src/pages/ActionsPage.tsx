import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Zap, Plus, CheckCircle2, HelpCircle,
  Sparkles, RefreshCw, FileCheck
} from 'lucide-react';
import { actionsApi, entitiesApi, casesApi } from '../services/api';
import { InvestigativeAction, ActionType, Entity, Case } from '../types';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';

export const ActionsPage: React.FC = () => {
  const { id: caseIdParam } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseIdParam || '');
  const [actions, setActions] = useState<InvestigativeAction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPrioritizing, setIsPrioritizing] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<ActionType>('obtain_financial_records');
  const [targetEntityId, setTargetEntityId] = useState<string>('');

  // Complete Modal
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string>('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [producedEvidence, setProducedEvidence] = useState(false);
  const [effectiveness, setEffectiveness] = useState<number>(0.90);

  // Inspector Popover / Tooltip
  const [inspectedAction, setInspectedAction] = useState<InvestigativeAction | null>(null);

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    casesApi.list().then((data) => {
      setCases(data);
      if (!selectedCaseId && data.length > 0) {
        setSelectedCaseId(data[0].id);
      }
    }).catch(console.error);
  }, []);

  const loadData = async (caseId: string) => {
    if (!caseId) return;
    try {
      setLoading(true);
      const [actRes, entRes] = await Promise.all([
        actionsApi.listByCase(caseId),
        entitiesApi.listByCase(caseId),
      ]);
      setActions(actRes);
      setEntities(entRes);
    } catch (err) {
      console.error('Failed to load actions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCaseId) {
      loadData(selectedCaseId);
    }
  }, [selectedCaseId]);

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) return;
    try {
      await actionsApi.create(selectedCaseId, {
        title: newTitle,
        description: newDesc,
        action_type: newType,
        target_entity_id: targetEntityId || undefined,
      });
      setCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setTargetEntityId('');
      await loadData(selectedCaseId);
    } catch (err) {
      console.error('Failed to create action', err);
    }
  };

  const handleCompleteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActionId) return;
    try {
      await actionsApi.complete(activeActionId, {
        outcome_notes: outcomeNotes,
        produced_new_evidence: producedEvidence,
        effectiveness_score: effectiveness,
      });
      setCompleteModalOpen(false);
      setOutcomeNotes('');
      setActiveActionId('');
      await loadData(selectedCaseId);
    } catch (err) {
      console.error('Failed to complete action', err);
    }
  };

  const handlePrioritize = async () => {
    if (!selectedCaseId) return;
    try {
      setIsPrioritizing(true);
      const ranked = await actionsApi.prioritize(selectedCaseId);
      setActions(ranked);
    } catch (err) {
      console.error('Prioritization failed', err);
    } finally {
      setIsPrioritizing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center space-x-2.5">
                <Zap className="w-6 h-6 text-amber-400" />
                <h1 className="text-xl font-bold text-slate-100">Information Gain Prioritizer (VoI Planner)</h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Value-of-Information optimization ranking investigative actions to eliminate uncertainty fastest.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Case Selector */}
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.title}
                  </option>
                ))}
              </select>

              <button
                onClick={handlePrioritize}
                disabled={isPrioritizing}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPrioritizing ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                <span>Re-Rank Actions</span>
              </button>

              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-600/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Action</span>
              </button>
            </div>
          </div>

          {/* Action List */}
          {loading ? (
            <div className="flex justify-center items-center py-24 text-slate-500 text-sm">
              Loading prioritized actions...
            </div>
          ) : actions.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl space-y-3">
              <Sparkles className="w-10 h-10 text-amber-400 mx-auto opacity-70" />
              <h3 className="text-sm font-semibold text-slate-200">No investigative actions planned for this case</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Create investigative tasks such as obtaining financial records or CDR dumps to maximize information gain.
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg"
              >
                Add Recommended Action
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map((act) => {
                const isCompleted = act.status === 'completed';
                const eigScore = act.expected_information_gain;

                return (
                  <div
                    key={act.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isCompleted
                        ? 'bg-slate-950/60 border-slate-800/60 opacity-60'
                        : 'bg-slate-900/80 backdrop-blur-sm border-slate-800 hover:border-amber-500/40 shadow-lg'
                    }`}
                  >
                    <div className="flex items-start space-x-3.5">
                      {/* Priority Rank Badge */}
                      <div className="flex flex-col items-center justify-center">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs border ${
                            act.priority_rank === 1
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                              : act.priority_rank === 2
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          #{act.priority_rank}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {act.action_type.replace(/_/g, ' ')}
                          </span>
                          {act.target_entity && (
                            <span className="text-[10px] text-cyan-300 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded font-mono">
                              Target: {act.target_entity.canonical_name || act.target_entity.name}
                            </span>
                          )}
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                              act.status === 'completed'
                                ? 'text-emerald-400 bg-emerald-950'
                                : act.status === 'in_progress'
                                ? 'text-cyan-400 bg-cyan-950'
                                : 'text-slate-400 bg-slate-800'
                            }`}
                          >
                            {act.status}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-100">{act.title}</h3>
                        {act.description && <p className="text-xs text-slate-400">{act.description}</p>}
                      </div>
                    </div>

                    {/* Right Side: EIG Score & Action Buttons */}
                    <div className="flex items-center space-x-4 pl-12 md:pl-0">
                      {/* EIG Multiplier Meter */}
                      <div className="text-right space-y-1 min-w-[120px]">
                        <div className="flex items-center justify-end space-x-1.5">
                          <span className="text-[11px] text-slate-400">EIG Score:</span>
                          <span className="font-mono font-bold text-amber-400 text-xs">
                            {eigScore.toFixed(2)}
                          </span>
                          <button
                            onClick={() => setInspectedAction(act)}
                            className="text-slate-400 hover:text-amber-300 transition-colors"
                            title="Inspect 'Why this action?' formula breakdown"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="w-28 bg-slate-800 h-1.5 rounded-full overflow-hidden ml-auto">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full"
                            style={{ width: `${Math.min(100, (eigScore / 2.0) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Action Triggers */}
                      {!isCompleted ? (
                        <button
                          onClick={() => {
                            setActiveActionId(act.id);
                            setCompleteModalOpen(true);
                          }}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center space-x-1 text-xs text-emerald-400">
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>Logged</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* "Why This Action?" Inspection Modal */}
          {inspectedAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-slate-100">Why was this action prioritized?</h3>
                  </div>
                  <button onClick={() => setInspectedAction(null)} className="text-slate-400 hover:text-slate-200 text-xs">✕</button>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-center">
                  <span className="text-slate-400">EIG = Base ({inspectedAction.base_gain}) × Gap ({inspectedAction.gap_multiplier}) × Hyp ({inspectedAction.hypothesis_multiplier}) × Feas ({inspectedAction.feasibility_multiplier})</span>
                  <div className="text-base font-bold text-amber-400 mt-1">= {inspectedAction.expected_information_gain.toFixed(3)}</div>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="font-semibold text-amber-400">1. Base Information Gain: {inspectedAction.base_gain}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">High diagnostic yield typical for {inspectedAction.action_type.replace(/_/g, ' ')}.</p>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="font-semibold text-amber-400">2. Knowledge Gap Multiplier: {inspectedAction.gap_multiplier}x</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {inspectedAction.target_entity
                        ? `Target entity '${inspectedAction.target_entity.name}' has low graph confidence, yielding high marginal insight.`
                        : 'General case inquiry.'}
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="font-semibold text-amber-400">3. Hypothesis Discriminatory Multiplier: {inspectedAction.hypothesis_multiplier}x</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Boosted because competing hypotheses currently have close likelihood estimates.</p>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="font-semibold text-amber-400">4. Feasibility Modifier: {inspectedAction.feasibility_multiplier}x</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Operational ease and standard legal authorization timeline.</p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setInspectedAction(null)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New Action Modal */}
          {createModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-100">Plan Investigative Action</h3>
                <form onSubmit={handleCreateAction} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Action Title</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Subpoena Bank Statement for Shell Company"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Action Category (Base Diagnostic Gain)</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as ActionType)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="obtain_financial_records">Obtain Financial / Bank Records (Base: 0.90)</option>
                      <option value="obtain_cdr">Obtain Call Detail Records (CDR) (Base: 0.85)</option>
                      <option value="forensic_analysis">Digital Forensic Analysis (Base: 0.80)</option>
                      <option value="cctv_review">CCTV Surveillance Footage Review (Base: 0.75)</option>
                      <option value="interview_witness">Interview Key Witness (Base: 0.60)</option>
                      <option value="other">Other Field Inquiry (Base: 0.40)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Target Entity (Optional Gap Boost)</label>
                    <select
                      value={targetEntityId}
                      onChange={(e) => setTargetEntityId(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- No Specific Entity Target --</option>
                      {entities.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          [{ent.entity_type.toUpperCase()}] {ent.canonical_name || ent.name} (Conf: {((ent.confidence_score ?? 1.0) * 100).toFixed(0)}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Description / Scope</label>
                    <textarea
                      rows={3}
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Specify requested dates, target phone numbers, or account numbers..."
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCreateModalOpen(false)}
                      className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/30"
                    >
                      Plan & Prioritize
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Complete Action Modal */}
          {completeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-100">Log Action Outcome</h3>
                <form onSubmit={handleCompleteAction} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Investigative Outcome Findings</label>
                    <textarea
                      rows={4}
                      required
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      placeholder="Detail findings, obtained transaction IDs, corroborated contacts, or leads discovered..."
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="newEv"
                      checked={producedEvidence}
                      onChange={(e) => setProducedEvidence(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <label htmlFor="newEv" className="text-xs text-slate-300">Produced new document / documentary evidence</label>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Action Effectiveness Rating</span>
                      <span className="font-mono font-bold text-emerald-400">{(effectiveness * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.05"
                      value={effectiveness}
                      onChange={(e) => setEffectiveness(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCompleteModalOpen(false)}
                      className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-lg shadow-emerald-600/30"
                    >
                      Save & Complete Action
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
