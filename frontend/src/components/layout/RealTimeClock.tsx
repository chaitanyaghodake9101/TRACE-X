import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useRealtime } from '../../hooks/useRealtime';

interface RealTimeClockProps {
  showStatus?: boolean;
}

export const RealTimeClock: React.FC<RealTimeClockProps> = ({ showStatus = true }) => {
  const { isDark } = useTheme();
  const [time, setTime] = useState(new Date());
  const { isConnected } = useRealtime();

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format: Thu, 03 Sep 2026 — 23:35:10 IST
  const weekday = time.toLocaleDateString('en-US', { weekday: 'short' });
  const day = String(time.getDate()).padStart(2, '0');
  const month = time.toLocaleDateString('en-US', { month: 'short' });
  const year = time.getFullYear();
  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const seconds = String(time.getSeconds()).padStart(2, '0');

  // Timezone abbreviation (e.g. IST, UTC, EDT)
  const tzMatch = time.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ');
  const tzName = tzMatch[tzMatch.length - 1] || 'UTC';

  return (
    <div className="flex items-center space-x-2 select-none">
      {/* Clock Display Badge */}
      <div className={`hidden sm:flex items-center space-x-2 px-3 py-1 rounded-xl border text-[11px] font-mono tracking-tight transition-colors shadow-sm ${
        isDark
          ? 'bg-slate-950/80 border-slate-800/90 text-slate-300'
          : 'bg-slate-100/90 border-slate-200 text-slate-700'
      }`}>
        <Clock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
        <span className="font-semibold text-cyan-400 hidden lg:inline">{weekday},</span>
        <span>{day} {month} {year}</span>
        <span className="opacity-40">—</span>
        <span className="font-bold text-slate-100 dark:text-slate-100 text-slate-900">
          {hours}:{minutes}:{seconds}
        </span>
        <span className="text-[10px] text-slate-500 font-sans font-bold">{tzName}</span>
      </div>

      {/* Live Sync Status Indicator */}
      {showStatus && (
        <div
          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-wide transition-colors ${
            isConnected
              ? isDark
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : isDark
              ? 'bg-slate-900 text-slate-400 border-slate-800'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
          title={isConnected ? 'Real-time WebSocket event stream connected' : 'Local polling fallback active'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
          <span className="hidden xs:inline">{isConnected ? 'LIVE' : 'STANDBY'}</span>
        </div>
      )}
    </div>
  );
};
