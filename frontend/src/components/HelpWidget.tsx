import React, { useState, useEffect } from 'react';
import {
  HelpCircle, X, Search, BookOpen, Video, FileQuestion,
  ChevronDown, ChevronUp, Sparkles, ExternalLink
} from 'lucide-react';
import { helpApi } from '../services/api';
import { FAQItem, KnowledgeArticle, VideoTutorial } from '../types';
import { TourOverlay } from './TourOverlay';

export const HelpWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'faq' | 'articles' | 'videos'>('faq');
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [videos, setVideos] = useState<VideoTutorial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  useEffect(() => {
    if (isOpen) {
      helpApi.getFAQ().then(setFaqs).catch(() => {});
      helpApi.getArticles().then(setArticles).catch(() => {});
      helpApi.getVideos().then(setVideos).catch(() => {});
    }
  }, [isOpen]);

  const filteredFaqs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-2xl shadow-cyan-500/40 transition-all hover:scale-110 flex items-center justify-center group"
        title="Open TRACE-X Help Center & FAQs"
      >
        <HelpCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
      </button>

      {/* Help Center Drawer / Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">TRACE-X Help & Knowledge Center</h3>
                  <p className="text-[11px] text-slate-400">SIH26189 Investigator Reference Guide</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setTourOpen(true);
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Restart Tour</span>
                </button>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-slate-950 p-1 border-b border-slate-800 text-xs">
              <button
                onClick={() => { setActiveTab('faq'); setSelectedArticle(null); }}
                className={`flex-1 py-1.5 font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'faq' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileQuestion className="w-3.5 h-3.5" />
                <span>FAQs</span>
              </button>
              <button
                onClick={() => { setActiveTab('articles'); setSelectedArticle(null); }}
                className={`flex-1 py-1.5 font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'articles' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Knowledge Base</span>
              </button>
              <button
                onClick={() => { setActiveTab('videos'); setSelectedArticle(null); }}
                className={`flex-1 py-1.5 font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'videos' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Tutorials</span>
              </button>
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Tab 1: FAQs */}
              {activeTab === 'faq' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search questions (e.g. SHA-256, Heuer ACH, VoI)..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="space-y-2">
                    {filteredFaqs.map((faq) => {
                      const isExpanded = expandedFaq === faq.id;
                      return (
                        <div
                          key={faq.id}
                          className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden text-xs transition-all"
                        >
                          <button
                            onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                            className="w-full p-3 flex items-center justify-between text-left font-semibold text-slate-200 hover:text-cyan-400"
                          >
                            <span>{faq.question}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0 text-cyan-400" /> : <ChevronDown className="w-4 h-4 shrink-0 text-slate-500" />}
                          </button>

                          {isExpanded && (
                            <div className="p-3 pt-0 text-slate-400 text-[11px] leading-relaxed border-t border-slate-900">
                              <p>{faq.answer}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {faq.tags.map((t) => (
                                  <span key={t} className="px-1.5 py-0.5 bg-slate-900 text-slate-500 rounded font-mono text-[9px]">
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
              )}

              {/* Tab 2: Knowledge Base Articles */}
              {activeTab === 'articles' && (
                <div>
                  {selectedArticle ? (
                    <div className="space-y-3 text-xs">
                      <button
                        onClick={() => setSelectedArticle(null)}
                        className="text-cyan-400 hover:text-cyan-300 font-semibold text-[11px] flex items-center space-x-1"
                      >
                        <span>← Back to Articles</span>
                      </button>
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                        <span className="text-[10px] uppercase font-mono text-cyan-400">{selectedArticle.category} • {selectedArticle.reading_time}</span>
                        <h4 className="text-base font-bold text-slate-100">{selectedArticle.title}</h4>
                        <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans mt-2">
                          {selectedArticle.content_markdown}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {articles.map((art) => (
                        <div
                          key={art.id}
                          onClick={() => setSelectedArticle(art)}
                          className="p-3.5 bg-slate-950/70 hover:bg-slate-950 border border-slate-800 rounded-xl cursor-pointer transition-all hover:border-cyan-500/50 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400">
                            <span>{art.category}</span>
                            <span>{art.reading_time}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-200">{art.title}</h4>
                          <p className="text-[11px] text-slate-400 line-clamp-2">{art.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Video Tutorials */}
              {activeTab === 'videos' && (
                <div className="space-y-3 text-xs">
                  {videos.map((vid) => (
                    <div key={vid.id} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{vid.title}</span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{vid.duration}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{vid.description}</p>
                      <div className="pt-1">
                        <a
                          href={vid.embed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                        >
                          <span>Watch Video Tutorial</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-center text-[10px] text-slate-500 font-mono">
              TRACE-X • Problem Statement SIH26189
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Tour Overlay */}
      <TourOverlay isOpen={tourOpen} onClose={() => setTourOpen(false)} />
    </>
  );
};
