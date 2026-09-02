import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { HelpWidget } from '../components/HelpWidget';
import { cmsApi } from '../services/api';
import { ContentPage } from '../types';
import {
  FileText,
  Plus,
  RotateCcw,
  Send,
  History,
  Edit3,
  Save
} from 'lucide-react';

export const AdminContentPage: React.FC = () => {
  const navigate = useNavigate();
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<ContentPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [changeSummary, setChangeSummary] = useState('');

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      setLoading(true);
      const res = await cmsApi.listAdminPages();
      setPages(res);
      if (res.length > 0 && !selectedPage) {
        setSelectedPage(res[0]);
      }
    } catch (err) {
      console.error('Failed to load CMS pages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPage = async (page: ContentPage) => {
    try {
      const detail = await cmsApi.getPageDetail(page.id);
      setSelectedPage(detail);
      setSlug(detail.slug);
      setTitle(detail.title);
      setSummary(detail.summary || '');
      setBodyMarkdown(detail.body_markdown);
      setIsEditing(false);
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to load page detail:', err);
    }
  };

  const handleStartCreate = () => {
    setSelectedPage(null);
    setSlug('');
    setTitle('');
    setSummary('');
    setBodyMarkdown('# New Institutional Content Page\n\nWrite markdown content here...');
    setChangeSummary('');
    setIsCreating(true);
    setIsEditing(true);
  };

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (isCreating) {
        const created = await cmsApi.createPage({
          slug,
          title,
          summary,
          body_markdown: bodyMarkdown,
          status: 'draft'
        });
        await loadPages();
        await handleSelectPage(created);
      } else if (selectedPage) {
        const updated = await cmsApi.updatePage(selectedPage.id, {
          title,
          summary,
          body_markdown: bodyMarkdown,
          change_summary: changeSummary || 'Content revision update'
        });
        await loadPages();
        await handleSelectPage(updated);
      }
      setIsEditing(false);
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to save page:', err);
      alert('Failed to save page. Please ensure the slug is unique.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedPage) return;
    try {
      setSaving(true);
      const published = await cmsApi.publishPage(selectedPage.id);
      await loadPages();
      await handleSelectPage(published);
    } catch (err) {
      console.error('Failed to publish page:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (versionNumber: number) => {
    if (!selectedPage) return;
    if (!confirm(`Are you sure you want to rollback to Version ${versionNumber}?`)) return;
    try {
      setSaving(true);
      const rolled = await cmsApi.rollbackPage(selectedPage.id, versionNumber);
      await loadPages();
      await handleSelectPage(rolled);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to rollback page:', err);
    } finally {
      setSaving(false);
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
                  <FileText className="w-3.5 h-3.5" />
                  <span>Institutional Content Management System</span>
                </div>
                <h1 className="text-2xl font-bold text-white">Public Content & Guidelines CMS</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage About Us, Operating Procedures, and Public Evidence Standards with point-in-time version rollback.
                </p>
              </div>

              <button
                onClick={handleStartCreate}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Page</span>
              </button>
            </div>

            {/* Main Content Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Left Column: Page Index */}
              <div className="lg:col-span-1 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pages ({pages.length})</h3>

                <div className="space-y-2">
                  {pages.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPage(p)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer ${
                        selectedPage?.id === p.id && !isCreating
                          ? 'bg-cyan-950/40 border-cyan-500/80 shadow'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">{p.title}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                            p.status === 'published'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1">/{p.slug}</div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>v{p.current_version}</span>
                        <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}

                  {pages.length === 0 && !loading && (
                    <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                      No CMS pages created yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Editor & Preview */}
              <div className="lg:col-span-3 space-y-4">
                {selectedPage || isCreating ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800">
                          {isCreating ? 'NEW DRAFT' : `v${selectedPage?.current_version} • ${selectedPage?.status.toUpperCase()}`}
                        </span>
                        {!isCreating && (
                          <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
                          >
                            <History className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Version History ({selectedPage?.versions?.length || 1})</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {!isEditing && selectedPage && (
                          <>
                            <button
                              onClick={() => setIsEditing(true)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 flex items-center space-x-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Content</span>
                            </button>
                            {selectedPage.status !== 'published' && (
                              <button
                                onClick={handlePublish}
                                disabled={saving}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Publish Live</span>
                              </button>
                            )}
                          </>
                        )}

                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditing(false);
                              if (isCreating && pages.length > 0) setSelectedPage(pages[0]);
                            }}
                            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Version History Drawer */}
                    {showHistory && selectedPage?.versions && (
                      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold uppercase text-cyan-400 flex items-center gap-1.5">
                          <History className="w-4 h-4" /> Version Snapshot Timeline
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedPage.versions.map(v => (
                            <div
                              key={v.id}
                              className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-mono font-bold text-white">Version {v.version_number}</span>
                                <span className="text-slate-400 ml-2 text-[11px]">
                                  {new Date(v.created_at).toLocaleString()}
                                </span>
                                {v.change_summary && (
                                  <p className="text-[11px] text-slate-400 italic mt-0.5">{v.change_summary}</p>
                                )}
                              </div>
                              {v.version_number !== selectedPage.current_version && (
                                <button
                                  onClick={() => handleRollback(v.version_number)}
                                  className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded text-xs font-semibold flex items-center space-x-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Rollback</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Form or Read View */}
                    {isEditing ? (
                      <form onSubmit={handleSavePage} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Page Title</label>
                            <input
                              type="text"
                              required
                              value={title}
                              onChange={e => setTitle(e.target.value)}
                              placeholder="e.g. Evidence Quality Guidelines"
                              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">URL Slug</label>
                            <input
                              type="text"
                              required
                              disabled={!isCreating}
                              value={slug}
                              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                              placeholder="e.g. evidence-guidelines"
                              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Executive Summary</label>
                          <input
                            type="text"
                            value={summary}
                            onChange={e => setSummary(e.target.value)}
                            placeholder="Brief summary displayed at the top of the page..."
                            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Markdown Body Content</label>
                          <textarea
                            rows={12}
                            required
                            value={bodyMarkdown}
                            onChange={e => setBodyMarkdown(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500 resize-y"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Revision Changelog Note</label>
                          <input
                            type="text"
                            value={changeSummary}
                            onChange={e => setChangeSummary(e.target.value)}
                            placeholder="e.g. Updated section 3 with new forensic guidelines"
                            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
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
                            <span>{saving ? 'Saving...' : 'Save Draft Snapshot'}</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-xl font-bold text-white">{selectedPage?.title}</h2>
                          <div className="text-xs font-mono text-cyan-400 mt-0.5">/{selectedPage?.slug}</div>
                          {selectedPage?.summary && (
                            <p className="text-xs text-slate-300 mt-2 italic">{selectedPage.summary}</p>
                          )}
                        </div>

                        <div className="p-6 bg-slate-950 border border-slate-800/80 rounded-xl">
                          <div className="prose prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap font-sans">
                            {selectedPage?.body_markdown}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center text-slate-400">
                    Select a CMS page from the left or create a new page.
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
