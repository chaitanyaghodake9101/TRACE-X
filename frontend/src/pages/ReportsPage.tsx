import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Download, ShieldCheck } from 'lucide-react';
import { casesApi, reportsApi } from '../services/api';
import { Case } from '../types';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';

export const ReportsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [downloading, setDownloading] = useState(false);
  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    if (id) {
      casesApi.get(id).then(setCaseData).catch(console.error);
    }
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!id || !caseData) return;
    try {
      setDownloading(true);
      const blob = await reportsApi.downloadPdf(id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tracex_report_${caseData.case_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download report', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-3">
                <FileText className="w-7 h-7 text-cyan-400" />
                <span>Investigation Reports & Audit Trail</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Generate court-admissible dossiers including evidence quality scores, hypothesis evaluations, and chain of custody logs.
              </p>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={downloading || !caseData}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Compiling PDF...' : 'Download Official PDF Report'}</span>
            </button>
          </div>

          {/* Report Summary Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  {caseData?.case_number}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1">{caseData?.title}</h3>
              </div>
              <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full">
                <ShieldCheck className="w-4 h-4" />
                <span>Audit Verified</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80">
                <p className="text-[10px] uppercase font-mono text-slate-400">Evidence Count</p>
                <p className="text-xl font-bold font-mono text-slate-100 mt-1">{caseData?.evidence_count || 0}</p>
              </div>
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80">
                <p className="text-[10px] uppercase font-mono text-slate-400">Extracted Entities</p>
                <p className="text-xl font-bold font-mono text-cyan-400 mt-1">{caseData?.entity_count || 0}</p>
              </div>
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80">
                <p className="text-[10px] uppercase font-mono text-slate-400">Hypotheses Scored</p>
                <p className="text-xl font-bold font-mono text-emerald-400 mt-1">{caseData?.hypothesis_count || 0}</p>
              </div>
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80">
                <p className="text-[10px] uppercase font-mono text-slate-400">Planned Actions</p>
                <p className="text-xl font-bold font-mono text-amber-400 mt-1">{caseData?.action_count || 0}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Executive Synopsis</h4>
              <p className="text-xs text-slate-400 bg-slate-950 p-4 rounded-xl border border-slate-800/80 leading-relaxed">
                {caseData?.description || 'No initial synopsis entered for this case file.'}
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
