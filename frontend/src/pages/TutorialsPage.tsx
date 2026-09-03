import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { tutorialsApi } from '../services/api';
import { Tutorial } from '../types';
import {
  CheckCircle2,
  Clock,
  BookOpen,
  Search,
  Award,
  Filter,
  PlayCircle,
  ExternalLink,
  Shield
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const DEFAULT_OFFICIAL_PLAYLIST = {
  playlist_id: 'PLafJ_v-kSLB0',
  embed_url: 'https://www.youtube-nocookie.com/embed?listType=playlist&list=PLafJ_v-kSLB0',
  title: 'TRACE-X Law Enforcement Masterclass Series',
  description: 'Official video training covering 4D evidence graph navigation, Heuer ACH matrices, and court-ready cryptographic custody verification.'
};

const FALLBACK_TUTORIALS: Tutorial[] = [
  {
    id: 'tut-001',
    title: '4D Crime Graph Ingestion & Multi-Hop Network Traversal',
    description: 'Learn how to ingest disparate FIRs, CDR files, and financial ledgers, compute SHA-256 integrity digests, and traverse multi-hop relationship clusters.',
    category: 'Graph Analysis',
    youtube_id: 'PLafJ_v-kSLB0',
    video_url: 'https://www.youtube-nocookie.com/embed?listType=playlist&list=PLafJ_v-kSLB0',
    duration_minutes: 12,
    order_index: 1,
    is_published: true,
    steps_json: [
      { step_number: 1, title: 'Open Case Dossier', detail: 'Select an active dossier from the Cases module to view entities and custody metrics.', hint: 'Click on Case #FIR-2026-DEL-8841.' },
      { step_number: 2, title: 'Launch 4D Graph Workspace', detail: 'Click on Evidence Graph to initialize the canvas with force-directed physics.', hint: 'Use node clustering tools in the top bar.' },
      { step_number: 3, title: 'Inspect Entity Degrees & Quality Scores', detail: 'Click on key suspect nodes to view cross-corroboration and temporal freshness scores.', hint: 'Scores >= 0.70 are highlighted in green.' }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'tut-002',
    title: 'Heuer Analysis of Competing Hypotheses (ACH) Matrix',
    description: 'Structure investigative theories into Bayesian matrices to evaluate diagnostic evidence and penalize inconsistent explanations.',
    category: 'ACH Hypotheses',
    youtube_id: 'PLafJ_v-kSLB0',
    video_url: 'https://www.youtube-nocookie.com/embed?listType=playlist&list=PLafJ_v-kSLB0',
    duration_minutes: 15,
    order_index: 2,
    is_published: true,
    steps_json: [
      { step_number: 1, title: 'Define Multiple Working Hypotheses', detail: 'Ensure at least two mutually exclusive hypotheses are recorded to prevent confirmation bias.', hint: 'Example: H1 Shell Company vs H2 Legitimate Vendor.' },
      { step_number: 2, title: 'Assign Diagnostic Weights', detail: 'Evaluate each evidence item for Consistency (+), Inconsistency (-), or Neutral (N).', hint: 'Inconsistent evidence carries higher diagnostic value.' },
      { step_number: 3, title: 'Calculate Inconsistency Penalty Scores', detail: 'Review automated ranking to identify the hypothesis with the lowest contradictory weight.', hint: 'Low inconsistency score indicates most plausible theory.' }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'tut-003',
    title: 'Value-of-Information (VoI) Action Prioritizer',
    description: 'Calculate information gain per investigative action (warrants, CDR subpoenas, forensic extraction) to optimize law enforcement resource allocation.',
    category: 'VoI Prioritization',
    youtube_id: 'PLafJ_v-kSLB0',
    video_url: 'https://www.youtube-nocookie.com/embed?listType=playlist&list=PLafJ_v-kSLB0',
    duration_minutes: 10,
    order_index: 3,
    is_published: true,
    steps_json: [
      { step_number: 1, title: 'Review Prioritized Actions Queue', detail: 'Inspect pending investigative steps ranked by expected entropy reduction.', hint: 'High-gain actions appear at the top.' },
      { step_number: 2, title: 'Execute High-Yield Leads', detail: 'Assign warrants or forensic subpoenas to specialized cell investigators.', hint: 'Mark actions as in-progress or completed.' }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'tut-004',
    title: 'Cryptographic Chain of Custody & Court Audit PDF',
    description: 'Verify SHA-256 digital signatures, detect simulated evidence tampering, and export tamper-evident forensic PDF audit dossiers.',
    category: 'Evidence Custody',
    youtube_id: 'PLafJ_v-kSLB0',
    video_url: 'https://www.youtube-nocookie.com/embed?listType=playlist&list=PLafJ_v-kSLB0',
    duration_minutes: 8,
    order_index: 4,
    is_published: true,
    steps_json: [
      { step_number: 1, title: 'Audit Evidence SHA-256 Provenance', detail: 'Inspect the cryptographic custody timeline logged upon evidence ingestion.', hint: 'Check event timestamps and officer IDs.' },
      { step_number: 2, title: 'Generate Official PDF Dossier', detail: 'Click Export PDF Dossier to compile court-ready documentation with embedded digital signatures.', hint: 'Download completes in standard PDF format.' }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const TutorialsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [tutorials, setTutorials] = useState<Tutorial[]>(FALLBACK_TUTORIALS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(FALLBACK_TUTORIALS[0]);
  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    loadTutorials();
  }, [selectedCategory]);

  const loadTutorials = async () => {
    try {
      const res = await tutorialsApi.listPublicTutorials(selectedCategory === 'all' ? undefined : selectedCategory);
      if (Array.isArray(res) && res.length > 0) {
        setTutorials(res);
        if (!selectedTutorial) {
          setSelectedTutorial(res[0]);
        }
      } else {
        setTutorials(FALLBACK_TUTORIALS);
      }
    } catch (err) {
      console.warn('API connection unavailable, loaded fallback video tutorials:', err);
      setTutorials(FALLBACK_TUTORIALS);
    }
  };

  const handleToggleStep = async (stepIndex: number) => {
    if (!selectedTutorial) return;
    const isCompleted = stepIndex >= (selectedTutorial.steps_json?.length || 1) - 1;
    try {
      const updatedProg = await tutorialsApi.updateProgress(selectedTutorial.id, {
        last_step_index: stepIndex + 1,
        completed: isCompleted
      });
      setSelectedTutorial({
        ...selectedTutorial,
        user_progress: updatedProg
      });
      setTutorials(prev =>
        prev.map(t => (t.id === selectedTutorial.id ? { ...t, user_progress: updatedProg } : t))
      );
    } catch (err) {
      // Local fallback progress update
      const localProg = {
        last_step_index: stepIndex + 1,
        completed: isCompleted,
        updated_at: new Date().toISOString()
      };
      setSelectedTutorial({
        ...selectedTutorial,
        user_progress: localProg as any
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  const filteredTutorials = tutorials.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'all' || t.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesQuery && matchesCategory;
  });

  const categories = ['all', 'Graph Analysis', 'ACH Hypotheses', 'Evidence Custody', 'VoI Prioritization'];

  // Construct safe embed URL for the YouTube playlist
  const safeEmbedUrl = DEFAULT_OFFICIAL_PLAYLIST.embed_url;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Top Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl relative overflow-hidden transition-colors ${
              isDark
                ? 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 border-slate-800'
                : 'bg-gradient-to-br from-white via-slate-50 to-cyan-50/60 border-slate-200 shadow-slate-200/60'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className={`inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider mb-2 px-3 py-1 rounded-full border ${
                    isDark ? 'bg-cyan-950/80 border-cyan-800/80 text-cyan-400' : 'bg-cyan-50 border-cyan-200 text-cyan-800'
                  }`}>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Investigator Academy & Training Center</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Interactive Video Tutorials</h1>
                  <p className={`text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Master 4D evidence graph scoring, Heuer ACH matrix analysis, and Value-of-Information (VoI) investigative action planning.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-72">
                  <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search tutorials & guides..."
                    className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-colors focus:outline-none focus:border-cyan-500 border ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              <span className="text-slate-500 text-xs font-semibold mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filters:
              </span>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border ${
                    selectedCategory === cat
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-600/30'
                      : isDark
                      ? 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-300 shadow-sm'
                  }`}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Main Interactive Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Left Column: Tutorial Playlist */}
              <div className="lg:col-span-1 space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <span>Available Modules ({filteredTutorials.length})</span>
                </h3>

                {filteredTutorials.map((tut, idx) => {
                  const isSelected = selectedTutorial?.id === tut.id;
                  const isCompleted = tut.user_progress?.completed;

                  return (
                    <div
                      key={tut.id}
                      onClick={() => setSelectedTutorial(tut)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex items-start space-x-3 ${
                        isSelected
                          ? isDark
                            ? 'bg-cyan-950/40 border-cyan-500/80 shadow-lg shadow-cyan-950/30'
                            : 'bg-cyan-50 border-cyan-400 shadow-md'
                          : isDark
                          ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          : 'bg-white border-slate-200 hover:border-slate-400 shadow-sm'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-mono ${
                            isDark ? 'border-slate-600 text-slate-400' : 'border-slate-400 text-slate-600'
                          }`}>
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                            isDark ? 'text-cyan-400 bg-cyan-950/80 border-cyan-800/60' : 'text-cyan-700 bg-cyan-50 border-cyan-200'
                          }`}>
                            {tut.category}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" /> {tut.duration_minutes}m
                          </span>
                        </div>
                        <h4 className={`text-xs font-semibold mt-1.5 truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{tut.title}</h4>
                        <p className={`text-[11px] line-clamp-2 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{tut.description}</p>
                      </div>
                    </div>
                  );
                })}

                {filteredTutorials.length === 0 && (
                  <div className={`p-8 rounded-2xl border text-center space-y-2 ${
                    isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <p className="text-xs text-slate-400">No tutorials found matching your query.</p>
                  </div>
                )}
              </div>

              {/* Right Column: Safe Video Player & Interactive Step Guide */}
              <div className="lg:col-span-2 space-y-6">
                {selectedTutorial ? (
                  <div className={`border rounded-2xl p-6 space-y-6 shadow-2xl transition-colors ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/60'
                  }`}>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="inline-flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
                          <span>{selectedTutorial.category}</span>
                          <span>•</span>
                          <span>{selectedTutorial.duration_minutes} Minutes</span>
                        </div>
                        <h2 className="text-xl font-bold">{selectedTutorial.title}</h2>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{selectedTutorial.description}</p>
                      </div>

                      {selectedTutorial.user_progress?.completed && (
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-semibold">
                          <Award className="w-4 h-4 text-emerald-400" />
                          <span>Module Completed</span>
                        </div>
                      )}
                    </div>

                    {/* Safe YouTube Video Player Embed with Fallback Playlist */}
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-800 bg-black shadow-lg">
                      <iframe
                        src={safeEmbedUrl}
                        title={selectedTutorial.title || DEFAULT_OFFICIAL_PLAYLIST.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
                        referrerPolicy="strict-origin-when-cross-origin"
                        className="w-full h-full border-0"
                      />
                    </div>

                    {/* Safe External Link Note */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/40">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Pre-approved law enforcement instructional playlist embed (youtube-nocookie)</span>
                      </div>
                      <a
                        href="https://youtube.com/playlist?list=PLafJ_v-kSLB0"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-cyan-400 hover:underline font-semibold"
                      >
                        <span>Open on YouTube</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Step-by-Step Interactive Execution Guide */}
                    <div className="space-y-4 pt-4 border-t border-slate-800/80">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                        <span>Guided Practical Investigation Steps</span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          Progress: {selectedTutorial.user_progress?.last_step_index || 0} / {selectedTutorial.steps_json?.length || 0}
                        </span>
                      </h3>

                      <div className="space-y-3">
                        {selectedTutorial.steps_json?.map((step, sIdx) => {
                          const isDone = (selectedTutorial.user_progress?.last_step_index || 0) > sIdx;

                          return (
                            <div
                              key={sIdx}
                              className={`p-4 rounded-xl border transition ${
                                isDone
                                  ? isDark
                                    ? 'bg-emerald-950/20 border-emerald-800/60'
                                    : 'bg-emerald-50 border-emerald-200'
                                  : isDark
                                  ? 'bg-slate-950/60 border-slate-800/80'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-mono font-bold text-cyan-400">Step {step.step_number || sIdx + 1}:</span>
                                    <h4 className="text-xs font-bold">{step.title}</h4>
                                  </div>
                                  <p className={`text-xs pl-4 border-l ml-1 ${
                                    isDark ? 'text-slate-300 border-slate-800' : 'text-slate-600 border-slate-200'
                                  }`}>{step.detail}</p>
                                  {step.hint && (
                                    <p className="text-[11px] text-amber-500/90 pl-4 border-l border-amber-500/40 ml-1 font-mono">
                                      Tip: {step.hint}
                                    </p>
                                  )}
                                </div>

                                <button
                                  onClick={() => handleToggleStep(sIdx)}
                                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                                    isDone
                                      ? 'bg-emerald-600 text-white border-emerald-500'
                                      : isDark
                                      ? 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-slate-700'
                                      : 'bg-white hover:bg-slate-100 text-cyan-700 border-slate-300'
                                  }`}
                                >
                                  {isDone ? 'Completed' : 'Mark Done'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-12 rounded-2xl border text-center space-y-3 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <PlayCircle className="w-12 h-12 text-slate-600 mx-auto" />
                    <h3 className="text-sm font-semibold">Select a Tutorial Module</h3>
                    <p className="text-xs text-slate-400">Choose a training module from the list to launch the safe video player and guide.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TutorialsPage;
