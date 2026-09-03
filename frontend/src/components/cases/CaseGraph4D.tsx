import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  Play,
  Pause,
  Clock,
  Layers,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { casesApi } from '../../services/api';
import { GraphData, GraphNode, GraphEdge } from '../../types';
import { getCaseEntities } from '../../data/demoCaseEntities';
import { useTheme } from '../../context/ThemeContext';
import { useRealtime } from '../../hooks/useRealtime';

interface CaseGraph4DProps {
  caseId: string;
  onNavigateToEvidence?: (evidenceId: string) => void;
  onNavigateToHypotheses?: () => void;
}

interface Node3D extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  zLayer: number; // 0 to 4 (Depth layer)
  timestamp?: number;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any; zLayer: number }> = {
  person: { label: 'Person of Interest', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)', border: '#0891b2', icon: Users, zLayer: 0 },
  vehicle: { label: 'Vehicle Linked', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', border: '#d97706', icon: Car, zLayer: 1 },
  organization: { label: 'Corporate Shell', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.2)', border: '#6366f1', icon: Building2, zLayer: 2 },
  location: { label: 'Scene / Transit', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.2)', border: '#e11d48', icon: MapPin, zLayer: 3 },
  phone: { label: 'Phone / IMEI', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.2)', border: '#0d9488', icon: Phone, zLayer: 1 },
  event: { label: 'Timeline Event', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)', border: '#0284c7', icon: Calendar, zLayer: 0 },
  evidence: { label: 'Source Evidence', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', border: '#059669', icon: FileCheck2, zLayer: 4 },
  other: { label: 'Other Asset', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.2)', border: '#64748b', icon: Layers, zLayer: 2 },
};

export const CaseGraph4D: React.FC<CaseGraph4DProps> = ({ caseId, onNavigateToEvidence }) => {
  const { isDark } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [rawGraphData, setRawGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minQuality, setMinQuality] = useState<number>(0);
  const [selectedZLayer, setSelectedZLayer] = useState<number | 'all'>('all');
  const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // 4D Time Dimension State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [timeSliderVal, setTimeSliderVal] = useState<number>(100); // 0% to 100%
  const animationTimerRef = useRef<any>(null);

  // Camera Pan & Zoom Transform State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [is3DMode, setIs3DMode] = useState(true);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<Node3D | null>(null);

  // Internal Force-Directed Simulation Nodes
  const simNodesRef = useRef<Node3D[]>([]);

  // Real-time synchronization
  useRealtime(caseId, (event) => {
    if (event.resource_type === 'case' || event.resource_type === 'evidence' || event.resource_type === 'entity') {
      loadGraphData();
    }
  });

  const loadGraphData = async () => {
    try {
      setLoading(true);
      const data = await casesApi.getGraph(caseId);
      if (data && data.nodes && data.nodes.length > 0) {
        setRawGraphData(data);
      } else {
        const synthetic = generateSyntheticGraph(caseId);
        setRawGraphData(synthetic);
      }
    } catch (err) {
      console.warn('Backend graph API fallback to 4D synthetic dossier:', err);
      const synthetic = generateSyntheticGraph(caseId);
      setRawGraphData(synthetic);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraphData();
  }, [caseId]);

  // Synthetic 4D Graph Generator with chronological event timestamps
  function generateSyntheticGraph(cid: string): GraphData {
    const bundle = getCaseEntities(cid);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const baseTime = Date.now() - 14 * 24 * 3600 * 1000;

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
        integrity_status: 'verified',
        timestamp: new Date(baseTime + 1 * 24 * 3600 * 1000).toISOString()
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
        integrity_status: 'verified',
        timestamp: new Date(baseTime + 4 * 24 * 3600 * 1000).toISOString()
      }
    });

    // People Nodes
    bundle.people.forEach((p, idx) => {
      const nodeTime = baseTime + (idx * 2 + 1) * 24 * 3600 * 1000;
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
          notes: p.notes,
          timestamp: new Date(nodeTime).toISOString()
        }
      });
      edges.push({
        id: `ev_link_${ev1Id}_${p.id}`,
        source: ev1Id,
        target: p.id,
        label: 'CORROBORATES',
        weight: 0.9,
        confidence: 0.95,
        linked_evidence_ids: [ev1Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report'],
        properties: { mention_context: 'Identified as key actor in FIR intake' }
      });
    });

    // Vehicle Nodes
    bundle.vehicles.forEach((v, idx) => {
      const vTime = baseTime + (idx * 3 + 2) * 24 * 3600 * 1000;
      nodes.push({
        id: v.id,
        label: `${v.registration_number} (${v.make_model})`,
        type: 'vehicle',
        quality_score: 0.85,
        linked_evidence_ids: [ev1Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report'],
        properties: { ...v, timestamp: new Date(vTime).toISOString() }
      });
      if (bundle.people[0]) {
        edges.push({
          id: `rel_owns_${bundle.people[0].id}_${v.id}`,
          source: bundle.people[0].id,
          target: v.id,
          label: 'OPERATES',
          weight: 0.95,
          confidence: 0.98,
          linked_evidence_ids: [ev1Id],
          linked_evidence_titles: ['FIR First Information & Seizure Report'],
          properties: { registered_owner: v.registered_owner }
        });
      }
    });

    // Organization Nodes
    bundle.organizations.forEach((o, idx) => {
      const oTime = baseTime + (idx * 4 + 3) * 24 * 3600 * 1000;
      nodes.push({
        id: o.id,
        label: o.name,
        type: 'organization',
        quality_score: 0.80,
        linked_evidence_ids: [ev1Id, ev2Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report', 'Telecom CDR Intercept Matrix & Tower Log'],
        properties: { ...o, timestamp: new Date(oTime).toISOString() }
      });
      if (bundle.people[0]) {
        edges.push({
          id: `rel_dir_${bundle.people[0].id}_${o.id}`,
          source: bundle.people[0].id,
          target: o.id,
          label: 'BENEFICIAL_OWNER',
          weight: 0.9,
          confidence: 0.92,
          linked_evidence_ids: [ev1Id],
          linked_evidence_titles: ['FIR First Information & Seizure Report'],
          properties: { designation: 'Director & Majority Shareholder' }
        });
      }
    });

    // Phone Nodes
    bundle.phone_numbers.forEach((ph, idx) => {
      const pTime = baseTime + (idx * 2 + 4) * 24 * 3600 * 1000;
      nodes.push({
        id: ph.id,
        label: ph.phone_number,
        type: 'phone',
        quality_score: 0.92,
        linked_evidence_ids: [ev2Id],
        linked_evidence_titles: ['Telecom CDR Intercept Matrix & Tower Log'],
        properties: { ...ph, timestamp: new Date(pTime).toISOString() }
      });
      if (bundle.people[0]) {
        edges.push({
          id: `rel_calls_${bundle.people[0].id}_${ph.id}`,
          source: bundle.people[0].id,
          target: ph.id,
          label: 'INTERCEPT_CALLS',
          weight: 0.95,
          confidence: 0.96,
          linked_evidence_ids: [ev2Id],
          linked_evidence_titles: ['Telecom CDR Intercept Matrix & Tower Log'],
          properties: { frequency: '142 intercepted sessions' }
        });
      }
    });

    // Location Nodes
    bundle.locations.forEach((loc, idx) => {
      const lTime = baseTime + (idx * 3 + 5) * 24 * 3600 * 1000;
      nodes.push({
        id: loc.id,
        label: loc.address,
        type: 'location',
        quality_score: 0.78,
        linked_evidence_ids: [ev1Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report'],
        properties: { ...loc, timestamp: new Date(lTime).toISOString() }
      });
      if (bundle.people[0]) {
        edges.push({
          id: `rel_vis_${bundle.people[0].id}_${loc.id}`,
          source: bundle.people[0].id,
          target: loc.id,
          label: 'SURVEILLANCE_SIGHT',
          weight: 0.85,
          confidence: 0.88,
          linked_evidence_ids: [ev1Id],
          linked_evidence_titles: ['FIR First Information & Seizure Report'],
          properties: { sight_date: '2026-08-28 22:30 UTC' }
        });
      }
    });

    // Events
    bundle.events.forEach((ev, idx) => {
      const eTime = baseTime + (idx * 2 + 6) * 24 * 3600 * 1000;
      nodes.push({
        id: ev.id,
        label: ev.title,
        type: 'event',
        quality_score: 0.90,
        linked_evidence_ids: [ev1Id, ev2Id],
        linked_evidence_titles: ['FIR First Information & Seizure Report'],
        properties: { ...ev, timestamp: new Date(eTime).toISOString() }
      });
      if (bundle.people[0]) {
        edges.push({
          id: `rel_ev_${bundle.people[0].id}_${ev.id}`,
          source: bundle.people[0].id,
          target: ev.id,
          label: 'PARTICIPATED_IN',
          weight: 0.92,
          confidence: 0.95,
          linked_evidence_ids: [ev1Id],
          linked_evidence_titles: ['FIR First Information & Seizure Report'],
          properties: { event_type: ev.event_type }
        });
      }
    });

    return { nodes, edges };
  }

  // Calculate global time range for the 4D timeline
  const timeExtents = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    rawGraphData.nodes.forEach((n) => {
      const ts = n.properties?.timestamp ? new Date(n.properties.timestamp).getTime() : 0;
      if (ts > 0) {
        if (ts < minTime) minTime = ts;
        if (ts > maxTime) maxTime = ts;
      }
    });
    if (minTime === Infinity) {
      minTime = Date.now() - 14 * 24 * 3600 * 1000;
      maxTime = Date.now();
    }
    return { min: minTime, max: maxTime };
  }, [rawGraphData]);

  // Current threshold timestamp based on slider (4D Time Filter)
  const currentCutoffTime = useMemo(() => {
    return timeExtents.min + (timeExtents.max - timeExtents.min) * (timeSliderVal / 100);
  }, [timeExtents, timeSliderVal]);

  // 4D Timeline Animation Loop
  useEffect(() => {
    if (isPlaying) {
      animationTimerRef.current = setInterval(() => {
        setTimeSliderVal((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return Math.min(100, prev + 1.2 * playSpeed);
        });
      }, 100);
    } else {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    }
    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, [isPlaying, playSpeed]);

  // Filtered nodes and edges for rendering
  const { visibleNodes, visibleEdges } = useMemo(() => {
    const nodeMap = new Map<string, Node3D>();

    rawGraphData.nodes.forEach((n) => {
      const nodeTime = n.properties?.timestamp ? new Date(n.properties.timestamp).getTime() : 0;
      const isWithinTime = nodeTime === 0 || nodeTime <= currentCutoffTime;
      const matchesType = selectedType === 'all' || n.type === selectedType;
      const matchesQuality = (n.quality_score || 1) >= minQuality;
      const matchesSearch = !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase());
      const zLayer = TYPE_CONFIG[n.type]?.zLayer ?? 2;
      const matchesZ = selectedZLayer === 'all' || zLayer === selectedZLayer;

      if (isWithinTime && matchesType && matchesQuality && matchesSearch && matchesZ) {
        const existing = simNodesRef.current.find((s) => s.id === n.id);
        const radius = 180 + zLayer * 65;
        const angle = Math.random() * Math.PI * 2;

        const nodeObj: Node3D = {
          ...n,
          x: existing ? existing.x : 400 + Math.cos(angle) * radius,
          y: existing ? existing.y : 300 + Math.sin(angle) * radius,
          vx: existing ? existing.vx : 0,
          vy: existing ? existing.vy : 0,
          zLayer,
          timestamp: nodeTime
        };
        nodeMap.set(n.id, nodeObj);
      }
    });

    const vNodes = Array.from(nodeMap.values());
    simNodesRef.current = vNodes;

    const vEdges = rawGraphData.edges.filter((e) => {
      return nodeMap.has(e.source) && nodeMap.has(e.target);
    });

    return { visibleNodes: vNodes, visibleEdges: vEdges };
  }, [rawGraphData, currentCutoffTime, selectedType, minQuality, searchQuery, selectedZLayer]);

  // Force-Directed 3D Physics Animation
  useEffect(() => {
    let animationFrameId: number;

    const updatePhysics = () => {
      const nodes = simNodesRef.current;
      const edges = visibleEdges;
      const nodeMap = new Map<string, Node3D>();
      nodes.forEach((n) => nodeMap.set(n.id, n));

      // 1. Repulsion between visible nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);

          if (dist < 320) {
            const layerFactor = n1.zLayer === n2.zLayer ? 1.4 : 0.8;
            const force = (1800 / distSq) * layerFactor;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (draggedNodeRef.current?.id !== n1.id) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (draggedNodeRef.current?.id !== n2.id) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }
      }

      // 2. Spring Attraction along Edges
      edges.forEach((e) => {
        const source = nodeMap.get(e.source);
        const target = nodeMap.get(e.target);
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const desiredDist = 130 + (source.zLayer + target.zLayer) * 15;
          const springForce = (dist - desiredDist) * 0.035;

          const fx = (dx / dist) * springForce;
          const fy = (dy / dist) * springForce;

          if (draggedNodeRef.current?.id !== source.id) {
            source.vx += fx;
            source.vy += fy;
          }
          if (draggedNodeRef.current?.id !== target.id) {
            target.vx -= fx;
            target.vy -= fy;
          }
        }
      });

      // 3. Central Gravity Pull & Damping
      const centerX = 420;
      const centerY = 320;
      nodes.forEach((n) => {
        if (draggedNodeRef.current?.id !== n.id) {
          const gx = (centerX - n.x) * 0.008;
          const gy = (centerY - n.y) * 0.008;
          n.vx = (n.vx + gx) * 0.88;
          n.vy = (n.vy + gy) * 0.88;
          n.x += n.vx;
          n.y += n.vy;
        }
      });

      // Render Frame
      renderCanvas();
      animationFrameId = requestAnimationFrame(updatePhysics);
    };

    animationFrameId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animationFrameId);
  }, [visibleNodes, visibleEdges, transform, isDark, is3DMode, selectedNode, selectedEdge]);

  // Canvas Drawing Routine
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Draw Subtle 3D Isometric Grid Backdrop
    ctx.strokeStyle = isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(226, 232, 240, 0.6)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = -width; x < width * 2; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -height);
      ctx.lineTo(x, height * 2);
      ctx.stroke();
    }
    for (let y = -height; y < height * 2; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-width, y);
      ctx.lineTo(width * 2, y);
      ctx.stroke();
    }

    const nodeMap = new Map<string, Node3D>();
    simNodesRef.current.forEach((n) => nodeMap.set(n.id, n));

    // Draw Edges with Corroboration Glow
    visibleEdges.forEach((e) => {
      const source = nodeMap.get(e.source);
      const target = nodeMap.get(e.target);
      if (!source || !target) return;

      const isEdgeSelected = selectedEdge?.id === e.id;
      const isConnectedToSelectedNode = selectedNode && (selectedNode.id === source.id || selectedNode.id === target.id);
      const hasEvidence = e.linked_evidence_ids && e.linked_evidence_ids.length > 0;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);

      // Curved line for 3D depth aesthetic
      const midX = (source.x + target.x) / 2 + (source.zLayer - target.zLayer) * 12;
      const midY = (source.y + target.y) / 2 + (source.zLayer - target.zLayer) * 12;
      ctx.quadraticCurveTo(midX, midY, target.x, target.y);

      if (isEdgeSelected) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.5;
      } else if (isConnectedToSelectedNode) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
      } else if (hasEvidence) {
        ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.5)' : 'rgba(5, 150, 105, 0.6)';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = isDark ? 'rgba(71, 85, 105, 0.45)' : 'rgba(148, 163, 184, 0.6)';
        ctx.lineWidth = 1.2;
      }
      ctx.stroke();

      // Edge Label on Midpoint
      const labelX = (source.x + target.x) / 2;
      const labelY = (source.y + target.y) / 2;

      ctx.font = '9px monospace';
      ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
      ctx.textAlign = 'center';
      ctx.fillText(e.label, labelX, labelY - 4);

      if (hasEvidence) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(labelX, labelY + 6, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Nodes Sorted by Z-Layer for Accurate 3D Depth
    const sortedNodes = [...simNodesRef.current].sort((a, b) => a.zLayer - b.zLayer);

    sortedNodes.forEach((node) => {
      const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.other;
      const isNodeSelected = selectedNode?.id === node.id;
      const depthScale = is3DMode ? 1 + (4 - node.zLayer) * 0.08 : 1;
      const nodeRadius = (node.type === 'person' ? 24 : node.type === 'evidence' ? 22 : 19) * depthScale;

      // Soft Depth Shadow
      ctx.shadowColor = cfg.color;
      ctx.shadowBlur = isNodeSelected ? 24 : is3DMode ? 12 : 4;

      // Node Body Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = isNodeSelected ? cfg.color : isDark ? '#0f172a' : '#ffffff';
      ctx.fill();

      // Node Border Ring
      ctx.lineWidth = isNodeSelected ? 3 : 2;
      ctx.strokeStyle = cfg.color;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner Ambient Tint
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius - 3, 0, Math.PI * 2);
      ctx.fillStyle = cfg.bg;
      ctx.fill();

      // Corroborating Evidence Badge (Count Chip)
      const evCount = node.linked_evidence_ids?.length || 0;
      if (evCount > 0) {
        const badgeX = node.x + nodeRadius * 0.75;
        const badgeY = node.y - nodeRadius * 0.75;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = isDark ? '#020617' : '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 8px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(evCount.toString(), badgeX, badgeY);
      }

      // Node Label Text
      ctx.font = isNodeSelected ? 'bold 11px sans-serif' : '10px sans-serif';
      ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const truncated = node.label.length > 22 ? node.label.substring(0, 20) + '...' : node.label;
      ctx.fillText(truncated, node.x, node.y + nodeRadius + 5);

      // Node Z-Depth Indicator Tag
      if (is3DMode) {
        ctx.font = '8px monospace';
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.fillText(`L${node.zLayer}`, node.x, node.y + nodeRadius + 18);
      }
    });

    ctx.restore();
  }, [visibleEdges, isDark, is3DMode, selectedNode, selectedEdge, transform]);

  // Mouse & Touch Interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
    const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;

    // Check node click
    const clickedNode = simNodesRef.current.find((n) => {
      const dx = n.x - mouseX;
      const dy = n.y - mouseY;
      return Math.sqrt(dx * dx + dy * dy) <= 28;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode);
      setSelectedEdge(null);
      draggedNodeRef.current = clickedNode;
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Check edge click
    const nodeMap = new Map<string, Node3D>();
    simNodesRef.current.forEach((n) => nodeMap.set(n.id, n));

    const clickedEdge = visibleEdges.find((edge) => {
      const s = nodeMap.get(edge.source);
      const t = nodeMap.get(edge.target);
      if (!s || !t) return false;
      const midX = (s.x + t.x) / 2;
      const midY = (s.y + t.y) / 2;
      const dist = Math.sqrt((midX - mouseX) ** 2 + (midY - mouseY) ** 2);
      return dist <= 20;
    });

    if (clickedEdge) {
      setSelectedEdge(clickedEdge);
      setSelectedNode(null);
      return;
    }

    // Canvas Pan
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draggedNodeRef.current) {
      const rect = canvas.getBoundingClientRect();
      draggedNodeRef.current.x = (e.clientX - rect.left - transform.x) / transform.scale;
      draggedNodeRef.current.y = (e.clientY - rect.top - transform.y) / transform.scale;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
    } else {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      }));
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    draggedNodeRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.35, Math.min(3.5, prev.scale * zoomFactor))
    }));
  };

  const handleResetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  return (
    <div className={`relative w-full rounded-3xl border overflow-hidden flex flex-col transition-colors duration-300 ${
      isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      {/* 4D Graph Controls Header */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Entity Type Filter Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                selectedType === 'all'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-700 hover:bg-slate-100 border'
              }`}
            >
              All Types ({rawGraphData.nodes.length})
            </button>
            {Object.entries(TYPE_CONFIG).map(([typeKey, cfg]) => {
              const Icon = cfg.icon;
              const count = rawGraphData.nodes.filter((n) => n.type === typeKey).length;
              if (count === 0) return null;
              return (
                <button
                  key={typeKey}
                  onClick={() => setSelectedType(typeKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap ${
                    selectedType === typeKey
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : isDark ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-700 hover:bg-slate-100 border'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                  <span>{cfg.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & 3D Layer Selector */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search graph entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-8 pr-3 py-1.5 rounded-xl text-xs border outline-none w-44 sm:w-56 transition ${
                isDark ? 'bg-slate-950 border-slate-700 text-slate-200 focus:border-cyan-500' : 'bg-white border-slate-300 text-slate-800 focus:border-cyan-500'
              }`}
            />
          </div>

          <button
            onClick={() => setIs3DMode(!is3DMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition ${
              is3DMode
                ? 'bg-purple-600/20 text-purple-400 border-purple-500/50 shadow-sm'
                : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>{is3DMode ? '3D Isometric' : '2D Plane'}</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="relative w-full h-[540px] sm:h-[620px] bg-gradient-to-b from-slate-950 to-slate-900 overflow-hidden select-none">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-20 backdrop-blur-sm">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono text-cyan-400">Rendering 4D Spatiotemporal Intelligence Canvas...</p>
            </div>
          </div>
        ) : null}

        <canvas
          ref={canvasRef}
          width={1200}
          height={680}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* On-Canvas Zoom & Pan Toolbar */}
        <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
          <button
            onClick={() => setTransform((p) => ({ ...p, scale: Math.min(3.5, p.scale * 1.2) }))}
            className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg backdrop-blur-sm transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTransform((p) => ({ ...p, scale: Math.max(0.35, p.scale * 0.8) }))}
            className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg backdrop-blur-sm transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg backdrop-blur-sm transition"
            title="Reset Perspective"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Layer Depth Quick Chips (Bottom-Left) */}
        <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center space-x-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-800 backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold px-2">Depth Layers:</span>
          {['all', 0, 1, 2, 3, 4].map((layer) => (
            <button
              key={layer.toString()}
              onClick={() => setSelectedZLayer(layer as any)}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition ${
                selectedZLayer === layer
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {layer === 'all' ? 'All (0-4)' : `L${layer}`}
            </button>
          ))}
        </div>

        {/* Selected Node Inspector Drawer */}
        {selectedNode && (
          <div className="absolute top-4 right-16 w-80 sm:w-96 max-h-[90%] overflow-y-auto bg-slate-950/95 border border-cyan-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-xl z-20 space-y-4 animate-in slide-in-from-right duration-200 text-slate-200">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {TYPE_CONFIG[selectedNode.type]?.label || selectedNode.type}
                </span>
                <h3 className="text-base font-bold text-white leading-snug">{selectedNode.label}</h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quality & Integrity Status */}
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Confidence / Quality Score:</span>
                <span className="font-mono font-bold text-emerald-400">{Math.round((selectedNode.quality_score || 0.88) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.round((selectedNode.quality_score || 0.88) * 100)}%` }}
                />
              </div>
            </div>

            {/* Properties Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Entity Attributes</h4>
              <div className="bg-slate-900/60 rounded-2xl p-3 border border-slate-800 space-y-1.5 text-xs">
                {Object.entries(selectedNode.properties || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-slate-800/50 last:border-0">
                    <span className="text-slate-400 capitalize">{key.replace('_', ' ')}:</span>
                    <span className="font-mono text-slate-200 text-right max-w-[200px] truncate">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Corroborating Evidence Items */}
            {selectedNode.linked_evidence_ids && selectedNode.linked_evidence_ids.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    Corroborating Evidence ({selectedNode.linked_evidence_ids.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {selectedNode.linked_evidence_ids.map((evId, idx) => (
                    <div
                      key={evId}
                      className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 flex items-center justify-between"
                    >
                      <div className="space-y-0.5 overflow-hidden">
                        <span className="text-xs font-semibold text-emerald-300 block truncate">
                          {selectedNode.linked_evidence_titles?.[idx] || `Evidence #${evId}`}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-500 truncate block">
                          ID: {evId}
                        </span>
                      </div>
                      {onNavigateToEvidence && (
                        <button
                          onClick={() => onNavigateToEvidence(evId)}
                          className="p-1.5 bg-emerald-800/50 hover:bg-emerald-700 text-emerald-200 rounded-lg transition"
                          title="Open Evidence File"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selected Edge Inspector Drawer */}
        {selectedEdge && (
          <div className="absolute top-4 right-16 w-80 sm:w-96 max-h-[90%] overflow-y-auto bg-slate-950/95 border border-purple-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-xl z-20 space-y-4 animate-in slide-in-from-right duration-200 text-slate-200">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  Relationship Link
                </span>
                <h3 className="text-base font-bold text-white leading-snug">{selectedEdge.label}</h3>
              </div>
              <button
                onClick={() => setSelectedEdge(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-900/60 rounded-2xl p-3 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Source Entity:</span>
                <span className="font-mono text-cyan-400">{selectedEdge.source}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Target Entity:</span>
                <span className="font-mono text-cyan-400">{selectedEdge.target}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Corroboration Confidence:</span>
                <span className="font-mono font-bold text-emerald-400">{Math.round((selectedEdge.confidence || 0.95) * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4D Temporal Timeline Bar (4th Dimension Scrubber) */}
      <div className={`p-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-2.5 rounded-2xl font-bold flex items-center space-x-1.5 transition shadow-md ${
              isPlaying
                ? 'bg-rose-600 text-white shadow-rose-600/30'
                : 'bg-cyan-600 text-white shadow-cyan-600/30 hover:bg-cyan-500'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            <span className="text-xs pr-1">{isPlaying ? 'Pause' : 'Play Timeline'}</span>
          </button>

          <button
            onClick={() => setPlaySpeed((s) => (s === 1 ? 2 : s === 2 ? 5 : 1))}
            className={`px-2.5 py-2 rounded-xl text-xs font-mono font-bold border transition ${
              isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}
            title="Toggle Playback Speed"
          >
            {playSpeed}x Speed
          </button>
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 max-w-xl flex items-center space-x-3">
          <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-400">Incident T-0</span>
              <span className="text-cyan-400 font-bold">
                {new Date(currentCutoffTime).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              <span className="text-slate-400">Present (T-End)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={timeSliderVal}
              onChange={(e) => setTimeSliderVal(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Quality Threshold Filter */}
        <div className="flex items-center space-x-2">
          <Sliders className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400 whitespace-nowrap">Min Confidence:</span>
          <select
            value={minQuality}
            onChange={(e) => setMinQuality(parseFloat(e.target.value))}
            className={`text-xs rounded-xl px-2.5 py-1.5 border outline-none font-mono ${
              isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <option value="0">All (0%+)</option>
            <option value="0.75">High (75%+)</option>
            <option value="0.9">Verified (90%+)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
