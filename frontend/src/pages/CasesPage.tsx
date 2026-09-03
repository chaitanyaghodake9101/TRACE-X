import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  FolderKanban,
  ChevronRight,
  FileDown,
  Sparkles,
  Users,
  Car,
  Building2,
  Phone,
  Network
} from 'lucide-react';
import { casesApi, reportsApi } from '../services/api';
import { Case } from '../types';
import { Navbar } from '../components/Navbar';
import { NewCaseModal } from '../components/NewCaseModal';
import { DEMO_CASES } from '../data/demoCases';
import { getCaseEntities } from '../data/demoCaseEntities';
import { useTheme } from '../context/ThemeContext';

export const CasesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isUsingDemoData, setIsUsingDemoData] = useState(false);

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  const fetchCases = async () => {
    try {
      setLoading(true);
      const data = await casesApi.list();
      if (Array.isArray(data) && data.length > 0) {
        setCases(data);
        setIsUsingDemoData(false);
      } else {
        // Fallback to rich synthetic demonstration cases
        setCases(DEMO_CASES);
        setIsUsingDemoData(true);
      }
    } catch (err) {
      console.warn('API connection unavailable, loading synthetic demonstration cases:', err);
      setCases(DEMO_CASES);
      setIsUsingDemoData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleCreateCase = async (newCaseData: any) => {
    try {
      await casesApi.create(newCaseData);
      await fetchCases();
    } catch (err) {
      // Local fallback for demo creation
      const created: Case = {
        id: `demo-case-${Date.now()}`,
        case_number: newCaseData.case_number || `FIR-2026-DEL-${Math.floor(1000 + Math.random() * 9000)}`,
        title: newCaseData.title,
        description: newCaseData.description,
        status: newCaseData.status || 'open',
        priority: newCaseData.priority || 'medium',
        created_by: user?.id || 'demo-officer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        evidence_count: 0,
        entity_count: 0
      };
      setCases((prev) => [created, ...prev]);
    }
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
        return isDark
          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          : 'bg-rose-50 text-rose-700 border-rose-200';
      case 'high':
        return isDark
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'medium':
        return isDark
          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
          : 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return isDark
          ? 'bg-slate-500/10 text-slate-400 border-slate-500/30'
          : 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return isDark
          ? 'bg-blue-950/80 text-blue-400 border-blue-800'
          : 'bg-blue-50 text-blue-700 border-blue-200';
      case 'under_investigation':
        return isDark
          ? 'bg-amber-950/80 text-amber-400 border-amber-800'
          : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'closed':
        return isDark
          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return isDark
          ? 'bg-slate-950 text-slate-400 border-slate-800'
          : 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Navbar user={user} onLogout={handleLogout} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8 space-y-6">
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl border flex items-center justify-center ${
                isDark ? 'bg-cyan-950/80 border-cyan-800/80 text-cyan-400' : 'bg-white border-slate-200 text-cyan-600 shadow-sm'
              }`}>
                <FolderKanban className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Active Investigative Dossiers</h1>
            </div>
            <p className={`text-xs sm:text-sm mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Select an investigation to open the Comprehensive Dossier, Evidence Graph, Competing Hypotheses, and Action Prioritizer.
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto">
            {isUsingDemoData && (
              <span className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                isDark ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-400' : 'bg-cyan-50 border-cyan-200 text-cyan-700'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Synthetic Demo Dataset</span>
              </span>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cyan-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Investigation</span>
            </button>
          </div>
        </div>

        {/* Status Tabs & Filters */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-2xl border transition-colors ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'open', 'under_investigation', 'closed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap border ${
                  activeTab === tab
                    ? isDark
                      ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-sm'
                      : 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by FIR, title, or description..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-colors focus:outline-none focus:border-cyan-500 border ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Case List Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Loading investigative dossiers...</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className={`py-20 text-center rounded-2xl border p-8 space-y-3 transition-colors ${
            isDark ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <FolderKanban className={`w-12 h-12 mx-auto ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
            <h3 className="text-base font-semibold">No active cases found</h3>
            <p className={`text-xs max-w-sm mx-auto ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              Initialize a new investigation dossier to ingest evidence files, generate evidence quality scores, and compare competing hypotheses.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className={`mt-2 inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-cyan-700 border-slate-300'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Initial Case</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCases.map((c) => {
              const entities = getCaseEntities(c.id, c.title);
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className={`group border rounded-2xl p-6 shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 hover:-translate-y-1 ${
                    isDark
                      ? 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-cyan-500/50 shadow-slate-950/50'
                      : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-cyan-500/40 shadow-slate-200/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${
                        isDark ? 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60' : 'text-cyan-700 bg-cyan-50 border-cyan-200'
                      }`}>
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

                    <h3 className={`text-base font-semibold transition-colors group-hover:text-cyan-500 ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}>
                      {c.title}
                    </h3>
                    <p className={`text-xs line-clamp-2 mt-1.5 leading-relaxed ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {c.description || 'No description recorded.'}
                    </p>

                    {/* Associated Entities Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-800/40 text-[11px] font-mono">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border ${
                        isDark ? 'bg-slate-800/60 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        <Users className="w-3 h-3 text-cyan-400" />
                        <span>{entities.people.length} POI</span>
                      </span>

                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border ${
                        isDark ? 'bg-slate-800/60 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        <Car className="w-3 h-3 text-amber-400" />
                        <span>{entities.vehicles.length} Vehicles</span>
                      </span>

                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border ${
                        isDark ? 'bg-slate-800/60 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        <Building2 className="w-3 h-3 text-indigo-400" />
                        <span>{entities.organizations.length} Orgs</span>
                      </span>

                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border ${
                        isDark ? 'bg-slate-800/60 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        <Phone className="w-3 h-3 text-teal-400" />
                        <span>{entities.phone_numbers.length} Phones</span>
                      </span>
                    </div>
                  </div>

                  <div className={`pt-3 border-t flex items-center justify-between text-xs transition-colors ${
                    isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-100 text-slate-500'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => handleExportPdf(e, c.id, c.case_number)}
                        disabled={exportingId === c.id}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border transition-colors text-[11px] ${
                          isDark
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200'
                        }`}
                        title="Export Official PDF Dossier"
                      >
                        <FileDown className={`w-3.5 h-3.5 ${exportingId === c.id ? 'animate-bounce text-cyan-400' : ''}`} />
                        <span>{exportingId === c.id ? 'Generating...' : 'PDF'}</span>
                      </button>

                      <button
                        onClick={(e) => handleExportIntegrityReport(e, c.id, c.case_number)}
                        disabled={exportingId === `integrity_${c.id}`}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border transition-colors text-[11px] ${
                          isDark
                            ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border-slate-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-emerald-700 hover:text-emerald-900 border-slate-200'
                        }`}
                        title="Export Cryptographic Chain-of-Custody Integrity Audit PDF"
                      >
                        <FileDown className={`w-3.5 h-3.5 ${exportingId === `integrity_${c.id}` ? 'animate-bounce text-emerald-400' : ''}`} />
                        <span>{exportingId === `integrity_${c.id}` ? 'Generating...' : 'Audit'}</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/cases/${c.id}/graph`);
                        }}
                        className="inline-flex items-center space-x-1 text-cyan-500 font-semibold hover:text-cyan-400"
                        title="Open 4D Evidence Graph"
                      >
                        <Network className="w-3.5 h-3.5" />
                        <span>Graph</span>
                      </button>

                      <span className="flex items-center text-cyan-500 font-medium group-hover:translate-x-0.5 transition-transform">
                        <span>Dossier</span>
                        <ChevronRight className="w-4 h-4 ml-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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

export default CasesPage;
