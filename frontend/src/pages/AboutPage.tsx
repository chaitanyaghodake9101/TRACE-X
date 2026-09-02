import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { HelpWidget } from '../components/HelpWidget';
import { cmsApi } from '../services/api';
import { PublicContentPage } from '../types';
import {
  ShieldCheck,
  Scale,
  Brain,
  Lock,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const navigate = useNavigate();
  const [pageData, setPageData] = useState<PublicContentPage | null>(null);
  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    loadPage();
  }, []);

  const loadPage = async () => {
    try {
      const res = await cmsApi.getPublicPage('about-us');
      setPageData(res);
    } catch (err) {
      console.warn('Failed to load CMS about page, using default render:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-5xl mx-auto space-y-10">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 p-8 lg:p-10 shadow-2xl">
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 rounded-full text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>National Criminal Relational Intelligence</span>
                </div>

                <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  {pageData?.title || 'TRACE-X Investigative Intelligence Platform'}
                </h1>

                <p className="text-slate-300 text-sm lg:text-base max-w-3xl leading-relaxed">
                  {pageData?.summary ||
                    'Transformative Relational Analytics & Criminal Evidence Cross-Examination engineered for federal law enforcement, state police departments, and financial crime taskforces.'}
                </p>

                {pageData?.is_fallback && (
                  <div className="inline-flex items-center space-x-1.5 text-xs text-slate-400 font-mono bg-slate-800/60 px-2.5 py-1 rounded border border-slate-700">
                    <span>⚡ Standard System Institutional Baseline (Version {pageData.version})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Core Innovation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-cyan-500/40 transition">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">4D Evidence Quality Graph</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Multi-variable mathematical scoring ($Q(e) = 0.35S + 0.20T + 0.30C + 0.15D$) with continuous 30-day half-life exponential degradation.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-purple-500/40 transition">
                <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800 flex items-center justify-center text-purple-400">
                  <Scale className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">Heuer ACH Hypotheses</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Richards Heuer Analysis of Competing Hypotheses with calibrated 1.5× contradiction diagnostic penalties and sigmoid likelihoods.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-emerald-500/40 transition">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">Expected Information Gain</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Decision-theoretic Value-of-Information (VoI) optimization providing ranked investigative actions and explanation audits.
                </p>
              </div>
            </div>

            {/* Markdown Body Article */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 space-y-6">
              <div className="prose prose-invert max-w-none prose-headings:text-cyan-300 prose-a:text-cyan-400 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {pageData?.body_markdown || (
                  <div className="space-y-4 text-slate-300">
                    <h3 className="text-lg font-bold text-white">Judicial Admissibility & Evidence Standards</h3>
                    <p>
                      Every piece of digital evidence ingested into TRACE-X undergoes immediate SHA-256 cryptographic digest calculation, timestamp pinning, and continuous tamper-detection verification across the multi-station Chain of Custody.
                    </p>
                    <h3 className="text-lg font-bold text-white">Multi-Jurisdictional Architecture</h3>
                    <p>
                      Designed with zero-knowledge tenant isolation, role-based investigator authorization, and automated export of court-ready PDF dossiers complete with diagnostic matrices and audit logs.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Compliance & Standards Footer Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs text-slate-400">
              <div className="flex items-center space-x-3">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Compliant with Indian Evidence Act & Inter-Agency Criminal Intelligence Sharing Frameworks</span>
              </div>
              <button
                onClick={() => navigate('/tutorials')}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition"
              >
                <span>Interactive Tutorials</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </main>
      </div>

      <HelpWidget />
    </div>
  );
};
