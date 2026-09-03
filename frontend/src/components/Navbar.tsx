import React, { useState } from 'react';
import { Shield, User as UserIcon, LogOut, Sparkles, Users, HelpCircle, Menu, X, BookOpen, ShieldAlert, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TourOverlay } from './TourOverlay';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

import { RealTimeClock } from './layout/RealTimeClock';

interface NavbarProps {
  user?: { full_name: string; role: string } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [tourOpen, setTourOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdminOrAuditor = user?.role === 'admin' || user?.role === 'auditor';

  return (
    <>
      <header className={`h-16 px-4 sm:px-6 flex items-center justify-between z-30 border-b transition-colors duration-300 relative ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
      }`}>
        {/* Left Brand & Real-Time Clock */}
        <div className="flex items-center space-x-3 sm:space-x-5">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-xl border md:hidden transition ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => navigate('/cases')}>
            <div className="bg-gradient-to-tr from-cyan-600 to-blue-600 p-2 rounded-lg text-white shadow-lg shadow-cyan-500/20">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
                TRACE-X
              </span>
              <span className={`hidden xl:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${
                isDark ? 'bg-cyan-950 text-cyan-400 border-cyan-800/60' : 'bg-cyan-50 text-cyan-700 border-cyan-200'
              }`}>
                Intelligence Suite
              </span>
            </div>
          </div>

          {/* Real-Time Clock with Live Status */}
          <RealTimeClock />
        </div>

        {/* Right Desktop Nav & Controls */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button
            onClick={() => navigate('/cases')}
            className={`hidden md:inline-flex items-center text-xs font-semibold transition-colors ${
              isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'
            }`}
          >
            Dossiers
          </button>

          <button
            onClick={() => navigate('/tutorials')}
            className={`hidden md:inline-flex items-center space-x-1 text-xs font-semibold transition-colors ${
              isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Academy</span>
          </button>

          {isAdminOrAuditor && (
            <>
              <button
                onClick={() => navigate('/admin/officers')}
                className={`hidden md:inline-flex items-center space-x-1 text-xs font-semibold transition-colors ${
                  isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Officers</span>
              </button>

              <button
                onClick={() => navigate('/admin/audit')}
                className={`hidden md:inline-flex items-center space-x-1 text-xs font-semibold transition-colors ${
                  isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                <span>Audit</span>
              </button>
            </>
          )}

          <button
            onClick={() => navigate('/help')}
            className={`hidden md:inline-flex items-center space-x-1 text-xs font-semibold transition-colors ${
              isDark ? 'text-slate-300 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Help</span>
          </button>

          <button
            onClick={() => setTourOpen(true)}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
              isDark
                ? 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                : 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 text-cyan-700'
            }`}
            title="Launch Interactive Guided Tour"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tour</span>
          </button>

          <ThemeToggle />

          <div className={`flex items-center space-x-2 sm:space-x-3 pl-2 sm:pl-3 border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                isDark ? 'bg-slate-800 border-slate-700 text-cyan-400' : 'bg-slate-100 border-slate-300 text-cyan-600'
              }`}>
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="hidden lg:block text-left">
                <p className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{user?.full_name || 'Investigator'}</p>
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{user?.role?.replace('_', ' ') || 'Officer'}</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Logout"
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
              }`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className={`md:hidden p-4 border-b z-20 space-y-2 shadow-xl animate-in slide-in-from-top duration-200 ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <button
            onClick={() => { navigate('/cases'); setMobileMenuOpen(false); }}
            className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-cyan-500/10 font-semibold text-xs transition"
          >
            <FolderKanban className="w-4 h-4 text-cyan-400" />
            <span>Case Dossiers</span>
          </button>

          <button
            onClick={() => { navigate('/tutorials'); setMobileMenuOpen(false); }}
            className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-cyan-500/10 font-semibold text-xs transition"
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Interactive Video Tutorials</span>
          </button>

          <button
            onClick={() => { navigate('/help'); setMobileMenuOpen(false); }}
            className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-cyan-500/10 font-semibold text-xs transition"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>Help Center & FAQs</span>
          </button>

          {isAdminOrAuditor && (
            <>
              <div className="border-t border-slate-800/80 pt-2 text-[10px] font-mono text-slate-500 uppercase px-2 font-bold">
                Admin Console
              </div>
              <button
                onClick={() => { navigate('/admin/officers'); setMobileMenuOpen(false); }}
                className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-purple-500/10 font-semibold text-xs transition"
              >
                <Users className="w-4 h-4 text-purple-400" />
                <span>Officers Management</span>
              </button>
              <button
                onClick={() => { navigate('/admin/audit'); setMobileMenuOpen(false); }}
                className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-purple-500/10 font-semibold text-xs transition"
              >
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                <span>System Audit Logs</span>
              </button>
            </>
          )}

          <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between px-2">
            <span className="text-xs text-slate-400">{user?.full_name || 'Officer'}</span>
            <button
              onClick={onLogout}
              className="text-xs text-rose-400 hover:underline font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Guided Tour Overlay */}
      <TourOverlay isOpen={tourOpen} onClose={() => setTourOpen(false)} />
    </>
  );
};
