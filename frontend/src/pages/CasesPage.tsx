import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FolderKanban, ChevronRight, FileDown } from 'lucide-react';
import { casesApi, reportsApi } from '../services/api';
import { Case } from '../types';
import { Navbar } from '../components/Navbar';
import { NewCaseModal } from '../components/NewCaseModal';

export const CasesPage: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  const fetchCases = async () => {
    try {
      setLoading(true);
      const data = await casesApi.list();
      setCases(data);
    } catch (err) {
      console.error('Failed to fetch cases', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleCreateCase = async (newCaseData: any) => {
    await casesApi.create(newCaseData);
    await fetchCases();
  };

  const handleExportPdf = async (e: React.MouseEvent, caseId: string, caseNumber: string) => {
    e.stopPropagation();
    try {
      setExportingId(caseId);
      const blob = await reportsApi.downloadPdf(caseId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TRACE_X_Dossier_${caseNumber.replace(/[\/\\]/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Failed to export PDF dossier', err);
    } finally {
      setExportingId(null);
    }
  };

  const handleExportIntegrityReport = async (e: React.MouseEvent, caseId: string, caseNumber: string) => {
    e.stopPropagation();
    try {
      setExportingId(`integrity_${caseId}`);
      const blob = await reportsApi.downloadIntegrityReport(caseId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TRACE_X_Integrity_Report_${caseNumber.replace(/[\/\\]/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Failed to export Integrity report', err);
    } finally {
      setExportingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.case_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    return c.status === activeTab;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-950 text-blue-400 border-blue-800';
      case 'under_investigation':
        return 'bg-amber-950 text-amber-400 border-amber-800';
      case 'closed':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800';
      default:
        return 'bg-slate-950 text-slate-400 border-slate-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-3">
              <FolderKanban className="w-7 h-7 text-cyan-400" />
              <span>Active Investigative Dossiers</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Select an investigation to open the Evidence Graph, Competing Hypotheses, and Action Prioritizer.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cyan-600/30 transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation</span>
          </button>
        </div>

        {/* Status Tabs & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'open', 'under_investigation', 'closed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by FIR, title, or description..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Case List Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 space-y-2">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm">Loading investigative dossiers...</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-20 text-center bg-slate-900/30 rounded-2xl border border-slate-800/80 p-8 space-y-3">
            <FolderKanban className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">No active cases found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Initialize a new investigation dossier to ingest evidence files, generate evidence quality scores, and compare competing hypotheses.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-2 inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Initial Case</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCases.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/cases/${c.id}/graph`)}
                className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 shadow-lg transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                      {c.case_number}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${getStatusBadge(c.status)}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                      <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${getPriorityBadge(c.priority)}`}>
                        {c.priority}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1.5">
                    {c.description || 'No description recorded.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => handleExportPdf(e, c.id, c.case_number)}
                      disabled={exportingId === c.id}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors text-[11px]"
                      title="Export Official PDF Dossier"
                    >
                      <FileDown className={`w-3.5 h-3.5 ${exportingId === c.id ? 'animate-bounce text-cyan-400' : 'text-slate-400'}`} />
                      <span>{exportingId === c.id ? 'Generating...' : 'PDF Dossier'}</span>
                    </button>

                    <button
                      onClick={(e) => handleExportIntegrityReport(e, c.id, c.case_number)}
                      disabled={exportingId === `integrity_${c.id}`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 rounded-lg border border-slate-700 transition-colors text-[11px]"
                      title="Export Cryptographic Chain-of-Custody Integrity Audit PDF"
                    >
                      <FileDown className={`w-3.5 h-3.5 ${exportingId === `integrity_${c.id}` ? 'animate-bounce text-emerald-400' : 'text-emerald-400'}`} />
                      <span>{exportingId === `integrity_${c.id}` ? 'Generating...' : 'Integrity Audit'}</span>
                    </button>
                  </div>

                  <span className="flex items-center text-cyan-400 group-hover:translate-x-1 transition-transform">
                    <span>Analyze</span>
                    <ChevronRight className="w-4 h-4 ml-0.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <NewCaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCase}
      />
    </div>
  );
};
