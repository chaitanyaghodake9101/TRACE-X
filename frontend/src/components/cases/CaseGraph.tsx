import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Users,
  Car,
  Building2,
  MapPin,
  Phone,
  Calendar,
  FileCheck2,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  X,
  Shield,
  Layers,
  ExternalLink
} from 'lucide-react';
import { casesApi } from '../../services/api';
import { GraphData, GraphNode, GraphEdge } from '../../types';
import { getCaseEntities } from '../../data/demoCaseEntities';
import { useTheme } from '../../context/ThemeContext';
import { useRealtime } from '../../hooks/useRealtime';

interface CaseGraphProps {
  caseId: string;
  onNavigateToEvidence?: (evidenceId: string) => void;
  onNavigateToHypotheses?: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  person: { label: 'Person of Interest', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: '#0891b2', icon: Users },
  phone: { label: 'Phone / IMEI', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)', border: '#0d9488', icon: Phone },
  vehicle: { label: 'Vehicle', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#d97706', icon: Car },
  location: { label: 'Location / Scene', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: '#e11d48', icon: MapPin },
  organization: { label: 'Organization', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)', border: '#6366f1', icon: Building2 },
  event: { label: 'Incident / Event', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: '#0284c7', icon: Calendar },
  evidence: { label: 'Source Evidence', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '#059669', icon: FileCheck2 },
  other: { label: 'Other Asset', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#64748b', icon: Layers },
};

export const CaseGraph: React.FC<CaseGraphProps> = ({ caseId, onNavigateToEvidence }) => {
  const { isDark } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minQuality, setMinQuality] = useState<number>(0);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Pan & Zoom Transform State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<any | null>(null);

  // Real-time updates subscription
  const { isConnected } = useRealtime(caseId, (event) => {
    if (event.resource_type === 'case' || event.resource_type === 'evidence' || event.resource_type === 'entity') {
      loadGraphData();
    }
  });

  const loadGraphData = async () => {
    try {
      setLoading(true);
      const data = await casesApi.getGraph(caseId);
      if (data && data.nodes && data.nodes.length > 0) {
        setGraphData(data);
      } else {
        // Fallback synthetic graph from demo entities for instant visualization
        const synthetic = generateSyntheticGraph(caseId);
        setGraphData(synthetic);
      }
    } catch (err) {
      console.warn('Backend graph endpoint fallback to synthetic demo graph:', err);
      const synthetic = generateSyntheticGraph(caseId);
      setGraphData(synthetic);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraphData();
  }, [caseId]);

  // Synthetic Graph Generator for rich interactive experience
  function generateSyntheticGraph(cid: string): GraphData {
    const bundle = getCaseEntities(cid);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Evidence Nodes
    const ev1Id = `evidence_${cid}_01`;
    const ev2Id = `evidence_${cid}_02`;
    nodes.push({
      id: ev1Id,
      label: 'FIR First Information & Seizure Report',
      type: 'evidence',
      quality_score: 0.94,
      linked_evidence_ids: [ev1Id],
      linked_evidence_titles: ['FIR First Information & Seizure Report'],
      properties: {
        source_type: 'fir',
        sha256_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        integrity_status: 'verified'
      }
    });

    nodes.push({
      id: ev2Id,
      label: 'Telecom CDR Intercept Matrix & Tower Log',
      type: 'evidence',
      quality_score: 0.88,
      linked_evidence_ids: [ev2Id],
      linked_evidence_titles: ['Telecom CDR Intercept Matrix & Tower Log'],
      properties: {
        source_type: 'cdr',
        sha256_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        integrity_status: 'verified'
      }
    });

    // People Nodes
    bundle.people.forEach((p) => {
      nodes.push({
        id: p.id,
        label: p.name,
        type: 'person',
        quality_score: p.risk_level === 'critical' ? 0.95 : p.risk_level === 'high' ? 0.85 : 0.70,
        linked_evidence_ids: [ev1Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report'],
        properties: {
          role: p.role,
          risk_level: p.risk_level,
          alias: p.alias || '',
          notes: p.notes
        }
      });
      edges.push({
        id: `ev_link_${ev1Id}_${p.id}`,
        source: ev1Id,
        target: p.id,
        label: 'MENTIONED_IN',
        weight: 0.9,
        confidence: 0.95,
        linked_evidence_ids: [ev1Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report'],
        properties: { mention_context: 'Named as prime person of interest in FIR' }
      });
    });

    // Vehicle Nodes
    bundle.vehicles.forEach((v) => {
      nodes.push({
        id: v.id,
        label: `${v.registration_number} (${v.make_model})`,
        type: 'vehicle',
        quality_score: 0.85,
        linked_evidence_ids: [ev1Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report'],
        properties: { ...v }
      });
      if (bundle.people[0]) {
        edges.push({
          id: `rel_owns_${bundle.people[0].id}_${v.id}`,
          source: bundle.people[0].id,
          target: v.id,
          label: 'OWNS',
          weight: 0.95,
          confidence: 0.98,
          linked_evidence_ids: [ev1Id],
          linked_evidence_titles: ['FIR First Information & Seizure Report'],
          properties: { registered_owner: v.registered_owner }
        });
      }
    });

    // Organization Nodes
    bundle.organizations.forEach((o) => {
      nodes.push({
        id: o.id,
        label: o.name,
        type: 'organization',
        quality_score: 0.80,
        linked_evidence_ids: [ev1Id, ev2Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report', 'Telecom CDR Intercept Matrix & Tower Log'],
        properties: { ...o }
      });
      if (bundle.people[0]) {
        edges.push({
          id: `rel_dir_${bundle.people[0].id}_${o.id}`,
          source: bundle.people[0].id,
          target: o.id,
          label: 'DIRECTOR_OF',
          weight: 0.9,
          confidence: 0.92,
          linked_evidence_ids: [ev1Id],
          linked_evidence_titles: ['FIR First Information & Seizure Report'],
          properties: { role: 'Beneficial Owner / Directorship' }
        });
      }
    });

    // Phone Nodes
    bundle.phone_numbers.forEach((ph) => {
      nodes.push({
        id: ph.id,
        label: ph.phone_number,
        type: 'phone',
        quality_score: 0.92,
        linked_evidence_ids: [ev2Id],
        linked_evidence_titles: ['Telecom CDR Intercept Matrix & Tower Log'],
        properties: { ...ph }
      });
      if (bundle.people[0]) {
        edges.push({
          id: `rel_calls_${bundle.people[0].id}_${ph.id}`,
          source: bundle.people[0].id,
          target: ph.id,
          label: 'COMMUNICATED_WITH',
          weight: 0.95,
          confidence: 0.96,
          linked_evidence_ids: [ev2Id],
          linked_evidence_titles: ['Telecom CDR Intercept Matrix & Tower Log'],
          properties: { call_count: 142 }
        });
      }
    });

    // Location Nodes
    bundle.locations.forEach((loc) => {
      nodes.push({
        id: loc.id,
        label: loc.address,
        type: 'location',
        quality_score: 0.78,
        linked_evidence_ids: [ev1Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report'],
        properties: { ...loc }
      });
      if (bundle.people[0]) {
        edges.push({
          id: `rel_vis_${bundle.people[0].id}_${loc.id}`,
          source: bundle.people[0].id,
          target: loc.id,
          label: 'VISITED',
          weight: 0.85,
          confidence: 0.88,
          linked_evidence_ids: [ev1Id],
          linked_evidence_titles: ['FIR First Information & Seizure Report'],
          properties: { timestamp: '2026-08-24T23:15:00Z' }
        });
      }
    });

    return { nodes, edges };
  }

  // Filtered nodes and edges
  const filteredNodes = useMemo(() => {
    return graphData.nodes.filter((node) => {
      const matchesType = selectedType === 'all' || node.type === selectedType;
      const matchesScore = (node.quality_score || 0) >= minQuality;
      const matchesQuery =
        !searchQuery ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.type.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesScore && matchesQuery;
    });
  }, [graphData.nodes, selectedType, minQuality, searchQuery]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return graphData.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  }, [graphData.edges, visibleNodeIds]);

  // Layout positions simulation for canvas render
  const layoutNodes = useMemo(() => {
    const total = filteredNodes.length;
    if (total === 0) return [];

    const width = 900;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.38;

    return filteredNodes.map((node, idx) => {
      // Group by type or circular angle
      const angle = (idx / total) * Math.PI * 2;
      const distance = node.type === 'evidence' ? radius * 0.45 : radius * (0.8 + (idx % 3) * 0.1);
      return {
        ...node,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        radius: node.type === 'evidence' ? 24 : 20
      };
    });
  }, [filteredNodes]);

  // Store layout nodes in ref for continuous render & interaction
  const liveNodesRef = useRef<any[]>([]);
  useEffect(() => {
    liveNodesRef.current = layoutNodes;
  }, [layoutNodes]);

  // Canvas Drawing & Force Simulation Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;

    const render = () => {
      const width = (canvas.width = canvas.parentElement?.clientWidth || 900);
      const height = (canvas.height = canvas.parentElement?.clientHeight || 600);

      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // Apply Pan & Zoom
      ctx.translate(transform.x + width / 2, transform.y + height / 2);
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(-width / 2, -height / 2);

      const nodes = liveNodesRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // 1. Draw Edges
      filteredEdges.forEach((edge) => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return;

        const isEdgeSelected = selectedEdge?.id === edge.id;
        const isConnectedToSelected = selectedNode && (selectedNode.id === src.id || selectedNode.id === tgt.id);

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);

        if (isEdgeSelected) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
        } else if (isConnectedToSelected) {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 2.5;
        } else if (edge.label === 'MENTIONED_IN') {
          ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
        } else {
          ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Edge Label & Evidence Chip
        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText(edge.label, midX, midY - 4);
      });

      // 2. Draw Nodes
      nodes.forEach((node) => {
        const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.other;
        const isSelected = selectedNode?.id === node.id;
        const isConnected = selectedNode && filteredEdges.some(
          (e) => (e.source === selectedNode.id && e.target === node.id) || (e.target === selectedNode.id && e.source === node.id)
        );

        // Glow effect on selection
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
          ctx.fill();
        }

        // Node Circle Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
        ctx.fill();

        ctx.lineWidth = isSelected ? 3 : isConnected ? 2.5 : 2;
        ctx.strokeStyle = isSelected ? '#38bdf8' : cfg.color;
        ctx.stroke();

        // Node Inner Fill Indicator
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = cfg.bg;
        ctx.fill();

        // Evidence Count Badge on Node
        const evCount = node.linked_evidence_ids?.length || 0;
        if (evCount > 0 && node.type !== 'evidence') {
          ctx.beginPath();
          ctx.arc(node.x + node.radius - 2, node.y - node.radius + 2, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#10b981';
          ctx.fill();
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(evCount.toString(), node.x + node.radius - 2, node.y - node.radius + 2);
        }

        // Node Label Underneath
        ctx.font = isSelected ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif';
        ctx.fillStyle = isSelected ? (isDark ? '#38bdf8' : '#0284c7') : isDark ? '#e2e8f0' : '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const truncatedLabel = node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label;
        ctx.fillText(truncatedLabel, node.x, node.y + node.radius + 6);
      });

      ctx.restore();
      animFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrame);
  }, [filteredEdges, selectedNode, selectedEdge, transform, isDark]);

  // Handle Canvas Mouse Interaction (Click, Drag, Pan, Zoom)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - (transform.x + canvas.width / 2)) / transform.scale + canvas.width / 2;
    const mouseY = (e.clientY - rect.top - (transform.y + canvas.height / 2)) / transform.scale + canvas.height / 2;

    // Check if a node was clicked
    const clickedNode = liveNodesRef.current.find((n) => {
      const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
      return dist <= n.radius + 5;
    });

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
      setSelectedEdge(null);
      return;
    }

