import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Shield, Edit3, Power, KeyRound, Clock, CheckSquare,
  Square, RefreshCw, X, Check, Building2, Phone, BadgeCheck, AlertTriangle, UserPlus
} from 'lucide-react';
import { adminApi, casesApi, officersExtendedApi } from '../services/api';
import { UserRole, Case, OfficerActivityItem, PasswordResetResponse, EnhancedOfficer, OfficerHistory } from '../types';
import { Navbar } from '../components/Navbar';

export const AdminOfficersPage: React.FC = () => {
  const navigate = useNavigate();
  const [officers, setOfficers] = useState<EnhancedOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Selected officers for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [targetCaseId, setTargetCaseId] = useState<string>('');

  // Modals
  const [isCreatingOfficer, setIsCreatingOfficer] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<EnhancedOfficer | null>(null);
  const [activityOfficer, setActivityOfficer] = useState<EnhancedOfficer | null>(null);
  const [activityLogs, setActivityLogs] = useState<OfficerActivityItem[]>([]);
  const [officerHistory, setOfficerHistory] = useState<OfficerHistory | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [resetData, setResetData] = useState<PasswordResetResponse | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [bulkActionModal, setBulkActionModal] = useState<string | null>(null);

  // Form states for create officer
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'investigator' as UserRole,
    phone_number: '',
    badge_number: '',
    station: '',
    designation: 'Investigating Officer',
    district: 'Central Delhi',
    state: 'Delhi (NCT)',
    rank: 'Inspector',
    department: 'Special Crime Cell'
  });
  const [savingCreate, setSavingCreate] = useState(false);

  // Form states for edit officer
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: 'investigator' as UserRole,
    phone_number: '',
    badge_number: '',
    station: '',
    designation: '',
    district: '',
    state: '',
    rank: '',
    department: '',
    reason: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  const fetchOfficers = async () => {
    try {
      setLoading(true);
      const data = await officersExtendedApi.listExtended(
        searchQuery || undefined,
        roleFilter !== 'all' ? roleFilter : undefined,
        statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined
      );
      setOfficers(data);
    } catch (err) {
      console.error('Failed to load officers', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async () => {
    try {
      const data = await casesApi.list();
      setCases(data);
    } catch (err) {
      console.error('Failed to load cases for reassignment', err);
    }
  };

  useEffect(() => {
    fetchOfficers();
    fetchCases();
  }, [roleFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOfficers();
  };

  const handleSaveCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingCreate(true);
      await officersExtendedApi.createExtended(createForm);
      setIsCreatingOfficer(false);
      setCreateForm({
        full_name: '',
        email: '',
        password: '',
        role: 'investigator' as UserRole,
        phone_number: '',
        badge_number: '',
        station: '',
        designation: 'Investigating Officer',
        district: 'Central Delhi',
        state: 'Delhi (NCT)',
        rank: 'Inspector',
        department: 'Special Crime Cell'
      });
      await fetchOfficers();
      alert('Officer account and institutional profile created successfully!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create officer account.');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleOpenEdit = (officer: EnhancedOfficer) => {
    setEditingOfficer(officer);
    setEditForm({
      full_name: officer.full_name,
      email: officer.email,
      role: officer.role,
      phone_number: officer.phone_number || '',
      badge_number: officer.badge_number || '',
      station: officer.station || '',
      designation: officer.profile?.designation || '',
      district: officer.profile?.district || '',
      state: officer.profile?.state || '',
      rank: officer.profile?.rank || '',
      department: officer.profile?.department || '',
      reason: ''
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOfficer) return;
    try {
      setSavingEdit(true);
      await officersExtendedApi.updateProfile(editingOfficer.id, editForm);
      setEditingOfficer(null);
      await fetchOfficers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update officer details.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleStatus = async (officer: EnhancedOfficer) => {
    if (officer.id === currentUser?.id) {
      alert('Cannot deactivate your own administrative account.');
      return;
    }
    const actionName = officer.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionName} ${officer.full_name}?`)) return;
    try {
      await adminApi.toggleStatus(officer.id, !officer.is_active);
      await fetchOfficers();
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };

  const handleForceReset = async (officer: EnhancedOfficer) => {
    if (!window.confirm(`Force password reset for ${officer.full_name}? Their current password will be invalidated immediately.`)) return;
    try {
      const res = await adminApi.forceResetPassword(officer.id);
      setResetData(res);
    } catch (err) {
      console.error('Password reset failed', err);
    }
  };

  const handleViewActivity = async (officer: EnhancedOfficer) => {
    setActivityOfficer(officer);
    setLoadingActivity(true);
    try {
      const [logs, hist] = await Promise.all([
        adminApi.getOfficerActivity(officer.id),
        officersExtendedApi.getHistory(officer.id)
      ]);
      setActivityLogs(logs);
      setOfficerHistory(hist);
    } catch (err) {
      console.error('Failed to fetch activity and history', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === officers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(officers.map(o => o.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleExecuteBulk = async (action: string) => {
    try {
      await adminApi.bulkAction(selectedIds, action, targetCaseId || undefined);
      setBulkActionModal(null);
      setSelectedIds([]);
      await fetchOfficers();
    } catch (err) {
      console.error('Bulk action failed', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-rose-950 text-rose-300 border-rose-800';
      case 'senior_investigator': return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'investigator': return 'bg-blue-950 text-blue-300 border-blue-800';
      case 'auditor': return 'bg-purple-950 text-purple-300 border-purple-800';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar user={currentUser} onLogout={handleLogout} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                <Users className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-100">Law Enforcement Officers & Personnel</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Administer investigator profiles, badge identifiers, station postings, activation states, and security credentials.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsCreatingOfficer(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-cyan-600/20"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add New Officer</span>
            </button>

            <button
              onClick={() => navigate('/admin/health')}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 transition-colors shadow"
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>System Health</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, badge #, or station..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </form>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="senior_investigator">Senior Investigator</option>
                <option value="investigator">Investigator</option>
                <option value="auditor">Auditor</option>
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Deactivated Only</option>
              </select>
            </div>

            <button
              onClick={fetchOfficers}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              title="Refresh Officer List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (Visible when rows selected) */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-cyan-950/60 border border-cyan-800/80 rounded-xl flex items-center justify-between text-xs text-cyan-200 animate-fadeIn">
            <span className="font-semibold">
              {selectedIds.length} officer{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setBulkActionModal('activate')}
                className="px-3 py-1 bg-emerald-950 border border-emerald-800 hover:bg-emerald-900 text-emerald-300 font-semibold rounded-lg"
              >
                Bulk Activate
              </button>
              <button
                onClick={() => setBulkActionModal('deactivate')}
                className="px-3 py-1 bg-rose-950 border border-rose-800 hover:bg-rose-900 text-rose-300 font-semibold rounded-lg"
              >
                Bulk Deactivate
              </button>
              <button
                onClick={() => setBulkActionModal('reassign')}
                className="px-3 py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg"
              >
                Assign Case
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-slate-400 hover:text-slate-200 px-2"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Officers Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-500 space-y-2">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs">Loading officer directory...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-4 w-10">
                      <button onClick={handleSelectAll} className="text-slate-400 hover:text-slate-200">
                        {selectedIds.length === officers.length && officers.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-4 font-semibold">Officer / Profile</th>
                    <th className="p-4 font-semibold">Role</th>
                    <th className="p-4 font-semibold">Badge & Station</th>
                    <th className="p-4 font-semibold">Case Workload</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {officers.map((officer) => {
                    const isSelected = selectedIds.includes(officer.id);
                    return (
                      <tr key={officer.id} className={`hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-cyan-950/20' : ''}`}>
                        <td className="p-4">
                          <button onClick={() => handleToggleSelect(officer.id)} className="text-slate-400 hover:text-slate-200">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-200">{officer.full_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{officer.email}</div>
                          {officer.phone_number && (
                            <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5" />
                              <span>{officer.phone_number}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold border ${getRoleBadge(officer.role)}`}>
                            {officer.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 space-y-0.5">
                          <div className="flex items-center space-x-1 text-slate-300 font-mono text-[11px]">
                            <BadgeCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{officer.badge_number || 'Unassigned'}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            <span>{officer.station || 'Headquarters'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-300 font-mono text-[11px]">
                          <div>Created: <strong>{officer.created_cases_count ?? 0}</strong></div>
                          <div>Assigned: <strong>{officer.assigned_cases_count ?? 0}</strong></div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            officer.is_active
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border-rose-800'
                          }`}>
                            {officer.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOpenEdit(officer)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title="Edit Officer Profile"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                            </button>
                            <button
                              onClick={() => handleViewActivity(officer)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title="View Activity Log"
                            >
                              <Clock className="w-3.5 h-3.5 text-purple-400" />
                            </button>
                            <button
                              onClick={() => handleForceReset(officer)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title="Force Password Reset"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(officer)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                officer.is_active
                                  ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-400'
                                  : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400'
                              }`}
                              title={officer.is_active ? 'Deactivate Account' : 'Activate Account'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Edit Officer Modal */}
      {editingOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>Edit Officer Profile</span>
              </h3>
              <button onClick={() => setEditingOfficer(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="senior_investigator">Senior Investigator</option>
                    <option value="investigator">Investigator</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Badge / Officer ID</label>
                  <input
                    type="text"
                    value={editForm.badge_number}
                    onChange={(e) => setEditForm({ ...editForm, badge_number: e.target.value })}
                    placeholder="e.g. DL-POL-9841"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone_number}
                    onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                    placeholder="+91-9876543210"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Police Station / Unit</label>
                  <input
                    type="text"
                    value={editForm.station}
                    onChange={(e) => setEditForm({ ...editForm, station: e.target.value })}
                    placeholder="e.g. Connaught Place PS"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                  />
                </div>
              </div>

              {/* Extended Profile Fields */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Designation</label>
                  <input
                    type="text"
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                    placeholder="e.g. ACP"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">District</label>
                  <input
                    type="text"
                    value={editForm.district}
                    onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                    placeholder="e.g. Central Delhi"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">State / UT</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    placeholder="e.g. Delhi (NCT)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Change Reason / Promotion Justification</label>
                <input
                  type="text"
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  placeholder="e.g. Annual cadre promotion and district transfer"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOfficer(null)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-600/30 text-xs disabled:opacity-50"
                >
                  {savingEdit ? 'Saving & Auditing...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity & Career History Timeline Modal */}
      {activityOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2.5">
                <Clock className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{activityOfficer.full_name} — Career & Audit History</h3>
                  <p className="text-xs text-slate-400 font-mono">{activityOfficer.email}</p>
                </div>
              </div>
              <button onClick={() => setActivityOfficer(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Role & Status History */}
              {officerHistory && (
                <div className="space-y-4">
                  {officerHistory.role_history.length > 0 && (
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <h4 className="text-xs font-bold uppercase text-cyan-400">Cadre Role Transitions</h4>
                      {officerHistory.role_history.map(rh => (
                        <div key={rh.id} className="text-xs flex items-center justify-between border-b border-slate-900 pb-1">
                          <span className="font-semibold text-slate-200">
                            {rh.previous_role} ➔ <strong className="text-cyan-300">{rh.new_role}</strong>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(rh.changed_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {officerHistory.case_memberships.length > 0 && (
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <h4 className="text-xs font-bold uppercase text-emerald-400">Assigned Case Memberships</h4>
                      {officerHistory.case_memberships.map(cm => (
                        <div key={cm.id} className="text-xs flex items-center justify-between border-b border-slate-900 pb-1">
                          <span className="text-slate-200 font-medium">
                            {cm.case_number} — {cm.case_title} ({cm.assignment_role})
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {loadingActivity ? (
                <div className="py-12 text-center text-slate-500 text-xs">Loading activity ledger...</div>
              ) : activityLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">No activity recorded for this officer.</div>
              ) : (
                <div className="relative pl-6 space-y-4 border-l border-slate-800 ml-2 text-xs">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="relative space-y-1">
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 bg-cyan-400" />
                      <div className="flex items-center justify-between text-slate-200">
                        <span className="font-semibold capitalize">{log.action_type.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      {log.case_title && <div className="text-[11px] text-cyan-400">Case: {log.case_title}</div>}
                      <div className="text-[10px] text-slate-400 font-mono break-all">
                        Resource: {log.resource_type} • ID: {log.resource_id?.slice(0, 12)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button onClick={() => setActivityOfficer(null)} className="px-4 py-1.5 bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
              <KeyRound className="w-5 h-5" />
              <span>Password Reset Token Generated</span>
            </div>

            <p className="text-xs text-slate-300">{resetData.message}</p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] uppercase font-mono text-slate-500">One-Time Token (Valid 24h)</span>
              <div className="text-xs font-mono text-cyan-300 break-all select-all">{resetData.reset_token}</div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(resetData.reset_token);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                }}
                className="inline-flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                <span>{copiedToken ? 'Copied Token' : 'Copy Token'}</span>
              </button>

              <button
                onClick={() => setResetData(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Officer Modal */}
      {isCreatingOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Add New Officer / Personnel</h3>
                  <p className="text-xs text-slate-400">Register new investigator credentials and institutional cadre profile.</p>
                </div>
              </div>
              <button onClick={() => setIsCreatingOfficer(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCreateOfficer} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={createForm.full_name}
                    onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                    placeholder="e.g. Inspector Amit Verma"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="e.g. amit.verma@delhipolice.gov.in"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Minimum 8 characters"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned Cadre Role *</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="investigator">Investigator (Field Officer)</option>
                    <option value="senior_investigator">Senior Investigator (Lead)</option>
                    <option value="admin">Administrator (Commanding)</option>
                    <option value="auditor">Independent Auditor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Badge / Officer ID</label>
                  <input
                    type="text"
                    value={createForm.badge_number}
                    onChange={(e) => setCreateForm({ ...createForm, badge_number: e.target.value })}
                    placeholder="e.g. DL-POL-1049"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={createForm.phone_number}
                    onChange={(e) => setCreateForm({ ...createForm, phone_number: e.target.value })}
                    placeholder="+91-9876543210"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Station / Unit</label>
                  <input
                    type="text"
                    value={createForm.station}
                    onChange={(e) => setCreateForm({ ...createForm, station: e.target.value })}
                    placeholder="e.g. Lodhi Road Special Cell"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Extended Institutional Profile Details */}
              <div className="pt-2 border-t border-slate-800/80">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">Institutional Cadre Profile</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Designation</label>
                    <input
                      type="text"
                      value={createForm.designation}
                      onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                      placeholder="e.g. Sub-Inspector"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">District</label>
                    <input
                      type="text"
                      value={createForm.district}
                      onChange={(e) => setCreateForm({ ...createForm, district: e.target.value })}
                      placeholder="e.g. South Delhi"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">State / UT</label>
                    <input
                      type="text"
                      value={createForm.state}
                      onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                      placeholder="e.g. Delhi (NCT)"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingOfficer(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCreate}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-600/30 text-xs disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{savingCreate ? 'Creating Officer...' : 'Create & Onboard Officer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      {bulkActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Confirm Bulk {bulkActionModal.toUpperCase()}</span>
            </h3>

            <p className="text-slate-300">
              Are you sure you want to execute bulk <strong>{bulkActionModal}</strong> on {selectedIds.length} selected officer(s)?
            </p>

            {bulkActionModal === 'reassign' && (
              <div className="space-y-1">
                <label className="block text-slate-400 font-medium">Select Case to Assign</label>
                <select
                  value={targetCaseId}
                  onChange={(e) => setTargetCaseId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
                >
                  <option value="">Choose an investigative case...</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setBulkActionModal(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecuteBulk(bulkActionModal)}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow"
              >
                Confirm Bulk Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
