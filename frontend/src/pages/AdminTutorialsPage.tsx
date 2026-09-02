import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { HelpWidget } from '../components/HelpWidget';
import { tutorialsApi } from '../services/api';
import { Tutorial, TutorialStepItem } from '../types';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  Save
} from 'lucide-react';

export const AdminTutorialsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Graph Analysis');
  const [videoUrl, setVideoUrl] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [orderIndex, setOrderIndex] = useState(1);
  const [isPublished, setIsPublished] = useState(true);
  const [steps, setSteps] = useState<TutorialStepItem[]>([
    { step_number: 1, title: 'Initial Step', detail: 'Describe action to take in TRACE-X', hint: '' }
  ]);

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    loadTutorials();
  }, []);

  const loadTutorials = async () => {
    try {
      const res = await tutorialsApi.listAdminTutorials();
      setTutorials(res);
      if (res.length > 0 && !selectedTutorial) {
        setSelectedTutorial(res[0]);
      }
    } catch (err) {
      console.error('Failed to load tutorials:', err);
    }
  };

  const handleSelect = (tut: Tutorial) => {
    setSelectedTutorial(tut);
    setTitle(tut.title);
    setDescription(tut.description);
    setCategory(tut.category);
    setVideoUrl(tut.video_url || '');
    setDurationMinutes(tut.duration_minutes);
    setOrderIndex(tut.order_index);
    setIsPublished(tut.is_published);
    setSteps(tut.steps_json && tut.steps_json.length > 0 ? tut.steps_json : [{ step_number: 1, title: '', detail: '', hint: '' }]);
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleStartCreate = () => {
    setSelectedTutorial(null);
    setTitle('');
    setDescription('');
    setCategory('Graph Analysis');
    setVideoUrl('');
    setDurationMinutes(5);
    setOrderIndex(tutorials.length + 1);
    setIsPublished(true);
    setSteps([
      { step_number: 1, title: 'Step 1: Open Case Graph', detail: 'Navigate to active FIR graph workspace', hint: 'Check top filter chips' },
      { step_number: 2, title: 'Step 2: Inspect 4D Scores', detail: 'Click node to view reliability breakdown', hint: 'Scores decay automatically' }
    ]);
    setIsCreating(true);
    setIsEditing(true);
  };

  const handleAddStep = () => {
    setSteps(prev => [
      ...prev,
      { step_number: prev.length + 1, title: '', detail: '', hint: '' }
    ]);
  };

  const handleRemoveStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        title,
        description,
        category,
        video_url: videoUrl || undefined,
        duration_minutes: durationMinutes,
        order_index: orderIndex,
        is_published: isPublished,
        steps
      };

      if (isCreating) {
        const created = await tutorialsApi.createTutorial(payload);
        await loadTutorials();
        handleSelect(created);
      } else if (selectedTutorial) {
        const updated = await tutorialsApi.updateTutorial(selectedTutorial.id, payload);
        await loadTutorials();
        handleSelect(updated);
      }
      setIsEditing(false);
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to save tutorial:', err);
      alert('Failed to save tutorial. Please check YouTube URL format.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTutorial) return;
    if (!confirm(`Delete tutorial '${selectedTutorial.title}'?`)) return;
    try {
      await tutorialsApi.deleteTutorial(selectedTutorial.id);
      setSelectedTutorial(null);
      await loadTutorials();
    } catch (err) {
      console.error('Failed to delete tutorial:', err);
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

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="inline-flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Interactive Onboarding & Training Management</span>
                </div>
                <h1 className="text-2xl font-bold text-white">Interactive Tutorials & Guides Studio</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Create and manage step-by-step training modules with verified YouTube embeds and investigator progress tracking.
                </p>
              </div>

              <button
                onClick={handleStartCreate}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Tutorial</span>
              </button>
            </div>

            {/* Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Left Column: Tutorials List */}
              <div className="lg:col-span-1 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tutorials ({tutorials.length})</h3>

                <div className="space-y-2">
                  {tutorials.map(tut => (
                    <div
                      key={tut.id}
                      onClick={() => handleSelect(tut)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer ${
                        selectedTutorial?.id === tut.id && !isCreating
                          ? 'bg-cyan-950/40 border-cyan-500/80 shadow'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">{tut.title}</span>
                        <span className="text-[10px] text-cyan-400 font-mono">#{tut.order_index}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">{tut.category}</span>
                        <span className="font-mono text-[10px]">{tut.duration_minutes}m</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Editor & Step Builder */}
              <div className="lg:col-span-3">
                {selectedTutorial || isCreating ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
                    {/* Action Bar */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800">
                          {isCreating ? 'NEW TUTORIAL' : selectedTutorial?.category}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {!isEditing && selectedTutorial && (
                          <>
                            <button
                              onClick={() => setIsEditing(true)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 flex items-center space-x-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Module</span>
                            </button>
                            <button
                              onClick={handleDelete}
                              className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 rounded-lg text-xs font-semibold border border-red-800 flex items-center space-x-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Form View */}
                    {isEditing ? (
                      <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Tutorial Title</label>
                            <input
                              type="text"
                              required
                              value={title}
                              onChange={e => setTitle(e.target.value)}
                              placeholder="e.g. Navigating Multi-Ring Evidence Graphs"
                              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                            <select
                              value={category}
                              onChange={e => setCategory(e.target.value)}
                              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                            >
                              <option value="Graph Analysis">Graph Analysis</option>
                              <option value="ACH Hypotheses">ACH Hypotheses</option>
                              <option value="Evidence Custody">Evidence Custody</option>
                              <option value="VoI Prioritization">VoI Prioritization</option>
                              <option value="Admin & Security">Admin & Security</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                          <textarea
                            rows={2}
                            required
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Brief summary of learning objectives..."
                            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-300 mb-1">YouTube Video URL / ID</label>
                            <input
                              type="text"
                              value={videoUrl}
                              onChange={e => setVideoUrl(e.target.value)}
                              placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Duration (Minutes)</label>
                            <input
                              type="number"
                              min={1}
                              value={durationMinutes}
                              onChange={e => setDurationMinutes(Number(e.target.value))}
                              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        {/* Step Builder */}
                        <div className="space-y-3 pt-4 border-t border-slate-800">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase text-cyan-400">Step Checklist Items ({steps.length})</h4>
                            <button
                              type="button"
                              onClick={handleAddStep}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-semibold flex items-center space-x-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Step</span>
                            </button>
                          </div>

                          {steps.map((step, idx) => (
                            <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-slate-400">Step {idx + 1}</span>
                                {steps.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStep(idx)}
                                    className="text-red-400 hover:text-red-300 text-xs"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                required
                                value={step.title}
                                onChange={e => {
                                  const updated = [...steps];
                                  updated[idx].title = e.target.value;
                                  setSteps(updated);
                                }}
                                placeholder="Step headline..."
                                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                              />
                              <input
                                type="text"
                                required
                                value={step.detail}
                                onChange={e => {
                                  const updated = [...steps];
                                  updated[idx].detail = e.target.value;
                                  setSteps(updated);
                                }}
                                placeholder="Step instructions detail..."
                                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/30 flex items-center space-x-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{saving ? 'Saving...' : 'Save Tutorial'}</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-xl font-bold text-white">{selectedTutorial?.title}</h2>
                          <p className="text-xs text-slate-300 mt-1">{selectedTutorial?.description}</p>
                        </div>

                        {selectedTutorial?.youtube_id && (
                          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-cyan-400">
                            YouTube ID: {selectedTutorial.youtube_id}
                          </div>
                        )}

                        <div className="space-y-2 pt-2">
                          <h4 className="text-xs font-bold uppercase text-slate-400">Configured Steps</h4>
                          {selectedTutorial?.steps_json?.map((st, i) => (
                            <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                              <span className="font-bold text-cyan-400">Step {st.step_number || i + 1}: </span>
                              <span className="text-white font-medium">{st.title}</span>
                              <p className="text-slate-400 mt-0.5">{st.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center text-slate-400">
                    Select a tutorial from the left or create a new one.
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
