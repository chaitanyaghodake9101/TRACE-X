import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, User, Phone, Car, MapPin, Building, Calendar, FileText } from 'lucide-react';

export const EvidenceQualityLegend: React.FC = () => {
  return (
    <div className="absolute bottom-6 left-6 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl text-xs space-y-3 max-w-xs">
      <div>
        <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Evidence Quality Score Rings
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30"></span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>High Quality (≥ 70%)</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/30"></span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Medium Quality (40–69%)</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30"></span>
            <ShieldX className="w-3.5 h-3.5 text-rose-400" />
            <span>Low / Unverified (&lt; 40%)</span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800">
        <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Entity Taxonomy
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5">
            <User className="w-3 h-3 text-cyan-400" />
            <span>Person</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Phone className="w-3 h-3 text-teal-400" />
            <span>Phone</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Car className="w-3 h-3 text-purple-400" />
            <span>Vehicle</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <MapPin className="w-3 h-3 text-rose-400" />
            <span>Location</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Building className="w-3 h-3 text-blue-400" />
            <span>Organization</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-3 h-3 text-amber-400" />
            <span>Event</span>
          </div>
          <div className="flex items-center space-x-1.5 col-span-2">
            <FileText className="w-3 h-3 text-emerald-400" />
            <span>Evidence Document</span>
          </div>
        </div>
      </div>
    </div>
  );
};
