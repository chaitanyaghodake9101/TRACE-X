import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  User, Phone, Car, MapPin, Building, Calendar, FileText, Upload,
  Sparkles, FileUp, FileCode, Layers, Sliders, Database, Search, ShieldCheck,
  Crown, AlertTriangle, X, Table, FlaskConical, Activity, Clock, GitCompare
} from 'lucide-react';
import { graphApi, casesApi, evidenceApi, entitiesApi, hypothesesApi } from '../services/api';
import { Case, EvidenceSourceType, KeyInfluencer, PatternAlert, Evidence, Hypothesis } from '../types';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { EvidenceQualityLegend } from '../components/EvidenceQualityLegend';
import { CustodyTimelineModal } from '../components/CustodyTimelineModal';
import { HelpWidget } from '../components/HelpWidget';
import { CounterfactualSandboxDrawer } from '../components/investigation-intelligence/CounterfactualSandboxDrawer';
import { NetworkResilienceModal } from '../components/investigation-intelligence/NetworkResilienceModal';
import { ReviewPriorityQueueDrawer } from '../components/investigation-intelligence/ReviewPriorityQueueDrawer';
import { DisagreementPanel } from '../components/investigation-intelligence/DisagreementPanel';


// Custom Node for Graph Entities & Quality-Scored Evidence
const CustomGraphNode = ({ data }: any) => {
  const isEvidence = data.type === 'evidence';
  const score = data.quality_score ?? null;

  let borderColor = 'border-slate-700 hover:border-slate-500';
  let badgeBg = 'bg-slate-800 text-slate-300 border-slate-700';
  
  if (isEvidence && score !== null) {
    if (score >= 0.70) {
      borderColor = 'border-emerald-500/80 shadow-lg shadow-emerald-500/20';
      badgeBg = 'bg-emerald-950 text-emerald-300 border-emerald-700';
    } else if (score >= 0.40) {
      borderColor = 'border-amber-500/80 shadow-lg shadow-amber-500/20';
      badgeBg = 'bg-amber-950 text-amber-300 border-amber-700';
    } else {
      borderColor = 'border-rose-500/80 shadow-lg shadow-rose-500/20';
      badgeBg = 'bg-rose-950 text-rose-300 border-rose-700';
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-3.5 h-3.5 text-cyan-400" />;
      case 'phone': return <Phone className="w-3.5 h-3.5 text-teal-400" />;
      case 'vehicle': return <Car className="w-3.5 h-3.5 text-purple-400" />;
      case 'location': return <MapPin className="w-3.5 h-3.5 text-rose-400" />;
      case 'organization': return <Building className="w-3.5 h-3.5 text-blue-400" />;
      case 'event': return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      default: return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <div className={`px-3.5 py-2.5 bg-slate-900/95 backdrop-blur-md rounded-xl border-2 ${borderColor} shadow-2xl min-w-[160px] max-w-[220px] text-left transition-all hover:scale-105 cursor-pointer`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-500 !w-2 !h-2" />
      
      <div className="flex items-center justify-between space-x-2 mb-1.5">
        <div className="flex items-center space-x-1.5 truncate">
          <div className="p-1 rounded bg-slate-800">
            {getIcon(data.type)}
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 truncate">{data.type}</span>
        </div>

        {score !== null && (
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${badgeBg}`}>
            {(score * 100).toFixed(0)}%
          </span>
        )}
      </div>

      <div className="text-xs font-semibold text-slate-100 truncate" title={data.label}>
        {data.label}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !w-2 !h-2" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomGraphNode,
};

export const GraphWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [graphStats, setGraphStats] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Key Influencers & Pattern Alerts states
  const [influencers, setInfluencers] = useState<KeyInfluencer[]>([]);
  const [patterns, setPatterns] = useState<PatternAlert[]>([]);
  const [showInfluencersModal, setShowInfluencersModal] = useState(false);
  const [showPatternsModal, setShowPatternsModal] = useState(false);

  // Investigation Intelligence Suite States
  const [showSandbox, setShowSandbox] = useState(false);
  const [showResilience, setShowResilience] = useState(false);
  const [showPriorityQueue, setShowPriorityQueue] = useState(false);
  const [showDisagreements, setShowDisagreements] = useState(false);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [hypothesesList, setHypothesesList] = useState<Hypothesis[]>([]);

  // Filters
  const [qualityThreshold, setQualityThreshold] = useState<number>(0);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [nodeSearch, setNodeSearch] = useState<string>('');

  // Ingestion Modal States
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [ingestMode, setIngestMode] = useState<'file' | 'text' | 'cdr_csv' | 'financial_csv'>('file');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [sourceType, setSourceType] = useState<EvidenceSourceType>('fir');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Custody Modal State
  const [custodyModalOpen, setCustodyModalOpen] = useState(false);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string>('');

  const user = JSON.parse(localStorage.getItem('tracex_user') || 'null');

  const loadGraphData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [caseRes, graphRes, statsRes, infRes, patRes, evListRes, hypListRes] = await Promise.all([
        casesApi.get(id),
        graphApi.getCaseGraph(id, qualityThreshold > 0 ? qualityThreshold / 100 : undefined),
        graphApi.getGraphStats(id),
        graphApi.getKeyInfluencers(id).catch(() => ({ influencers: [] })),
        graphApi.getPatterns(id).catch(() => ({ patterns: [] })),
        evidenceApi.listByCase(id).catch(() => []),
        hypothesesApi.listByCase(id).catch(() => [])
      ]);
      setCaseData(caseRes);
      setGraphStats(statsRes);
      setInfluencers(infRes.influencers || []);
      setPatterns(patRes.patterns || []);
      setEvidenceList(evListRes || []);
      setHypothesesList(hypListRes || []);

      // Filter nodes based on selected type
      let rawNodes = graphRes.nodes;
      if (selectedTypeFilter !== 'all') {
        rawNodes = rawNodes.filter((n: any) => n.type === selectedTypeFilter);
      }
      if (nodeSearch.trim()) {
        const query = nodeSearch.toLowerCase();
        rawNodes = rawNodes.filter((n: any) => n.label.toLowerCase().includes(query) || n.type.toLowerCase().includes(query));
      }

      const activeNodeIds = new Set(rawNodes.map((n: any) => n.id));

      // Auto-layout in dynamic multi-ring topology
      const flowNodes = rawNodes.map((node: any, index: number) => {
        const angle = (index / Math.max(1, rawNodes.length)) * 2 * Math.PI;
        const ring = node.type === 'evidence' ? 340 : 200 + (index % 3) * 50;
        const x = 500 + ring * Math.cos(angle);
        const y = 350 + ring * Math.sin(angle);

        return {
          id: node.id,
          type: 'custom',
          position: { x, y },
          data: { ...node },
        };
      });

      const flowEdges = graphRes.edges
        .filter((edge: any) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target))
        .map((edge: any) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          animated: edge.label === 'TRANSFERRED_TO' || edge.label === 'CALLS',
          style: { stroke: edge.label === 'MENTIONED_IN' ? '#0d9488' : '#64748b', strokeWidth: 1.5 },
          labelStyle: { fill: '#94a3b8', fontSize: 9, fontFamily: 'monospace', fontWeight: 600 },
          labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edge.label === 'MENTIONED_IN' ? '#0d9488' : '#64748b',
          },
        }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      console.error('Failed to load graph', err);
    } finally {
      setLoading(false);
    }
  }, [id, qualityThreshold, selectedTypeFilter, nodeSearch, setNodes, setEdges]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  const onNodeClick = (_: any, node: any) => {
    setSelectedNode(node.data);
  };

  const handleSyncNeo4j = async () => {
    if (!id) return;
    try {
      setIsSyncing(true);
      const res = await graphApi.syncCaseGraph(id);
      setSyncStatus(res.status === 'synchronized' ? 'Neo4j Synchronized' : 'In-Memory Fallback Active');
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err) {
      setSyncStatus('Sync Failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAutoResolve = async () => {
    if (!id) return;
    try {
      const res = await entitiesApi.autoResolve(id, 0.85);
      alert(`Auto-Resolution Complete: ${res.resolved_pairs_count} duplicate entity pairs consolidated.`);
      await loadGraphData();
    } catch (err) {
      console.error('Auto resolve failed', err);
    }
  };

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setIsUploading(true);
      if (ingestMode === 'cdr_csv' && selectedFile) {
        const formData = new FormData();
        formData.append('title', evidenceTitle || 'Structured CDR Dump');
        formData.append('file', selectedFile);
        await evidenceApi.uploadCDR(id, formData);
      } else if (ingestMode === 'financial_csv' && selectedFile) {
        const formData = new FormData();
        formData.append('title', evidenceTitle || 'Structured Financial Ledger');
        formData.append('file', selectedFile);
        await evidenceApi.uploadFinancial(id, formData);
      } else if (ingestMode === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('title', evidenceTitle);
        formData.append('source_type', sourceType);
        formData.append('description', 'Ingested via document parser');
        formData.append('file', selectedFile);
        await evidenceApi.uploadFile(id, formData);
      } else {
        await evidenceApi.create(id, {
          title: evidenceTitle,
          source_type: sourceType,
          extracted_text: evidenceText,
          description: 'Uploaded via graph canvas raw input',
        });
      }
      setUploadModalOpen(false);
      setEvidenceTitle('');
      setEvidenceText('');
      setSelectedFile(null);
      await loadGraphData();
    } catch (err) {
      console.error('Evidence upload failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracex_token');
    localStorage.removeItem('tracex_refresh_token');
    localStorage.removeItem('tracex_user');
    navigate('/login');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 relative flex flex-col">
          {/* Top Bar with Case Info & Metrics */}
          <div className="h-14 bg-slate-900/90 border-b border-slate-800 px-6 flex items-center justify-between z-10">
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-slate-100 text-sm">{caseData?.title || 'Investigation Graph'}</span>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                {caseData?.case_number}
              </span>
              {graphStats && (
                <span className="hidden lg:inline-block text-[11px] font-mono text-slate-400">
                  ({graphStats.node_count ?? nodes.length} nodes • {graphStats.edge_count ?? edges.length} relations)
                </span>
              )}
            </div>

            {/* Metrics Chips & Actions */}
            <div className="flex items-center space-x-2 text-xs flex-wrap gap-y-1">
              {influencers.length > 0 && (
                <button
                  onClick={() => setShowInfluencersModal(true)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/80 rounded-lg text-xs font-semibold transition-colors"
                  title="Ranked Key Influencers & PageRank Centrality"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Influencers ({influencers.length})</span>
                </button>
              )}

              {patterns.length > 0 && (
                <button
                  onClick={() => setShowPatternsModal(true)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 rounded-lg text-xs font-semibold transition-colors animate-pulse"
                  title="Suspicious Communication Bursts & Financial Remittance Anomaly Alerts"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Alerts ({patterns.length})</span>
                </button>
              )}

              {/* Intelligence Suite Triggers */}
              <button
                onClick={() => setShowSandbox(true)}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/80 rounded-lg text-xs font-semibold transition-colors"
                title="Counterfactual Investigation Sandbox (What-If simulation & overrides)"
              >
                <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
                <span>What-If Sandbox</span>
              </button>

              <button
                onClick={() => setShowResilience(true)}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 rounded-lg text-xs font-semibold transition-colors"
                title="Network Resilience & Stress-Testing Analyzer (Single Points of Failure & Centrality Shift)"
              >
                <Activity className="w-3.5 h-3.5 text-rose-400" />
                <span>Resilience</span>
              </button>

              <button
                onClick={() => setShowPriorityQueue(true)}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 rounded-lg text-xs font-semibold transition-colors"
                title="Evidence Decay & Priority Review Queue"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Review Queue</span>
              </button>

              <button
                onClick={() => setShowDisagreements(true)}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/80 rounded-lg text-xs font-semibold transition-colors"
                title="AI Disagreements & Minority-Evidence Panel"
              >
                <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
                <span>Disagreements</span>
              </button>

              <button
                onClick={handleAutoResolve}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                title="Consolidate duplicate entities via Block 6 fuzzy matching"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Auto-Resolve</span>
              </button>

              <button
                onClick={handleSyncNeo4j}
                disabled={isSyncing}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                <Database className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
                <span>{syncStatus || (isSyncing ? 'Syncing...' : 'Neo4j')}</span>
              </button>

              <button
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-600/20 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Ingest</span>
              </button>
            </div>
          </div>

          {/* Interactive Graph Filter Bar */}
          <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
            {/* Entity Type Selector */}
            <div className="flex items-center space-x-1 overflow-x-auto">
              <span className="text-slate-500 font-semibold uppercase text-[10px] mr-1">Types:</span>
              {['all', 'person', 'phone', 'vehicle', 'location', 'organization', 'event', 'evidence'].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    selectedTypeFilter === t
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Quality Score Slider & Search */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-slate-400">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Min Quality: <strong className="text-slate-200 font-mono">{qualityThreshold}%</strong></span>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="10"
                  value={qualityThreshold}
                  onChange={(e) => setQualityThreshold(Number(e.target.value))}
                  className="w-24 accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1.5" />
                <input
                  type="text"
                  value={nodeSearch}
                  onChange={(e) => setNodeSearch(e.target.value)}
                  placeholder="Filter nodes..."
                  className="pl-7 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36"
                />
              </div>
            </div>
          </div>

          {/* Flow Graph Canvas */}
          <div className="flex-1 relative bg-slate-950">
            {nodes.length === 0 && !loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-3 z-10">
                <Sparkles className="w-10 h-10 text-cyan-400" />
                <p className="text-sm font-medium text-slate-300">No nodes match current filters</p>
                <p className="text-xs max-w-sm text-center">
                  Adjust the quality threshold or entity type filters, or ingest new synthetic FIRs and CDR documents.
                </p>
              </div>
            ) : null}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              className="bg-slate-950"
            >
              <Background color="#1e293b" gap={20} size={1} />
              <Controls className="!bg-slate-900 !border-slate-800 !text-slate-300" />
            </ReactFlow>

            <EvidenceQualityLegend />

            {/* Selected Node Inspector Drawer */}
            {selectedNode && (
              <div className="absolute top-4 right-4 z-20 w-84 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-xs uppercase font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                      {selectedNode.type}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-100 truncate" title={selectedNode.label}>
                      {selectedNode.label}
                    </h4>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-200 text-xs px-1">✕</button>
                </div>

                {selectedNode.type === 'evidence' ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">Overall Quality Score</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {((selectedNode.quality_score ?? 0.5) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full"
                          style={{ width: `${(selectedNode.quality_score ?? 0.5) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-slate-300">4-Dimensional Scoring Breakdown</p>
                      <div className="flex justify-between text-slate-400">
                        <span>Source Reliability (35%):</span>
                        <span className="font-mono text-slate-200">{((selectedNode.properties.reliability ?? 0.8) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Temporal Freshness (20%):</span>
                        <span className="font-mono text-slate-200">{((selectedNode.properties.freshness ?? 0.6) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Cross Corroboration (30%):</span>
                        <span className="font-mono text-slate-200">{((selectedNode.properties.corroboration ?? 0.5) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Data Completeness (15%):</span>
                        <span className="font-mono text-slate-200">{((selectedNode.properties.completeness ?? 0.7) * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setActiveEvidenceId(selectedNode.id);
                          setCustodyModalOpen(true);
                        }}
                        className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 font-semibold text-xs rounded-xl border border-slate-700 transition-all shadow"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Chain of Custody & SHA-256</span>
                      </button>
                    </div>

                    {selectedNode.properties.detected_phone_numbers && (
                      <div className="space-y-1 text-xs">
                        <span className="text-slate-400">Detected Phone Numbers:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedNode.properties.detected_phone_numbers.map((ph: string) => (
                            <span key={ph} className="font-mono text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-teal-300">{ph}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Extraction Confidence:</span>
                        <span className="font-mono font-bold text-cyan-400">{((selectedNode.quality_score ?? 1.0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Canonical: <strong className="text-slate-200">{selectedNode.properties.canonical_name || selectedNode.label}</strong>
                      </div>
                    </div>

                    {selectedNode.properties.alias_names && selectedNode.properties.alias_names.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-300">Resolved Aliases</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedNode.properties.alias_names.map((alias: string) => (
                            <span key={alias} className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">{alias}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="font-semibold text-slate-300">Attributes JSON</p>
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-300 max-h-40 overflow-y-auto">
                        {JSON.stringify(selectedNode.properties, null, 2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Key Influencers Modal Drawer */}
      {showInfluencersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5 text-amber-400">
                <Crown className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-100">Key Influencer Identification (PageRank Centrality)</h3>
              </div>
              <button onClick={() => setShowInfluencersModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Entities ranked by algorithmic network centrality, degree volume, and connection significance across the multi-source evidence graph.
            </p>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="p-3">Rank / Entity</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Connections</th>
                    <th className="p-3">Centrality Score</th>
                    <th className="p-3">Significance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {influencers.map((inf, idx) => (
                    <tr key={inf.entity_id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-200 flex items-center space-x-2">
                        <span className="font-mono text-cyan-400 text-xs">#{idx + 1}</span>
                        <span>{inf.canonical_name || inf.name}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-950 rounded text-[10px] uppercase font-mono text-slate-300 border border-slate-800">
                          {inf.entity_type}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {inf.total_connections} (In: {inf.in_degree}, Out: {inf.out_degree})
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-400">
                        {inf.importance_score.toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                          {inf.rank_label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowInfluencersModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pattern Alerts Modal */}
      {showPatternsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-100">Automated Crime Pattern & Anomaly Alerts</h3>
              </div>
              <button onClick={() => setShowPatternsModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {patterns.map((pat) => (
                <div key={pat.id} className="p-4 bg-slate-950 border border-amber-500/30 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 text-sm">{pat.title}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-950 text-amber-400 rounded border border-amber-800 font-bold">
                      {pat.severity}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{pat.description}</p>
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-cyan-300">
                    <strong>Investigative Recommendation:</strong> {pat.recommendation}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowPatternsModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Evidence Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">Ingest Investigation Evidence</h3>
            
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setIngestMode('file')}
                className={`py-1.5 font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  ingestMode === 'file' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Document File</span>
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('text')}
                className={`py-1.5 font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  ingestMode === 'text' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Paste Text</span>
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('cdr_csv')}
                className={`py-1.5 font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  ingestMode === 'cdr_csv' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>CDR CSV Dump</span>
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('financial_csv')}
                className={`py-1.5 font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  ingestMode === 'financial_csv' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Financial CSV</span>
              </button>
            </div>

            <form onSubmit={handleUploadEvidence} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Evidence Title</label>
                <input
                  type="text"
                  required
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  placeholder={
                    ingestMode === 'cdr_csv'
                      ? 'e.g. Tower B4 Call Detail Records Dump'
                      : ingestMode === 'financial_csv'
                      ? 'e.g. Bank RTGS Remittance Ledger'
                      : 'e.g. FIR / Witness Statement / CCTV Log'
                  }
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {ingestMode === 'file' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Source Category (Base Reliability)</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as EvidenceSourceType)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="fir">FIR (First Information Report) - 90% Reliability</option>
                    <option value="cdr">CDR (Call Detail Record) - 85% Reliability</option>
                    <option value="financial_records">Financial Records / Bank Audit - 80% Reliability</option>
                    <option value="cctv">CCTV Camera Footage - 75% Reliability</option>
                    <option value="witness_statement">Witness Statement - 50% Reliability</option>
                    <option value="anonymous_tip">Anonymous Tip - 20% Reliability</option>
                  </select>
                </div>
              )}

              {ingestMode === 'text' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Document Text Extract</label>
                  <textarea
                    rows={4}
                    required
                    value={evidenceText}
                    onChange={(e) => setEvidenceText(e.target.value)}
                    placeholder="Paste synthetic FIR content, CDR transcript, or transaction log..."
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-500 resize-none font-mono text-xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Select File (.csv, .txt, .json, .pdf)</label>
                  <input
                    type="file"
                    required
                    accept=".csv,.txt,.json,.pdf,.log"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-cyan-400 hover:file:bg-slate-700 bg-slate-950 p-2 border border-slate-800 rounded-lg"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-600/30 disabled:opacity-50"
                >
                  {isUploading ? 'Parsing & Scoring...' : 'Score & Ingest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custody Timeline Modal */}
      <CustodyTimelineModal
        evidenceId={activeEvidenceId}
        isOpen={custodyModalOpen}
        onClose={() => setCustodyModalOpen(false)}
        onStatusChanged={loadGraphData}
      />

      {/* Investigation Intelligence Modules */}
      <CounterfactualSandboxDrawer
        caseId={id || ''}
        isOpen={showSandbox}
        onClose={() => setShowSandbox(false)}
        evidenceList={evidenceList}
        hypothesesList={hypothesesList}
      />

      <NetworkResilienceModal
        caseId={id || ''}
        isOpen={showResilience}
        onClose={() => setShowResilience(false)}
      />

      <ReviewPriorityQueueDrawer
        caseId={id || ''}
        isOpen={showPriorityQueue}
        onClose={() => setShowPriorityQueue(false)}
      />

      <DisagreementPanel
        caseId={id || ''}
        isOpen={showDisagreements}
        onClose={() => setShowDisagreements(false)}
      />

      {/* Global Floating Help Center Widget */}
      <HelpWidget />
    </div>
  );
};
