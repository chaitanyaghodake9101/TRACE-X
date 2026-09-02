import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { HelpWidget } from '../components/HelpWidget';
import { tutorialsApi } from '../services/api';
import { Tutorial } from '../types';
import {
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Search,
  Video,
  Award,
  Filter
} from 'lucide-react';

export const TutorialsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    loadTutorials();
  }, [selectedCategory]);

  const loadTutorials = async () => {
    try {
      const res = await tutorialsApi.listPublicTutorials(selectedCategory === 'all' ? undefined : selectedCategory);
      setTutorials(res);
      if (res.length > 0 && !selectedTutorial) {
        setSelectedTutorial(res[0]);
      }
    } catch (err) {
      console.warn('Failed to load tutorials:', err);
    }
  };

  const handleToggleStep = async (stepIndex: number) => {
    if (!selectedTutorial) return;
    const isCompleted = stepIndex >= selectedTutorial.steps_json.length - 1;
    try {
      const updatedProg = await tutorialsApi.updateProgress(selectedTutorial.id, {
        last_step_index: stepIndex + 1,
        completed: isCompleted
      });
      setSelectedTutorial({
        ...selectedTutorial,
        user_progress: updatedProg
      });
      // Refresh list progress badge
      setTutorials(prev =>
        prev.map(t => (t.id === selectedTutorial.id ? { ...t, user_progress: updatedProg } : t))
      );
    } catch (err) {
      console.error('Failed to update step progress:', err);
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
    return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
  });

  const categories = ['all', 'Graph Analysis', 'ACH Hypotheses', 'Evidence Custody', 'VoI Prioritization', 'Admin & Security'];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Top Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="inline-flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Investigator Academy & Training Center</span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Interactive Video Tutorials</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Master 4D evidence graph scoring, Heuer ACH matrix analysis, and VoI investigative action planning.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search tutorials & guides..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    selectedCategory === cat
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
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
                      className={`p-4 rounded-xl border transition cursor-pointer flex items-start space-x-3 ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/80 shadow-lg shadow-cyan-950/30'
                          : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                            {tut.category}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" /> {tut.duration_minutes}m
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-white mt-1.5 truncate">{tut.title}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{tut.description}</p>
                      </div>
                    </div>
                  );
                })}

                {filteredTutorials.length === 0 && (
                  <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-slate-400">No tutorials found matching your query.</p>
                  </div>
                )}
              </div>

              {/* Right Column: Video Player & Step-by-Step Interactive Guide */}
              <div className="lg:col-span-2 space-y-6">
                {selectedTutorial ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="inline-flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
                          <span>{selectedTutorial.category}</span>
                          <span>•</span>
                          <span>{selectedTutorial.duration_minutes} Minutes</span>
                        </div>
                        <h2 className="text-xl font-bold text-white">{selectedTutorial.title}</h2>
                        <p className="text-xs text-slate-300 mt-1">{selectedTutorial.description}</p>
                      </div>

                      {selectedTutorial.user_progress?.completed && (
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-semibold">
                          <Award className="w-4 h-4 text-emerald-400" />
                          <span>Module Completed</span>
                        </div>
                      )}
                    </div>

                    {/* Video Player Embed */}
                    {selectedTutorial.youtube_id ? (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-800 bg-black">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${selectedTutorial.youtube_id}?rel=0&modestbranding=1`}
                          title={selectedTutorial.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full border-0"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-video rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-500 space-y-2">
                        <Video className="w-10 h-10 text-slate-600" />
                        <span className="text-xs">Interactive walkthrough available below</span>
                      </div>
                    )}

                    {/* Step-by-Step Interactive Execution Guide */}
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                        <span>Guided Investigation Steps</span>
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
                                  ? 'bg-emerald-950/20 border-emerald-800/60'
                                  : 'bg-slate-950/60 border-slate-800/80'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-mono font-bold text-cyan-400">Step {step.step_number || sIdx + 1}:</span>
                                    <h4 className="text-xs font-bold text-white">{step.title}</h4>
                                  </div>
                                  <p className="text-xs text-slate-300 pl-4 border-l border-slate-800 ml-1">{step.detail}</p>
                                  {step.hint && (
                                    <p className="text-[11px] text-amber-300/80 pl-4 border-l border-amber-900/60 ml-1 font-mono">
                                      💡 Hint: {step.hint}
                                    </p>
                                  )}
                                </div>

                                <button
                                  onClick={() => handleToggleStep(sIdx)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                                    isDone
                                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                  }`}
                                >
                                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                  <span>{isDone ? 'Completed' : 'Mark Done'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center text-slate-400">
                    <p className="text-sm">Select a tutorial module from the left to start learning.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <HelpWidget />
    </div>
  );
};
