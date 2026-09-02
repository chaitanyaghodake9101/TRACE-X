import React, { useState, useEffect } from 'react';
import { ReviewPriorityScore, ReviewTask } from '../../types';
import { intelligenceApi } from '../../services/api';
import { ReviewPriorityLabel } from './ReviewPriorityLabel';

interface ReviewPriorityQueueDrawerProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ReviewPriorityQueueDrawer: React.FC<ReviewPriorityQueueDrawerProps> = ({
  caseId,
  isOpen,
  onClose,
}) => {
  const [priorities, setPriorities] = useState<ReviewPriorityScore[]>([]);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [_loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('hash_reverified');
  const [newStatus, setNewStatus] = useState('reverified');
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    if (isOpen && caseId) {
      loadData();
    }
  }, [isOpen, caseId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prios, tList] = await Promise.all([
        intelligenceApi.reviewPriorities.getPriorities(caseId),
        intelligenceApi.reviewTasks.listTasks(caseId),
      ]);
      setPriorities(prios);
      setTasks(tList);
    } catch (err) {
      console.error('Failed to load review queue data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const prios = await intelligenceApi.reviewPriorities.recalculatePriorities(caseId);
      setPriorities(prios);
      const tList = await intelligenceApi.reviewTasks.listTasks(caseId);
      setTasks(tList);
    } catch (err) {
      console.error('Failed to recalculate review priorities:', err);
    } finally {
      setRecalculating(false);
    }
  };

  const handleLogAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setSubmittingAction(true);
    try {
      await intelligenceApi.reviewTasks.performAction(selectedTask.id, {
        action_taken: actionTaken,
        notes: actionNotes,
        new_status: newStatus,
      });
      setSelectedTask(null);
      setActionNotes('');
      loadData();
    } catch (err) {
      console.error('Failed to log review action:', err);
    } finally {
      setSubmittingAction(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-all">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-700/80 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xl">
              ⏱️
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Evidence Decay & Review Deadline Queue
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/40">
                  Priority Schedule
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                5-factor urgency prioritization for evidence re-verification, integrity reviews, and expiration mitigation.
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

        {/* Disclaimer Banner */}
        <div className="px-6 py-2.5 bg-amber-950/20 border-b border-amber-800/40 text-[11px] text-amber-300/90 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span>ℹ️</span> <strong>Notice:</strong> Suggested review priority / Requires investigator assessment. Not a statutory legal deadline.
          </span>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition text-xs shrink-0"
          >
            {recalculating ? 'Calculating...' : '↻ Recalculate'}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Review Tasks */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center justify-between">
              <span>📋 Actionable Review Tasks ({tasks.filter((t) => t.status === 'pending').length} Pending)</span>
            </h3>
            <div className="space-y-2.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition ${
                    task.priority === 'P0'
                      ? 'bg-red-950/20 border-red-800/40 hover:border-red-600/60'
                      : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            task.priority === 'P0'
                              ? 'bg-red-500 text-white animate-pulse'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <h4 className="text-sm font-semibold text-white">{task.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{task.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          task.status === 'reverified'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {task.status}
                      </span>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                        >
                          Log Review
                        </button>
                      )}
                    </div>
                  </div>

                  {task.due_date && (
                    <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span>📅</span> Suggested Assessment Target:{' '}
                      <span className="font-mono text-slate-300">{new Date(task.due_date).toLocaleDateString()}</span>
                    </div>
                  )}

                  {task.action_logs && task.action_logs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Review History:</span>
                      {task.action_logs.map((log) => (
                        <div key={log.id} className="text-xs text-slate-300 flex items-center justify-between">
                          <span>
                            • <strong>{log.action_taken.replace('_', ' ')}</strong>: {log.notes}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            by {log.performer_name || 'Officer'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Urgency Rankings */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              5-Factor Evidence Urgency Breakdown ($U(e)$)
            </h3>
            <div className="space-y-3">
              {priorities.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3 hover:border-slate-600 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{item.evidence_title}</h4>
                      <span className="text-[11px] text-slate-400 uppercase font-mono">
                        Source: {item.evidence_source_type}
                      </span>
                    </div>
                    <ReviewPriorityLabel tier={item.suggested_review_tier} score={item.composite_urgency_score} />
                  </div>

                  {/* 5 Dimensions Grid */}
                  <div className="grid grid-cols-5 gap-2 text-center text-[11px] pt-2 border-t border-slate-700/40">
                    <div className="p-1.5 bg-slate-900/60 rounded-lg">
                      <div className="text-[10px] text-slate-400">Temporal (25%)</div>
                      <div className="font-mono font-bold text-slate-200">{item.temporal_urgency_score.toFixed(2)}</div>
                    </div>
                    <div className="p-1.5 bg-slate-900/60 rounded-lg">
                      <div className="text-[10px] text-slate-400">Integrity (30%)</div>
                      <div
                        className={`font-mono font-bold ${
                          item.integrity_urgency_score > 0 ? 'text-red-400' : 'text-slate-200'
                        }`}
                      >
                        {item.integrity_urgency_score.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-1.5 bg-slate-900/60 rounded-lg">
                      <div className="text-[10px] text-slate-400">Volatility (15%)</div>
                      <div className="font-mono font-bold text-slate-200">{item.volatility_score.toFixed(2)}</div>
                    </div>
                    <div className="p-1.5 bg-slate-900/60 rounded-lg">
                      <div className="text-[10px] text-slate-400">Impact (20%)</div>
                      <div className="font-mono font-bold text-slate-200">{item.downstream_impact_score.toFixed(2)}</div>
                    </div>
                    <div className="p-1.5 bg-slate-900/60 rounded-lg">
                      <div className="text-[10px] text-slate-400">Deficit (10%)</div>
                      <div className="font-mono font-bold text-slate-200">{item.corroboration_deficit_score.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Log Action Modal */}
        {selectedTask && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <form
              onSubmit={handleLogAction}
              className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📝</span> Record Evidence Review Assessment
              </h3>
              <p className="text-xs text-slate-300">
                Log formal investigative action taken for: <strong>{selectedTask.title}</strong>
              </p>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Action Performed</label>
                <select
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="hash_reverified">Cryptographic Hash Re-verified (Match Confirmed)</option>
                  <option value="witness_reinterviewed">Witness Supplemental Statement Recorded</option>
                  <option value="metadata_updated">Metadata & Chain-of-Custody Updated</option>
                  <option value="cleared">Integrity Alert Investigated & Cleared</option>
                  <option value="deferred">Deferred with Justification</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Task Resolution Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="reverified">Resolved / Re-verified</option>
                  <option value="in_review">In Active Review</option>
                  <option value="deferred">Deferred</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Investigative Notes</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Record verification notes, officer observations, or cold-storage reconciliation details..."
                  className="w-full h-24 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {submittingAction ? 'Saving...' : 'Confirm Assessment'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
