import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle, BookOpen, Video, FileQuestion, Search,
  Sparkles, ExternalLink, ChevronDown, ChevronUp, ArrowLeft
} from 'lucide-react';
import { helpApi } from '../services/api';
import { FAQItem, KnowledgeArticle, VideoTutorial } from '../types';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { TourOverlay } from '../components/TourOverlay';

export const HelpPage: React.FC = () => {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [videos, setVideos] = useState<VideoTutorial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  useEffect(() => {
    helpApi.getFAQ().then(setFaqs).catch(() => {});
    helpApi.getArticles().then(setArticles).catch(() => {});
    helpApi.getVideos().then(setVideos).catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  const filteredFaqs = faqs.filter(
    (f) =>
      (selectedCategory === 'all' || f.category.toLowerCase() === selectedCategory.toLowerCase()) &&
      (f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 shadow-2xl relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-xs font-mono text-cyan-400">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>TRACE-X Investigator Help & Knowledge Center</span>
              </div>

              <button
                onClick={() => setTourOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-600/30 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Launch Interactive Tour</span>
              </button>
            </div>

            <h1 className="text-2xl font-extrabold text-slate-100">
              Guidance, Cryptographic Integrity Manuals & FAQs
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Explore operational documentation for evidence quality scoring, Heuer ACH competing hypotheses, Value-of-Information (VoI) prioritization, and court-ready SHA-256 chain of custody.
            </p>
          </div>

          {/* Search & Categories Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search FAQs, scoring formulas, or workflows..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center space-x-1 overflow-x-auto text-xs">
              {['all', 'Chain-of-Custody', 'Investigation & Graph', 'Hypotheses', 'Admin & Security'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Knowledge Base Articles Grid */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>Core Documentation & Technical Handbooks</span>
            </h2>

            {selectedArticle ? (
              <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold text-xs flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to All Articles</span>
                </button>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-cyan-400">{selectedArticle.category} • {selectedArticle.reading_time}</span>
                  <h3 className="text-xl font-bold text-slate-100">{selectedArticle.title}</h3>
                </div>

                <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed border-t border-slate-800 pt-4">
                  {selectedArticle.content_markdown}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {articles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => setSelectedArticle(art)}
                    className="p-5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl cursor-pointer transition-all space-y-2 shadow-lg"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400">
                      <span>{art.category}</span>
                      <span>{art.reading_time}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-200">{art.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{art.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Frequently Asked Questions */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <FileQuestion className="w-4 h-4 text-emerald-400" />
              <span>Frequently Asked Questions ({filteredFaqs.length})</span>
            </h2>

            <div className="space-y-2.5">
              {filteredFaqs.map((faq) => {
                const isExpanded = expandedFaq === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden text-xs transition-all shadow"
                  >
                    <button
                      onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                      className="w-full p-4 flex items-center justify-between text-left font-semibold text-slate-200 hover:text-cyan-400"
                    >
                      <span className="text-sm">{faq.question}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-cyan-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="p-4 pt-0 text-slate-300 text-xs leading-relaxed border-t border-slate-800/80 space-y-2">
                        <p>{faq.answer}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {faq.tags.map((t) => (
                            <span key={t} className="px-2 py-0.5 bg-slate-950 text-slate-500 rounded-md font-mono text-[10px]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Video Tutorials Grid */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Video className="w-4 h-4 text-purple-400" />
              <span>Video Demonstrations & Walkthroughs</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((vid) => (
                <div key={vid.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2.5 text-xs shadow">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 truncate">{vid.title}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{vid.duration}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">{vid.description}</p>
                  <div className="pt-1">
                    <a
                      href={vid.embed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1.5 text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      <span>Watch Tutorial</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <TourOverlay isOpen={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
};
