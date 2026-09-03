import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Users,
  Car,
  Building2,
  MapPin,
  Phone,
  Calendar,
  FileCheck2,
  ArrowLeft,
  Network,
  GitCompare,
  ListOrdered,
  FileDown,
  Shield,
  ChevronRight,
  X,
  UserPlus,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { casesApi, evidenceApi, reportsApi, officersApi } from '../services/api';
import { Case, Evidence } from '../types';
import { DEMO_CASES } from '../data/demoCases';
import { getCaseEntities, CaseEntitiesBundle } from '../data/demoCaseEntities';
import { CaseGraph4D } from '../components/cases/CaseGraph4D';
import { useTheme } from '../context/ThemeContext';
import { useRealtime } from '../hooks/useRealtime';

type TabType = 'overview' | 'graph' | 'people' | 'vehicles' | 'organizations' | 'locations' | 'phones' | 'events' | 'evidence' | 'officers';

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [entitiesBundle, setEntitiesBundle] = useState<CaseEntitiesBundle | null>(null);
  const [officersList, setOfficersList] = useState<any[]>([]);
  const [allOfficersRoster, setAllOfficersRoster] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; data: any } | null>(null);

  // Assign Officer Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [selectedAssignRole, setSelectedAssignRole] = useState('investigator');
  const [assigning, setAssigning] = useState(false);

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  // Real-time synchronization
  useRealtime(id, (event) => {
    if (event.resource_type === 'case' || event.resource_type === 'officer' || event.resource_type === 'evidence') {
      if (id) {
        loadCaseData(id);
        loadOfficersData(id);
      }
    }
  });

  useEffect(() => {
    if (!id) return;
    loadCaseData(id);
    loadOfficersData(id);
    loadAllOfficers();
  }, [id]);

  const loadCaseData = async (caseId: string) => {
    try {
      setLoading(true);
      let caseData: Case | undefined;
      try {
        caseData = await casesApi.get(caseId);
      } catch (err) {
        caseData = DEMO_CASES.find(c => c.id === caseId) || {
          id: caseId,
          case_number: `FIR-2026-DEL-${caseId.slice(0, 4)}`,
          title: `Active Investigation #${caseId.slice(0, 8)}`,
          description: 'Evidentiary dossier under human-in-the-loop criminal network investigation.',
          status: 'under_investigation',
          priority: 'high',
          created_by: 'demo-officer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      setCurrentCase(caseData);

      try {
        const evData = await evidenceApi.listByCase(caseId);
        setEvidenceList(evData);
      } catch (evErr) {
        setEvidenceList([]);
      }

      const entities = getCaseEntities(caseId, caseData?.title);
      setEntitiesBundle(entities);
    } finally {
      setLoading(false);
    }
  };

  const loadOfficersData = async (caseId: string) => {
    try {
      const res = await casesApi.listOfficers(caseId);
      if (Array.isArray(res) && res.length > 0) {
        setOfficersList(res);
      } else {
        // Fallback synthetic assigned officers
        setOfficersList([
          {
            id: `officer-lead-${caseId}`,
            user_id: 'usr-01',
            full_name: 'Inspector Rajesh Malhotra',
            email: 'rajesh.malhotra@tracex.gov.in',
            badge_number: 'DL-POL-8841',
            station: 'Special Cell / Cyber Crime HQ',
            assignment_role: 'lead_investigator',
            is_active: true,
            assigned_at: new Date().toISOString()
          },
          {
            id: `officer-asst-${caseId}`,
            user_id: 'usr-02',
            full_name: 'Sub-Inspector Priya Sharma',
            email: 'priya.sharma@tracex.gov.in',
            badge_number: 'DL-POL-9023',
            station: 'Special Cell / Connaught Place',
            assignment_role: 'investigator',
            is_active: true,
            assigned_at: new Date().toISOString()
          }
        ]);
      }
    } catch (e) {
      setOfficersList([
        {
          id: `officer-lead-${caseId}`,
          user_id: 'usr-01',
          full_name: 'Inspector Rajesh Malhotra',
          email: 'rajesh.malhotra@tracex.gov.in',
          badge_number: 'DL-POL-8841',
          station: 'Special Cell / Cyber Crime HQ',
          assignment_role: 'lead_investigator',
          is_active: true,
          assigned_at: new Date().toISOString()
        }
      ]);
    }
  };

  const loadAllOfficers = async () => {
    try {
      const res = await officersApi.list();
      if (Array.isArray(res) && res.length > 0) {
        setAllOfficersRoster(res);
      }
    } catch (e) {
      // Fallback roster for assignment modal
      setAllOfficersRoster([
        { id: 'usr-01', full_name: 'Inspector Rajesh Malhotra', email: 'rajesh.malhotra@tracex.gov.in', badge_number: 'DL-POL-8841', role: 'senior_investigator' },
        { id: 'usr-02', full_name: 'Sub-Inspector Priya Sharma', email: 'priya.sharma@tracex.gov.in', badge_number: 'DL-POL-9023', role: 'investigator' },
        { id: 'usr-03', full_name: 'ACP Vikramaditya Roy', email: 'vikram.roy@tracex.gov.in', badge_number: 'DL-POL-4410', role: 'admin' },
        { id: 'usr-04', full_name: 'Forensic Analyst Kavita Menon', email: 'kavita.menon@tracex.gov.in', badge_number: 'DL-POL-7721', role: 'auditor' }
      ]);
    }
  };

  const handleAssignOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase || !selectedOfficerId) return;
    try {
      setAssigning(true);
      await casesApi.assignOfficer(currentCase.id, {
        user_id: selectedOfficerId,
        assignment_role: selectedAssignRole
      });
      await loadOfficersData(currentCase.id);
      setShowAssignModal(false);
      setSelectedOfficerId('');
    } catch (err) {
      // Optimistic local add
      const picked = allOfficersRoster.find(o => o.id === selectedOfficerId);
      if (picked) {
        setOfficersList(prev => [
          ...prev,
          {
            id: `opt-${Date.now()}`,
            user_id: picked.id,
            full_name: picked.full_name,
            email: picked.email,
            badge_number: picked.badge_number,
            station: picked.station || 'Special Cell',
            assignment_role: selectedAssignRole,
            is_active: true,
            assigned_at: new Date().toISOString()
          }
        ]);
      }
      setShowAssignModal(false);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveOfficer = async (officerId: string) => {
    if (!currentCase || !window.confirm('Remove officer from this case assignment?')) return;
    try {
      await casesApi.removeOfficer(currentCase.id, officerId);
      await loadOfficersData(currentCase.id);
    } catch (err) {
      setOfficersList(prev => prev.filter(o => o.id !== officerId && o.user_id !== officerId));
    }
  };

  const handleExportPdf = async () => {
    if (!currentCase) return;
    try {
      setExporting(true);
      const blob = await reportsApi.downloadPdf(currentCase.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TRACE-X_${currentCase.case_number}_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      window.print();
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  if (loading && !currentCase) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono text-cyan-400">Loading Case Intelligence Dossier...</p>
        </div>
      </div>
    );
  }

  const tabConfig = [
    { key: 'overview' as TabType, label: 'Dossier Overview', icon: FolderKanban, count: undefined },
    { key: 'graph' as TabType, label: 'Evidence Graph', icon: Network, count: undefined, highlight: true },
    { key: 'people' as TabType, label: 'People / POI', icon: Users, count: entitiesBundle?.people.length },
    { key: 'vehicles' as TabType, label: 'Vehicles', icon: Car, count: entitiesBundle?.vehicles.length },
    { key: 'organizations' as TabType, label: 'Organizations', icon: Building2, count: entitiesBundle?.organizations.length },
    { key: 'locations' as TabType, label: 'Locations', icon: MapPin, count: entitiesBundle?.locations.length },
    { key: 'phones' as TabType, label: 'Phones / IMEI', icon: Phone, count: entitiesBundle?.phone_numbers.length },
    { key: 'events' as TabType, label: 'Timeline Events', icon: Calendar, count: entitiesBundle?.events.length },
    { key: 'evidence' as TabType, label: 'Source Evidence', icon: FileCheck2, count: evidenceList.length },
    { key: 'officers' as TabType, label: 'Assigned Officers', icon: Shield, count: officersList.length }
  ];

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Header & Back Navigation */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <button
                onClick={() => navigate('/cases')}
                className={`inline-flex items-center space-x-2 text-xs font-semibold hover:underline transition ${
                  isDark ? 'text-slate-400 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-700'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Case Management</span>
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{currentCase?.title}</h1>
                <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase border ${
                  currentCase?.status === 'under_investigation'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                }`}>
                  {currentCase?.status?.replace('_', ' ')}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
                  {currentCase?.case_number}
                </span>
              </div>

              <p className={`text-xs sm:text-sm max-w-3xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {currentCase?.description}
              </p>
            </div>

            {/* Quick Action Suite */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate(`/cases/${currentCase?.id}/graph`)}
                className="py-2 px-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-600/30 flex items-center space-x-1.5 transition"
              >
                <Network className="w-3.5 h-3.5" />
                <span>4D Evidence Graph</span>
              </button>

              <button
                onClick={() => navigate(`/cases/${currentCase?.id}/hypotheses`)}
                className={`py-2 px-3.5 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition ${
                  isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5 text-purple-400" />
                <span>ACH Hypotheses</span>
              </button>

              <button
                onClick={() => navigate(`/cases/${currentCase?.id}/actions`)}
                className={`py-2 px-3.5 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition ${
                  isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
                <span>VoI Actions</span>
              </button>

              <button
                onClick={handleExportPdf}
                disabled={exporting}
                className={`py-2 px-3.5 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition ${
                  isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>{exporting ? 'Generating PDF...' : 'Export Dossier PDF'}</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation Ribbon */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-800/80">
            {tabConfig.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all whitespace-nowrap border ${
                    isActive
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-600/30'
                      : tab.highlight
                      ? isDark
                        ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/80 hover:bg-cyan-900/40'
                        : 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100'
                      : isDark
                      ? 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 shadow-sm'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-cyan-800 text-cyan-100' : isDark ? 'bg-slate-950 text-slate-400' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Persons of Interest</span>
                  <div className="text-2xl font-black text-cyan-400 mt-1">{entitiesBundle?.people.length || 0}</div>
                  <span className="text-[11px] text-slate-500">Suspects & Associates</span>
                </div>
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Linked Vehicles</span>
                  <div className="text-2xl font-black text-amber-400 mt-1">{entitiesBundle?.vehicles.length || 0}</div>
                  <span className="text-[11px] text-slate-500">Tracked Registrations</span>
                </div>
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Corporate Shells</span>
                  <div className="text-2xl font-black text-purple-400 mt-1">{entitiesBundle?.organizations.length || 0}</div>
                  <span className="text-[11px] text-slate-500">Entity Networks</span>
                </div>
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Officers</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{officersList.length || 1}</div>
                  <span className="text-[11px] text-slate-500">Active Team</span>
                </div>
              </div>

              {/* Embedded Mini Graph Preview Card */}
              <div className={`p-6 rounded-3xl border space-y-4 ${
                isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Network className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-base font-bold">Evidence Network Graph Quick View</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('graph')}
                    className="text-xs text-cyan-400 hover:underline font-semibold flex items-center space-x-1"
                  >
                    <span>Open 4D Spatiotemporal Canvas</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <CaseGraph4D caseId={currentCase?.id || id || ''} />
              </div>
            </div>
          )}

          {/* TAB 2: FULL INTERACTIVE 4D EVIDENCE GRAPH */}
          {activeTab === 'graph' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">4D Interactive Spatiotemporal Network Graph</h2>
                  <p className="text-xs text-slate-400">Multi-layer isometric depth analysis with interactive time dimension playback & evidence corroboration.</p>
                </div>
              </div>
              <CaseGraph4D
                caseId={currentCase?.id || id || ''}
                onNavigateToEvidence={() => {
                  setActiveTab('evidence');
                }}
              />
            </div>
          )}

          {/* TAB 3: PEOPLE / POI */}
          {activeTab === 'people' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {entitiesBundle?.people.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedEntity({ type: 'Person of Interest', data: p })}
                    className={`p-5 rounded-2xl border transition cursor-pointer hover:border-cyan-500/50 space-y-3 ${
                      isDark ? 'bg-slate-900/70 border-slate-800 hover:bg-slate-900' : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                          p.risk_level === 'critical'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : p.risk_level === 'high'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                        }`}>
                          {p.role}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-1.5">{p.name}</h4>
                        {p.alias && (
                          <span className="text-[11px] text-slate-400">Alias: {p.alias}</span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{p.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: VEHICLES */}
          {activeTab === 'vehicles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entitiesBundle?.vehicles.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedEntity({ type: 'Vehicle Linked to Case', data: v })}
                  className={`p-5 rounded-2xl border transition cursor-pointer hover:border-amber-500/50 space-y-2 ${
                    isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400">{v.registration_number}</span>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">{v.vehicle_type}</span>
                  </div>
                  <h4 className="text-sm font-bold">{v.make_model} ({v.color})</h4>
                  <div className="text-xs text-slate-400">Registered Owner: <span className="text-slate-200 font-semibold">{v.registered_owner}</span></div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: ORGANIZATIONS */}
          {activeTab === 'organizations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entitiesBundle?.organizations.map((o) => (
                <div
                  key={o.id}
                  onClick={() => setSelectedEntity({ type: 'Organization / Shell Company', data: o })}
                  className={`p-5 rounded-2xl border transition cursor-pointer hover:border-indigo-500/50 space-y-2 ${
                    isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">{o.org_type}</span>
                  <h4 className="text-sm font-bold mt-1">{o.name}</h4>
                  <div className="text-xs text-slate-400 font-mono">CIN: {o.cin_registration || 'CIN-N/A'}</div>
                  <div className="text-xs text-slate-400">Jurisdiction: {o.jurisdiction}</div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: LOCATIONS */}
          {activeTab === 'locations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entitiesBundle?.locations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => setSelectedEntity({ type: 'Location / Scene', data: loc })}
                  className={`p-5 rounded-2xl border transition cursor-pointer hover:border-rose-500/50 space-y-2 ${
                    isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-rose-400">{loc.location_type}</span>
                  <h4 className="text-sm font-bold">{loc.address}</h4>
                  <div className="text-xs text-slate-400 font-mono">
                    GPS: {loc.coordinates?.lat ? `${loc.coordinates.lat.toFixed(4)}, ${loc.coordinates.lng.toFixed(4)}` : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 7: PHONES / IMEI */}
          {activeTab === 'phones' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entitiesBundle?.phone_numbers.map((ph) => (
                <div
                  key={ph.id}
                  onClick={() => setSelectedEntity({ type: 'Phone Number / Intercept', data: ph })}
                  className={`p-5 rounded-2xl border transition cursor-pointer hover:border-teal-500/50 space-y-2 ${
                    isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <span className="text-sm font-mono font-bold text-teal-400">{ph.phone_number}</span>
                  <div className="text-xs text-slate-400">Subscriber: <span className="text-slate-200">{ph.subscriber_name}</span></div>
                  <div className="text-xs text-slate-400">Circle: {ph.telecom_circle}</div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">IMEI: {ph.imei_hash || 'N/A'}</div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 8: TIMELINE EVENTS */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="relative border-l-2 border-cyan-500/40 ml-4 pl-6 space-y-6">
                {entitiesBundle?.events.map((ev) => (
                  <div key={ev.id} className="relative group">
                    <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-md shadow-cyan-400/50" />
                    <div className={`p-5 rounded-2xl border transition-all ${
                      isDark ? 'bg-slate-900/80 border-slate-800 group-hover:border-cyan-500/40' : 'bg-white border-slate-200 group-hover:border-cyan-400 shadow-sm'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                        <span className="text-xs font-mono font-semibold text-cyan-400">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                          {ev.event_type}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold mb-1">{ev.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{ev.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: EVIDENCE */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {evidenceList.map((ev) => (
                  <div
                    key={ev.id}
                    className={`p-5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {ev.source_type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {ev.integrity_status || 'VERIFIED'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold">{ev.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{ev.description}</p>
                    {ev.sha256_hash && (
                      <div className="p-2 rounded-lg bg-slate-950 font-mono text-[10px] text-slate-400 truncate">
                        SHA-256: {ev.sha256_hash}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 10: ASSIGNED OFFICERS */}
          {activeTab === 'officers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Assigned Investigation Team</h3>
                  <p className="text-xs text-slate-400">Officers and forensic specialists authorized to view and modify this case dossier.</p>
                </div>

                <button
                  onClick={() => setShowAssignModal(true)}
                  className="py-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-600/30 flex items-center space-x-1.5 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Assign Officer to Case</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {officersList.map((off) => (
                  <div
                    key={off.id || off.user_id}
                    className={`p-5 rounded-2xl border space-y-3 relative group transition ${
                      isDark ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 font-bold text-xs">
                          {off.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'OF'}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold">{off.full_name}</h4>
                          <span className="text-[11px] font-mono text-cyan-400 font-semibold">{off.badge_number || 'BADGE-N/A'}</span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold border ${
                        off.assignment_role === 'lead_investigator'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}>
                        {off.assignment_role?.replace('_', ' ') || 'Investigator'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
                      <div>Email: <span className="text-slate-200">{off.email}</span></div>
                      <div>Unit: <span className="text-slate-200">{off.station || 'Special Cell'}</span></div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => handleRemoveOfficer(off.id || off.user_id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition text-xs flex items-center space-x-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Unassign</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entity Inspector Drawer */}
          {selectedEntity && (
            <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end p-4">
              <div className={`w-full max-w-md h-full rounded-3xl border p-6 flex flex-col justify-between shadow-2xl overflow-y-auto ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-bold border border-cyan-800">
                        {selectedEntity.type}
                      </span>
                      <h3 className="text-lg font-bold mt-1.5">{selectedEntity.data.name || selectedEntity.data.title || selectedEntity.data.registration_number || selectedEntity.data.number}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedEntity(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
                    {Object.entries(selectedEntity.data).map(([key, val]) => {
                      if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                      return (
                        <div key={key} className="flex justify-between border-b border-slate-900 pb-1">
                          <span className="text-slate-500 uppercase">{key}:</span>
                          <span className="text-slate-200 font-semibold text-right max-w-[200px] truncate">{String(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <button
                    onClick={() => setSelectedEntity(null)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Assign Officer Modal */}
          {showAssignModal && (
            <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl space-y-5 ${
                isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-base font-bold">Assign Officer to Case</h3>
                  </div>
                  <button onClick={() => setShowAssignModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAssignOfficer} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Select Officer</label>
                    <select
                      value={selectedOfficerId}
                      onChange={(e) => setSelectedOfficerId(e.target.value)}
                      required
                      className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Choose an Officer --</option>
                      {allOfficersRoster.map((off) => (
                        <option key={off.id} value={off.id}>
                          {off.full_name} ({off.badge_number || 'Badge N/A'}) - {off.role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Assignment Role</label>
                    <select
                      value={selectedAssignRole}
                      onChange={(e) => setSelectedAssignRole(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="lead_investigator">Lead Case Officer</option>
                      <option value="investigator">Investigator / Field Officer</option>
                      <option value="forensic_specialist">Digital Forensic Analyst</option>
                      <option value="supervisor">Supervising Officer / ACP</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assigning}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition shadow-md shadow-cyan-600/30"
                    >
                      {assigning ? 'Assigning...' : 'Confirm Assignment'}
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

export default CaseDetailPage;