    // Check if an edge was clicked
    const nodeMap = new Map(liveNodesRef.current.map((n) => [n.id, n]));
    const clickedEdge = filteredEdges.find((edge) => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return false;
      // Distance from point to line segment
      const lineLen = Math.hypot(tgt.x - src.x, tgt.y - src.y);
      if (lineLen === 0) return false;
      const t = Math.max(0, Math.min(1, ((mouseX - src.x) * (tgt.x - src.x) + (mouseY - src.y) * (tgt.y - src.y)) / (lineLen * lineLen)));
      const projX = src.x + t * (tgt.x - src.x);
      const projY = src.y + t * (tgt.y - src.y);
      return Math.hypot(mouseX - projX, mouseY - projY) < 8;
    });

    if (clickedEdge) {
      setSelectedEdge(clickedEdge);
      setSelectedNode(null);
      return;
    }

    // Canvas pan drag start
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - (transform.x + canvasRef.current.width / 2)) / transform.scale + canvasRef.current.width / 2;
      const mouseY = (e.clientY - rect.top - (transform.y + canvasRef.current.height / 2)) / transform.scale + canvasRef.current.height / 2;
      draggedNodeRef.current.x = mouseX;
      draggedNodeRef.current.y = mouseY;
      return;
    }

    if (isDraggingRef.current) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false;
    draggedNodeRef.current = null;
  };

  const handleZoom = (delta: number) => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.4, Math.min(2.5, prev.scale + delta))
    }));
  };

  const handleResetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const entityTypeOptions = ['all', 'person', 'phone', 'vehicle', 'organization', 'location', 'event', 'evidence'];

  return (
    <div className={`relative w-full h-[720px] rounded-3xl border overflow-hidden flex flex-col transition-colors ${
      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-200 shadow-xl'
    }`}>
      {/* Graph Toolbar */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 z-10 ${
        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-800/90 border-slate-700'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search graph nodes..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Type Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-md py-1">
            {entityTypeOptions.map((type) => {
              const cfg = TYPE_CONFIG[type] || { label: 'All Entities', color: '#38bdf8' };
              const isAct = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap border ${
                    isAct
                      ? 'bg-cyan-500 text-white border-cyan-400 shadow-sm'
                      : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {type === 'all' ? 'All Types' : cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls & Real-Time Status */}
        <div className="flex items-center space-x-2">
          {/* Real-time sync badge */}
          <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-400">{isConnected ? 'Live Stream' : 'Polled Sync'}</span>
          </div>

          {/* Min Quality Filter */}
          <div className="hidden md:flex items-center space-x-1 text-xs text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <Sliders className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] uppercase font-mono">Min Quality: {Math.round(minQuality * 100)}%</span>
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.1"
              value={minQuality}
              onChange={(e) => setMinQuality(parseFloat(e.target.value))}
              className="w-16 accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Zoom In / Out / Reset */}
          <button
            onClick={() => handleZoom(0.2)}
            title="Zoom In"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(-0.2)}
            title="Zoom Out"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            title="Reset View"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Graph Canvas Area */}
      <div className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-300 font-mono">Synthesizing Evidence Graph Relationships...</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="w-full h-full block"
        />

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur shadow-xl space-y-2 pointer-events-auto max-w-xs text-[11px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Entity Legend</span>
            <span className="font-mono text-cyan-400">{filteredNodes.length} Nodes • {filteredEdges.length} Edges</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(TYPE_CONFIG).slice(0, 6).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={key} className="flex items-center space-x-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <Icon className="w-3 h-3 text-slate-400" />
                  <span className="truncate text-[10px]">{cfg.label}</span>
                </div>
              );
            })}
          </div>
          <div className="pt-1 border-t border-slate-800 text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Green badge = Linked source evidence count</span>
          </div>
        </div>

        {/* Selected Node / Edge Inspector Drawer */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-80 max-h-[85%] overflow-y-auto p-5 rounded-3xl bg-slate-900/95 border border-slate-700 backdrop-blur shadow-2xl space-y-4 z-30 text-xs">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border" style={{
                  color: TYPE_CONFIG[selectedNode.type]?.color || '#38bdf8',
                  borderColor: TYPE_CONFIG[selectedNode.type]?.border || '#0284c7',
                  backgroundColor: TYPE_CONFIG[selectedNode.type]?.bg || 'rgba(56, 189, 248, 0.1)'
                }}>
                  {TYPE_CONFIG[selectedNode.type]?.label || selectedNode.type}
                </span>
                <h3 className="text-sm font-bold text-white mt-1.5 leading-snug">{selectedNode.label}</h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quality / Confidence Metric */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Confidence / Corroboration Score</span>
                <span className="font-mono font-bold text-cyan-400">
                  {Math.round((selectedNode.quality_score || 0.8) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                  style={{ width: `${Math.round((selectedNode.quality_score || 0.8) * 100)}%` }}
                />
              </div>
            </div>

            {/* Linked Source Evidence Section (§1 & §4 of PRD) */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                <span>Linked Source Evidence ({selectedNode.linked_evidence_ids?.length || 0})</span>
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              </h4>

              {selectedNode.linked_evidence_ids && selectedNode.linked_evidence_ids.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedNode.linked_evidence_ids.map((eid, idx) => {
                    const title = selectedNode.linked_evidence_titles?.[idx] || `Evidence Item #${eid.slice(0, 8)}`;
                    return (
                      <div
                        key={eid}
                        onClick={() => onNavigateToEvidence && onNavigateToEvidence(eid)}
                        className="p-2.5 rounded-xl bg-slate-950 border border-emerald-800/60 hover:border-emerald-500 transition cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <FileCheck2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="text-[11px] text-slate-200 truncate group-hover:text-emerald-300">{title}</span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 flex-shrink-0 ml-1" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No direct evidence links recorded for this entity.</p>
              )}
            </div>

            {/* Properties & Metadata */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Entity Attributes</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-[11px]">
                {Object.entries(selectedNode.properties || {}).map(([k, v]) => {
                  if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
                  return (
                    <div key={k} className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400">{k}:</span>
                      <span className="text-slate-200 text-right truncate ml-2 max-w-[140px]">{String(v)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Selected Edge Inspector Drawer */}
        {selectedEdge && (
          <div className="absolute top-4 right-4 w-80 max-h-[85%] overflow-y-auto p-5 rounded-3xl bg-slate-900/95 border border-slate-700 backdrop-blur shadow-2xl space-y-4 z-30 text-xs">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-bold border border-cyan-800">
                  Relationship Edge
                </span>
                <h3 className="text-sm font-bold text-white mt-1.5">{selectedEdge.label}</h3>
              </div>
              <button
                onClick={() => setSelectedEdge(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Weight / Strength:</span>
                <span className="text-cyan-400 font-bold">{selectedEdge.weight}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Confidence Score:</span>
                <span className="text-emerald-400 font-bold">{Math.round((selectedEdge.confidence || 0.9) * 100)}%</span>
              </div>
            </div>

            {/* Edge Linked Evidence */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                <span>Supporting Evidence ({selectedEdge.linked_evidence_ids?.length || 0})</span>
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              </h4>

              {selectedEdge.linked_evidence_ids && selectedEdge.linked_evidence_ids.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedEdge.linked_evidence_ids.map((eid, idx) => {
                    const title = selectedEdge.linked_evidence_titles?.[idx] || `Evidence Item #${eid.slice(0, 8)}`;
                    return (
                      <div
                        key={eid}
                        onClick={() => onNavigateToEvidence && onNavigateToEvidence(eid)}
                        className="p-2.5 rounded-xl bg-slate-950 border border-emerald-800/60 hover:border-emerald-500 transition cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <FileCheck2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="text-[11px] text-slate-200 truncate group-hover:text-emerald-300">{title}</span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 flex-shrink-0 ml-1" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Synthesized from common document co-occurrence.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseGraph;
