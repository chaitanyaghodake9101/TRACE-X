import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Copy, Check, RefreshCw, AlertTriangle, Clock, X, Lock } from 'lucide-react';
import { evidenceApi } from '../services/api';
import { EvidenceIntegrity } from '../types';

interface CustodyTimelineModalProps {
  evidenceId: string;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: () => void;
}

export const CustodyTimelineModal: React.FC<CustodyTimelineModalProps> = ({
  evidenceId,
  isOpen,
  onClose,
  onStatusChanged
}) => {
  const [integrityData, setIntegrityData] = useState<EvidenceIntegrity | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchIntegrity = async () => {
    if (!evidenceId) return;
    try {
      setLoading(true);
      const data = await evidenceApi.getIntegrity(evidenceId);
      setIntegrityData(data);
    } catch (err) {
      console.error('Failed to load integrity data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && evidenceId) {
      fetchIntegrity();
    }
  }, [isOpen, evidenceId]);

  const handleCopyHash = () => {
    if (integrityData?.sha256_hash) {
      navigator.clipboard.writeText(integrityData.sha256_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async () => {
    try {
      setVerifying(true);
      await evidenceApi.verify(evidenceId);
      await fetchIntegrity();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error('Verification failed', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulateTamper = async () => {
    try {
      setTampering(true);
      await evidenceApi.simulateTamper(evidenceId);
      await fetchIntegrity();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error('Tampering simulation failed', err);
    } finally {
      setTampering(false);
    }
  };

  if (!isOpen) return null;

  const isVerified = integrityData?.integrity_status === 'verified';
  const isCompromised = integrityData?.integrity_status === 'compromised';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl border ${
              isVerified
                ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
                : isCompromised
                ? 'bg-rose-950 border-rose-800 text-rose-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              {isVerified ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-100">Cryptographic Chain of Custody</h3>
                <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${
                  isVerified
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                    : isCompromised
                    ? 'bg-rose-950/80 text-rose-400 border-rose-800 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {integrityData?.integrity_status || 'Checking...'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{integrityData?.title || 'Evidence Item'}</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Loading cryptographic custody ledger...</div>
          ) : (
            <>
              {/* Hash Verification Box */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>SHA-256 Digest at Ingestion</span>
                  </span>
                  <button
                    onClick={handleCopyHash}
                    className="inline-flex items-center space-x-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy Hash'}</span>
                  </button>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                  {integrityData?.sha256_hash || 'No hash recorded.'}
                </div>

                {isCompromised && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">Integrity Violation Detected!</strong>
                      The current file/text digest differs from the original ingestion hash. Evidence quality score has been heavily downweighted.
                    </div>
                  </div>
                )}

                {/* Verification & Demo Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                    <span>Verify Integrity Now</span>
                  </button>

                  <button
                    onClick={handleSimulateTamper}
                    disabled={tampering}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-lg border border-rose-800/80 transition-all"
                    title="Simulate modifying underlying bytes to test tamper-detection"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Simulate Tamper (Demo Action)</span>
                  </button>
                </div>
              </div>

              {/* Custody Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Immutable Custody Event Chain ({integrityData?.custody_chain?.length || 0})</span>
                </h4>

                <div className="relative pl-6 space-y-4 border-l border-slate-800 ml-2">
                  {integrityData?.custody_chain?.map((evt) => {
                    const isTamperEvent = evt.event_type === 'flagged_compromised' || evt.event_type === 'simulated_tamper';
                    const isUpload = evt.event_type === 'uploaded';

                    return (
                      <div key={evt.id} className="relative space-y-1">
                        {/* Dot */}
                        <div
                          className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                            isTamperEvent
                              ? 'bg-rose-500 shadow-md shadow-rose-500/50'
                              : isUpload
                              ? 'bg-cyan-400 shadow-md shadow-cyan-400/50'
                              : 'bg-emerald-400'
                          }`}
                        />

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 capitalize">
                            {evt.event_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>

                        {evt.notes && <p className="text-xs text-slate-400">{evt.notes}</p>}

                        <div className="text-[10px] font-mono text-slate-500">
                          Digest: {evt.hash_at_event.slice(0, 16)}...
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
