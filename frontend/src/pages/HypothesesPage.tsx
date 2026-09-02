import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Brain, Plus, ThumbsUp, ThumbsDown, Scale,
  ChevronRight, Sparkles, CheckCircle2, X
} from 'lucide-react';
import { hypothesesApi, evidenceApi, casesApi } from '../services/api';
import { Hypothesis, Evidence, Case, HypothesisStatus } from '../types';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';

export const HypothesesPage: React.FC = () => {
  const { id: caseIdParam } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseIdParam || '');
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState<HypothesisStatus>('active');

  // Link Evidence Modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [activeHypothesisId, setActiveHypothesisId] = useState<string>('');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>('');
  const [linkRelation, setLinkRelation] = useState<'supports' | 'contradicts'>('supports');
  const [linkWeight, setLinkWeight] = useState<number>(1.0);
  const [linkNotes, setLinkNotes] = useState<string>('');

  // ACH Comparison Modal
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [targetHypothesisId, setTargetHypothesisId] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<any>(null);

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
      const [hypoRes, evRes] = await Promise.all([
        hypothesesApi.listByCase(caseId),
        evidenceApi.listByCase(caseId),
      ]);
      setHypotheses(hypoRes);
      setEvidenceList(evRes);
    } catch (err) {
      console.error('Failed to load hypotheses', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCaseId) {
      loadData(selectedCaseId);
    }
  }, [selectedCaseId]);

  const handleCreateHypothesis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) return;
    try {
      await hypothesesApi.create(selectedCaseId, {
        title: newTitle,
        description: newDesc,
        status: newStatus,
      });
      setCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      await loadData(selectedCaseId);
    } catch (err) {
      console.error('Failed to create hypothesis', err);
    }
  };

  const handleLinkEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHypothesisId || !selectedEvidenceId) return;
    try {
      await hypothesesApi.linkEvidence(activeHypothesisId, {
        evidence_id: selectedEvidenceId,
        relationship_type: linkRelation,
        relationship_strength: linkWeight,
        rationale: linkNotes,
      });
      setLinkModalOpen(false);
      setSelectedEvidenceId('');
      setLinkNotes('');
      await loadData(selectedCaseId);
    } catch (err) {
      console.error('Failed to link evidence', err);
    }
  };

  const handleRunComparison = async () => {
    if (!activeHypothesisId || !targetHypothesisId) return;
    try {
      const res = await hypothesesApi.compare(activeHypothesisId, targetHypothesisId);
      setComparisonResult(res);
    } catch (err) {
      console.error('Comparison failed', err);
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
                <Brain className="w-6 h-6 text-purple-400" />
                <h1 className="text-xl font-bold text-slate-100">Competing Hypotheses (ACH) Engine</h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Structured intelligence evaluation applying Heuer's ACH methodology weighted by 4-dimensional Evidence Quality.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Case Selector */}
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.title}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-purple-600/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Hypothesis</span>
              </button>
            </div>
          </div>

          {/* Hypotheses Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-24 text-slate-500 text-sm">
              Loading hypothesis evaluations...
            </div>
          ) : hypotheses.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl space-y-3">
              <Sparkles className="w-10 h-10 text-purple-400 mx-auto opacity-70" />
              <h3 className="text-sm font-semibold text-slate-200">No hypotheses registered for this case</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Create competing working and alternative scenarios, then link case evidence to evaluate diagnostic weights.
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg"
              >
                Create Primary Hypothesis
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {hypotheses.map((hypo) => {
                const likelihood = (hypo.score?.normalized_score ?? 0.50) * 100;
                let likelihoodBadge = 'text-amber-400 bg-amber-950 border-amber-800';
                if (likelihood >= 70) likelihoodBadge = 'text-emerald-400 bg-emerald-950 border-emerald-800';
                else if (likelihood < 40) likelihoodBadge = 'text-rose-400 bg-rose-950 border-rose-800';

                return (
                  <div
                    key={hypo.id}
                    className="p-5 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-xl space-y-4 hover:border-purple-500/50 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono uppercase font-bold text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                              {hypo.status}
                            </span>
                            <h3 className="text-sm font-bold text-slate-100">{hypo.title}</h3>
                          </div>
                          {hypo.description && (
                            <p className="text-xs text-slate-400 line-clamp-2">{hypo.description}</p>
                          )}
                        </div>

                        <div className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs ${likelihoodBadge}`}>
                          {likelihood.toFixed(1)}%
                        </div>
                      </div>

                      {/* Likelihood Meter */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Calibrated Likelihood</span>
                          <span className="font-mono">{likelihood.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              likelihood >= 70 ? 'bg-emerald-500' : likelihood >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${likelihood}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Score Breakdown Chips */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
                          <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-0.5">
                            <ThumbsUp className="w-3 h-3" />
                            <span className="text-[10px] uppercase font-semibold">Support</span>
                          </div>
                          <span className="font-mono font-bold text-slate-200">
                            {hypo.score?.supporting_weight_sum?.toFixed(2) ?? '0.00'}
                          </span>
                        </div>

                        <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
                          <div className="flex items-center justify-center space-x-1 text-rose-400 mb-0.5">
                            <ThumbsDown className="w-3 h-3" />
                            <span className="text-[10px] uppercase font-semibold">Contradict</span>
                          </div>
                          <span className="font-mono font-bold text-slate-200">
                            {hypo.score?.contradicting_weight_sum?.toFixed(2) ?? '0.00'}
                          </span>
                        </div>

                        <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
                          <div className="flex items-center justify-center space-x-1 text-purple-400 mb-0.5">
                            <Scale className="w-3 h-3" />
                            <span className="text-[10px] uppercase font-semibold">Net Score</span>
                          </div>
                          <span className="font-mono font-bold text-slate-200">
                            {hypo.score?.raw_score?.toFixed(2) ?? '0.00'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                      <button
                        onClick={() => {
                          setActiveHypothesisId(hypo.id);
                          setLinkModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 text-purple-400 hover:text-purple-300 font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Link Evidence</span>
                      </button>

                      {hypotheses.length > 1 && (
                        <button
                          onClick={() => {
                            setActiveHypothesisId(hypo.id);
                            const other = hypotheses.find((h) => h.id !== hypo.id);
                            if (other) setTargetHypothesisId(other.id);
                            setCompareModalOpen(true);
                            setComparisonResult(null);
                          }}
                          className="inline-flex items-center space-x-1 text-slate-400 hover:text-slate-200"
                        >
                          <span>Compare ACH</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* New Hypothesis Modal */}
          {createModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-100">Create Investigation Hypothesis</h3>
                <form onSubmit={handleCreateHypothesis} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Hypothesis Title</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. H1: Coordinated Hawala Syndicate"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Status Lifecycle</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as HypothesisStatus)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                    >
                      <option value="active">Active (Under Investigation)</option>
                      <option value="supported">Supported (Strong Corroboration)</option>
                      <option value="refuted">Refuted (Disproven)</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Description / Theory</label>
                    <textarea
                      rows={3}
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Detail the investigative logic, assumed actors, and expected evidence trail..."
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-purple-500 resize-none"
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
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-purple-600/30"
                    >
                      Create Hypothesis
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Link Evidence Modal */}
          {linkModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-100">Link Evidence to Hypothesis</h3>
                <form onSubmit={handleLinkEvidence} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Select Case Evidence</label>
                    <select
                      required
                      value={selectedEvidenceId}
                      onChange={(e) => setSelectedEvidenceId(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">-- Choose Evidence Item --</option>
                      {evidenceList.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          [{ev.source_type.toUpperCase()}] {ev.title} (Score: {((ev.quality_score?.overall_quality_score ?? 0.5) * 100).toFixed(0)}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Diagnostic Relationship</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLinkRelation('supports')}
                        className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 border transition-all ${
                          linkRelation === 'supports'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>SUPPORTS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLinkRelation('contradicts')}
                        className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 border transition-all ${
                          linkRelation === 'contradicts'
                            ? 'bg-rose-950 text-rose-300 border-rose-600 shadow'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>CONTRADICTS</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Relevance Weight</span>
                      <span className="font-mono">{linkWeight.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.1"
                      value={linkWeight}
                      onChange={(e) => setLinkWeight(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Investigative Notes</label>
                    <input
                      type="text"
                      value={linkNotes}
                      onChange={(e) => setLinkNotes(e.target.value)}
                      placeholder="Why does this item support/contradict the scenario?"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setLinkModalOpen(false)}
                      className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-purple-600/30"
                    >
                      Link & Score
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Side-by-Side ACH Comparison Modal */}
          {compareModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Scale className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-bold text-slate-100">Analysis of Competing Hypotheses (ACH) Matrix</h3>
                  </div>
                  <button onClick={() => setCompareModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-slate-400">Contrast against:</span>
                  <select
                    value={targetHypothesisId}
                    onChange={(e) => setTargetHypothesisId(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    {hypotheses
                      .filter((h) => h.id !== activeHypothesisId)
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.title}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleRunComparison}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg"
                  >
                    Evaluate Matrix
                  </button>
                </div>

                {comparisonResult && (
                  <div className="space-y-4 pt-2">
                    {/* Header Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3.5 bg-slate-950 rounded-xl border border-purple-900/40">
                        <span className="text-[10px] uppercase font-bold text-purple-400">Hypothesis 1</span>
                        <h4 className="text-xs font-bold text-slate-100 truncate">{comparisonResult.hypothesis_1.title}</h4>
                        <div className="mt-2 text-sm font-mono font-bold text-emerald-400">
                          {((comparisonResult.hypothesis_1.scores.normalized_score ?? 0.5) * 100).toFixed(1)}% Likelihood
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-cyan-400">Hypothesis 2</span>
                        <h4 className="text-xs font-bold text-slate-100 truncate">{comparisonResult.hypothesis_2.title}</h4>
                        <div className="mt-2 text-sm font-mono font-bold text-emerald-400">
                          {((comparisonResult.hypothesis_2.scores.normalized_score ?? 0.5) * 100).toFixed(1)}% Likelihood
                        </div>
                      </div>
                    </div>

                    {/* Diagnostic Matrix Table */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-300">Evidence Diagnostic Matrix</span>
                        <span className="text-[11px] text-purple-300 font-mono">
                          {comparisonResult.diagnostic_evidence_count} Highly Diagnostic Items
                        </span>
                      </div>

                      <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                            <tr>
                              <th className="p-2.5">Evidence Title</th>
                              <th className="p-2.5">Quality</th>
                              <th className="p-2.5">H1 Stance</th>
                              <th className="p-2.5">H2 Stance</th>
                              <th className="p-2.5">Diagnostic</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                            {comparisonResult.comparison_matrix.map((row: any) => (
                              <tr key={row.evidence_id} className={row.is_diagnostic ? 'bg-purple-950/20' : ''}>
                                <td className="p-2.5 font-sans font-medium text-slate-200 truncate max-w-xs">{row.evidence_title}</td>
                                <td className="p-2.5 text-slate-300">{(row.quality_score * 100).toFixed(0)}%</td>
                                <td className="p-2.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                    row.h1_relationship === 'supports' ? 'text-emerald-400 bg-emerald-950' : row.h1_relationship === 'contradicts' ? 'text-rose-400 bg-rose-950' : 'text-slate-500'
                                  }`}>
                                    {row.h1_relationship}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                    row.h2_relationship === 'supports' ? 'text-emerald-400 bg-emerald-950' : row.h2_relationship === 'contradicts' ? 'text-rose-400 bg-rose-950' : 'text-slate-500'
                                  }`}>
                                    {row.h2_relationship}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  {row.is_diagnostic ? (
                                    <span className="inline-flex items-center space-x-1 text-purple-400 font-semibold">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Diagnostic</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">Neutral</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
