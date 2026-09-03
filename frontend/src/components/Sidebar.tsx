import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  FolderKanban,
  Network,
  GitCompare,
  ListOrdered,
  FileText,
  ArrowLeft,
  Database,
  HelpCircle,
  BookOpen,
  Sliders,
  Palette,
  ShieldAlert,
  Users
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');
  const isAdmin = user?.role === 'admin';

  const navItems = [
    ...(id ? [
      {
        to: `/cases/${id}`,
        icon: FolderKanban,
        label: 'Dossier & Entities',
        badge: 'POI & Assets'
      },
      {
        to: `/cases/${id}/graph`,
        icon: Network,
        label: 'Evidence Graph',
        badge: 'Score Engine'
      },
      {
        to: `/cases/${id}/hypotheses`,
        icon: GitCompare,
        label: 'Competing Hypotheses',
        badge: 'AI Comparison'
      },
      {
        to: `/cases/${id}/actions`,
        icon: ListOrdered,
        label: 'Prioritized Actions',
        badge: 'Gain Ranked'
      },
      {
        to: `/cases/${id}/reports`,
        icon: FileText,
        label: 'Investigation Reports',
        badge: 'PDF / Audit'
      },
    ] : []),
    {
      to: `/tutorials`,
      icon: BookOpen,
      label: 'Interactive Tutorials',
      badge: 'Video Academy'
    },
    {
      to: `/help`,
      icon: HelpCircle,
      label: 'Help & Knowledge Base',
      badge: 'Manuals'
    },
    {
      to: `/about`,
      icon: Database,
      label: 'About TRACE-X (CMS)',
      badge: 'SIH26189'
    },
  ];

  const adminNavItems = [
    {
      to: `/admin/officers`,
      icon: Users,
      label: 'Officers & Personnel',
      badge: 'Extended Profiles'
    },
    {
      to: `/admin/audit`,
      icon: ShieldAlert,
      label: 'System Audit Log',
      badge: 'PDF / CSV'
    },
    {
      to: `/admin/content`,
      icon: FileText,
      label: 'Content CMS Editor',
      badge: 'Versioning'
    },
    {
      to: `/admin/tutorials`,
      icon: BookOpen,
      label: 'Tutorials Studio',
      badge: 'YouTube Verified'
    },
    {
      to: `/admin/theme`,
      icon: Palette,
      label: 'Theme & Branding',
      badge: 'Palette Tokens'
    },
    {
      to: `/admin/flags`,
      icon: Sliders,
      label: 'Feature Flags',
      badge: 'Outbox Sync'
    },
    {
      to: `/admin/health`,
      icon: ShieldAlert,
      label: 'Tampering Dashboard',
      badge: 'Integrity Logs'
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 overflow-y-auto">
      <div className="space-y-6">
        <div>
          <NavLink
            to="/cases"
            className="flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 mb-4 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>ALL CASES</span>
          </NavLink>
          {id && (
            <div className="px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/40">
              <p className="text-[11px] font-mono text-cyan-400">ACTIVE WORKSPACE</p>
              <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">Case #{id?.slice(0, 8)}</p>
            </div>
          )}
        </div>

        {/* Primary Investigation Nav */}
        <nav className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1">
            Investigation Suite
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center space-x-3">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
            </NavLink>
          ))}
        </nav>

        {/* Administration & Customization Nav (Admins) */}
        {isAdmin && (
          <nav className="space-y-1 pt-3 border-t border-slate-800/80">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/80 px-3 py-1">
              Administration & Studio
            </div>
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center space-x-3">
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
              </NavLink>
            ))}
          </nav>
        )}
      </div>

      <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center space-x-2 mt-4">
        <Database className="w-4 h-4 text-cyan-500" />
        <span>Postgres & Neo4j Active</span>
      </div>
    </aside>
  );
};
