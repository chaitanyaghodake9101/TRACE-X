import React, { useState } from 'react';
import { Shield, User as UserIcon, LogOut, Sparkles, Users, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TourOverlay } from './TourOverlay';

interface NavbarProps {
  user?: { full_name: string; role: string } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = useState(false);
  const isAdminOrAuditor = user?.role === 'admin' || user?.role === 'auditor';

  return (
    <>
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/cases')}>
          <div className="bg-gradient-to-tr from-cyan-600 to-blue-600 p-2 rounded-lg text-white shadow-lg shadow-cyan-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
              TRACE-X
            </span>
            <span className="hidden md:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-cyan-950 text-cyan-400 border border-cyan-800/60 rounded">
              Investigation Intelligence
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/cases')}
            className="hidden md:inline-flex items-center text-xs font-semibold text-slate-300 hover:text-cyan-400 transition-colors"
          >
            Dossiers
          </button>

          {isAdminOrAuditor && (
            <button
              onClick={() => navigate('/admin/officers')}
              className="hidden md:inline-flex items-center space-x-1 text-xs font-semibold text-slate-300 hover:text-cyan-400 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Officers</span>
            </button>
          )}

          <button
            onClick={() => navigate('/help')}
            className="hidden md:inline-flex items-center space-x-1 text-xs font-semibold text-slate-300 hover:text-cyan-400 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Help Center</span>
          </button>

          <button
            onClick={() => navigate('/about')}
            className="hidden md:inline-flex items-center text-xs font-semibold text-slate-300 hover:text-cyan-400 transition-colors"
          >
            About SIH
          </button>

          <button
            onClick={() => setTourOpen(true)}
            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs font-semibold transition-all"
            title="Launch Interactive Guided Tour"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tour</span>
          </button>

          <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium text-slate-200">{user?.full_name || 'Investigator'}</p>
                <p className="text-[10px] text-slate-400 uppercase">{user?.role?.replace('_', ' ') || 'Officer'}</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Guided Tour Overlay */}
      <TourOverlay isOpen={tourOpen} onClose={() => setTourOpen(false)} />
    </>
  );
};
