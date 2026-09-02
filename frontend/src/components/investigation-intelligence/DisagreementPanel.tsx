import React, { useState, useEffect } from 'react';
import { DisagreementSignal, DisagreementScanSummary } from '../../types';
import { intelligenceApi } from '../../services/api';

interface DisagreementPanelProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DisagreementPanel: React.FC<DisagreementPanelProps> = ({
  caseId,
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<DisagreementScanSummary | null>(null);
  const [_loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<DisagreementSignal | null>(null);
  const [contestAction, setContestAction] = useState('override_confidence');
  const [justification, setJustification] = useState('');
  const [adjustedConfidence, setAdjustedConfidence] = useState<number>(0.85);
  const [submittingContest, setSubmittingContest] = useState(false);

  useEffect(() => {
    if (isOpen && caseId) {
      loadData();
    }
  }, [isOpen, caseId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await intelligenceApi.disagreements.getDisagreements(caseId);
      setData(res);
    } catch (err) {
      console.error('Failed to load disagreements data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await intelligenceApi.disagreements.scanDisagreements(caseId);
      setData(res);
    } catch (err) {
      console.error('Failed to execute disagreement scan:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleSubmitContestation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSignal) return;
    setSubmittingContest(true);
    try {
      await intelligenceApi.disagreements.contestSignal(selectedSignal.id, {
        contest_action: contestAction,
        justification,
        adjusted_confidence: adjustedConfidence,
      });
      setSelectedSignal(null);
      setJustification('');
      loadData();
    } catch (err) {
      console.error('Failed to submit contestation:', err);
    } finally {
      setSubmittingContest(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xl">
              ⚖️
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                AI Disagreement & Minority-Evidence Panel
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/40">
                  Contestability Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cross-signal discrepancy reconciliation across NLP, graph topology, hypothesis scores, and minority outlier testimony.
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

        {/* Status Dashboard */}
        <div className="p-6 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Total Signals:</span>
              <div className="text-lg font-bold font-mono text-white">{data?.total_signals || 0}</div>
            </div>
            <div>
              <span className="text-red-400 uppercase tracking-wider text-[10px] font-semibold">Critical Contradictions:</span>
              <div className="text-lg font-bold font-mono text-red-300">{data?.critical_signals || 0}</div>
            </div>
            <div>
              <span className="text-purple-400 uppercase tracking-wider text-[10px] font-semibold">Minority Evidence Items:</span>
              <div className="text-lg font-bold font-mono text-purple-300">{data?.minority_evidence_count || 0}</div>
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-lg shadow-purple-600/20"
          >
            <span>🔍</span> {scanning ? 'Scanning Pipeline...' : 'Re-Scan Discrepancies'}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Minority Evidence Section */}
          {data && data.minority_evidence && data.minority_evidence.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <span>🌟</span> Dissenting & Minority Evidence (High Diagnostic Value)
              </h3>
              <p className="text-[11px] text-slate-400">
                Outlier testimony or dissenting informant records that directly challenge consensus hypotheses. In Heuer ACH methodology, negative and outlier evidence is highly diagnostic.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {data.minority_evidence.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-purple-950/20 border border-purple-800/40 rounded-xl space-y-2 hover:border-purple-600/60 transition"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-900/50 text-purple-200 border border-purple-700/50">
                        {item.outlier_category.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {item.diagnostic_significance}x Diagnostic
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">{item.contradiction_target}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.summary_rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detected Disagreement Signals */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Cross-Signal Discrepancy Signals
            </h3>
            <div className="space-y-3">
              {data && data.signals && data.signals.length > 0 ? (
                data.signals.map((sig) => (
                  <div
                    key={sig.id}
                    className={`p-4 rounded-xl border transition ${
                      sig.severity === 'critical'
                        ? 'bg-red-950/20 border-red-800/40'
                        : sig.severity === 'high'
                        ? 'bg-amber-950/20 border-amber-800/40'
                        : 'bg-slate-800/40 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              sig.severity === 'critical'
                                ? 'bg-red-500 text-white'
                                : sig.severity === 'high'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {sig.severity}
                          </span>
                          <span className="text-[10px] font-mono text-purple-300 uppercase">
                            Dimension: {sig.dimension.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-white mt-1">{sig.title}</h4>
                      </div>

                      <div className="flex items-center gap-2">
                        {sig.is_resolved ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                            ✓ Contested / Resolved
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedSignal(sig)}
                            className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition shadow"
                          >
                            Contest / Reconcile
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 mt-2">{sig.description}</p>

                    {sig.recommended_reconciliation && (
                      <div className="mt-3 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
                        <span>💡</span>
                        <span>
                          <strong>Recommended Reconciliation:</strong> {sig.recommended_reconciliation}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 bg-slate-800/20 rounded-xl text-center text-slate-400 text-xs border border-slate-800">
                  Zero critical contradictions detected. Click "Re-Scan Discrepancies" to run analytical scan.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contestation Modal */}
        {selectedSignal && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <form
              onSubmit={handleSubmitContestation}
              className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚖️</span> Investigator Contestation & Override
              </h3>
              <p className="text-xs text-slate-300">
                Exercise human oversight to contest or override signal: <strong>{selectedSignal.title}</strong>
              </p>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Contest Action</label>
                <select
                  value={contestAction}
                  onChange={(e) => setContestAction(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="override_confidence">Override Extraction / Evidence Confidence</option>
                  <option value="affirm_anomaly">Affirm Legitimate Evidentiary Conflict</option>
                  <option value="dismiss_signal">Dismiss as False Discrepancy</option>
                </select>
              </div>

              {contestAction === 'override_confidence' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Adjusted Confidence Value ({adjustedConfidence})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={adjustedConfidence}
                    onChange={(e) => setAdjustedConfidence(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Investigative Justification</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="State the factual basis, case context, or corroborated officer knowledge justifying this override..."
                  className="w-full h-24 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSignal(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingContest}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {submittingContest ? 'Recording...' : 'Submit Human Oversight Override'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
