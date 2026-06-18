import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Building2, Users, Briefcase, CreditCard,
  CheckCircle, XCircle, Clock, AlertTriangle, Settings,
  FileText, UserCheck, DollarSign, TrendingUp, Activity,
  Eye, UserPlus, Ban, RefreshCw, Search, Filter, LayoutGrid, LayoutList,
  Key, Lock, Unlock, ScrollText, BookOpen, Wallet, Receipt,
  Globe, Hash, GraduationCap, AlertCircle, ChevronDown,
  ChevronRight, Download, Upload, MoreHorizontal, LogOut,
  Fingerprint, ShieldCheck, Database, Server, BarChart3,
  PieChart, ArrowUpRight, ArrowDownRight, Building, Heart,
  FileCheck, UserCog, ClipboardList, Landmark, Scale,
  Plus, Trash2, Edit, Check, X, Bell, Menu, Home, RotateCcw, ArrowRight,
  Brain, Target, LineChart, Award, HelpCircle, Sparkles,
  Mail, Smartphone, Zap, Save, ToggleLeft, Loader2, Info, Send,
  Star, Calendar, MailCheck, History, Layers, Play,
  Crown, Package, Baby, UserCircle2, School, BookMarked,
  HeartPulse, Stethoscope, MapPin, Phone, Link2, ChevronLeft,
  ChevronUp, BadgeCheck, BadgeX, Clipboard, Repeat2, GitBranch,
  Calculator, SlidersHorizontal, FlaskConical, BarChart2, Percent,
  Cpu, Archive, Bot, Network
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', cyan: '#4ECDC4', lightBg: '#f8fafc', dark: '#1e293b', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6', indigo: '#6366f1' };
const PKG_CATEGORIES_DEFAULT = ['Psychometric', 'Academic', 'Counselling', 'Career', 'Wellness', 'Digital Skills', 'Leadership', 'Life Skills'];
const PKG_SUBCATEGORIES_DEFAULT = ['Entry', 'Standard', 'Premium', 'Enterprise'];

function formatEntityType(type?: string): string {
  if (!type) return '';
  switch (type.toLowerCase()) {
    case 'ngo': return 'NGO'; case 'lei': return 'LEI';
    default: return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }
}
function formatDate(d?: string | null) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } }
function formatDateTime(d?: string | null) { if (!d) return '—'; try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } }
function formatCurrency(n?: number | null) { if (n == null) return '—'; return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }
function getStatusBadge(status?: string) {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = { active: 'bg-green-100 text-green-800', inactive: 'bg-gray-100 text-gray-800', pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', suspended: 'bg-red-100 text-red-800', verified: 'bg-blue-100 text-blue-800' };
  return map[s] || 'bg-gray-100 text-gray-700';
}

export default function LDEGraphPanel() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const highlightedRef = useRef<Set<string>>(new Set());
  const traversalEdgeIdsRef = useRef<Set<string>>(new Set());

  const [nodeTypeFilter, setNodeTypeFilter] = useState('');
  const [relFilter, setRelFilter] = useState('');
  const [concernInput, setConcernInput] = useState('');
  const [traverseResult, setTraverseResult] = useState<any>(null);
  const [traverseLoading, setTraverseLoading] = useState(false);
  const [traverseError, setTraverseError] = useState('');
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [svgSize, setSvgSize] = useState({ w: 900, h: 560 });
  const [simRunning, setSimRunning] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingNode = useRef<GNode | null>(null);
  const draggingPan = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const apiUrl = `/api/lde/graph/nodes${nodeTypeFilter ? `?node_type=${encodeURIComponent(nodeTypeFilter)}` : ''}${relFilter ? `${nodeTypeFilter ? '&' : '?'}relationship=${encodeURIComponent(relFilter)}` : ''}`;

  const graphQ = useQuery({
    queryKey: ['lde-graph-nodes', nodeTypeFilter, relFilter],
    queryFn: () => fetchJson(apiUrl),
    staleTime: 60_000,
  });

  // ── Initialise nodes with random positions ────────────────────────────────
  useEffect(() => {
    if (!graphQ.data?.nodes) return;
    const { w, h } = svgSize;
    const prevMap: Record<string, GNode> = {};
    nodesRef.current.forEach(n => { prevMap[n.id] = n; });
    nodesRef.current = graphQ.data.nodes.map((n: any) => {
      const prev = prevMap[n.id];
      return {
        ...n,
        x: prev?.x ?? w / 2 + (Math.random() - 0.5) * 400,
        y: prev?.y ?? h / 2 + (Math.random() - 0.5) * 400,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      };
    });
    edgesRef.current = graphQ.data.edges || [];
    highlightedRef.current = new Set();
    traversalEdgeIdsRef.current = new Set();
  }, [graphQ.data]);

  // ── Measure container ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      setSvgSize({ w: e.contentRect.width, h: Math.max(520, e.contentRect.height) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Draw frame ────────────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const highlighted = highlightedRef.current;
    const { w, h } = svgSize;
    const hasHighlight = highlighted.size > 0;

    // Use exact traversal edge IDs when available, otherwise infer from highlighted node pairs
    const traversalEdgeIds = traversalEdgeIdsRef.current;
    const highlightedEdgeSet = traversalEdgeIds.size > 0
      ? traversalEdgeIds
      : new Set(edges.filter(e => highlighted.has(e.source_id) && highlighted.has(e.target_id)).map(e => e.id));

    // Clear and rebuild SVG
    svg.innerHTML = '';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrow'); marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6'); marker.setAttribute('refX', '5');
    marker.setAttribute('refY', '3'); marker.setAttribute('orient', 'auto');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M0,0 L0,6 L6,3 z'); arrowPath.setAttribute('fill', '#94A3B8');
    marker.appendChild(arrowPath); defs.appendChild(marker); svg.appendChild(defs);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${pan.x},${pan.y}) scale(${zoom})`);
    svg.appendChild(g);

    // Edges
    const edgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.appendChild(edgeLayer);
    const nodeIdx: Record<string, GNode> = {};
    nodes.forEach(n => { nodeIdx[n.id] = n; });
    for (const e of edges) {
      const s = nodeIdx[e.source_id], t = nodeIdx[e.target_id];
      if (!s || !t) continue;
      const isHL = hasHighlight && highlightedEdgeSet.has(e.id);
      const dim = hasHighlight && !isHL;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(s.x)); line.setAttribute('y1', String(s.y));
      line.setAttribute('x2', String(t.x)); line.setAttribute('y2', String(t.y));
      line.setAttribute('stroke', isHL ? '#F59E0B' : '#CBD5E1');
      line.setAttribute('stroke-width', isHL ? String(Math.max(1.5, e.weight * 4)) : String(Math.max(0.5, e.weight * 2)));
      line.setAttribute('stroke-opacity', dim ? '0.15' : isHL ? '1' : '0.55');
      line.setAttribute('marker-end', 'url(#arrow)');
      edgeLayer.appendChild(line);
    }

    // Nodes
    const nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.appendChild(nodeLayer);
    for (const n of nodes) {
      const isHL = highlighted.has(n.id);
      const dim = hasHighlight && !isHL;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(n.x)); circle.setAttribute('cy', String(n.y));
      circle.setAttribute('r', isHL ? String(NODE_RADIUS + 3) : String(NODE_RADIUS));
      circle.setAttribute('fill', nodeColor(n.node_type));
      circle.setAttribute('fill-opacity', dim ? '0.2' : '1');
      circle.setAttribute('stroke', isHL ? '#FBBF24' : '#fff');
      circle.setAttribute('stroke-width', isHL ? '2.5' : '1.5');
      circle.setAttribute('style', 'cursor:pointer');
      circle.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setSelectedNode(n);
        traversalEdgeIdsRef.current = new Set();
        highlightedRef.current = new Set([
          n.id,
          ...edges.filter(e => e.source_id === n.id || e.target_id === n.id).flatMap(e => [e.source_id, e.target_id])
        ]);
      });
      circle.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        draggingNode.current = n;
      });
      nodeLayer.appendChild(circle);
      if (zoom > 0.6 || isHL) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(n.x));
        text.setAttribute('y', String(n.y + NODE_RADIUS + 10));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', isHL ? '10' : '9');
        text.setAttribute('fill', dim ? '#CBD5E1' : '#374151');
        text.setAttribute('font-family', 'system-ui, sans-serif');
        text.setAttribute('pointer-events', 'none');
        const maxLen = 18;
        text.textContent = n.label.length > maxLen ? n.label.slice(0, maxLen) + '…' : n.label;
        nodeLayer.appendChild(text);
      }
    }
  }, [svgSize, zoom, pan]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    let frame: number;
    const tick = () => {
      if (simRunning && nodesRef.current.length > 0) {
        runForce(nodesRef.current, edgesRef.current, svgSize.w, svgSize.h, 2);
      }
      drawFrame();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    animRef.current = frame;
    return () => cancelAnimationFrame(frame);
  }, [simRunning, drawFrame, svgSize]);

  // ── Pointer events for drag/pan ───────────────────────────────────────────
  const onSvgMouseDown = (e: React.MouseEvent) => {
    if (!draggingNode.current) {
      draggingPan.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  };
  const onSvgMouseMove = (e: React.MouseEvent) => {
    if (draggingNode.current) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      draggingNode.current.x = (e.clientX - rect.left - pan.x) / zoom;
      draggingNode.current.y = (e.clientY - rect.top - pan.y) / zoom;
      draggingNode.current.vx = 0; draggingNode.current.vy = 0;
    } else if (draggingPan.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    }
  };
  const onSvgMouseUp = () => {
    draggingNode.current = null;
    draggingPan.current = false;
  };
  const onSvgClick = () => {
    setSelectedNode(null);
    highlightedRef.current = new Set();
    traversalEdgeIdsRef.current = new Set();
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  };

  // ── Concern traversal ─────────────────────────────────────────────────────
  const handleTraverse = async () => {
    const term = concernInput.trim();
    if (!term) return;
    setTraverseLoading(true); setTraverseError(''); setTraverseResult(null);
    try {
      const data = await fetchJson(`/api/lde/graph/traverse/concern?concern=${encodeURIComponent(term)}&depth=3`);
      if (data.error) { setTraverseError(data.error + (data.hint ? ` — ${data.hint}` : '')); setTraverseLoading(false); return; }
      setTraverseResult(data);
      // Highlight only nodes returned by the traversal (strict path fidelity)
      const traversalNodeKeys = new Set<string>((data.nodes || []).map((n: any) => n.node_key));
      const traversedLocalIds = new Set<string>(
        nodesRef.current.filter(x => traversalNodeKeys.has(x.node_key)).map(x => x.id)
      );
      highlightedRef.current = traversedLocalIds;
      // Map traversal edge IDs: match returned source_id/target_id to local edges
      const traversalEdgeIds = new Set<string>();
      for (const te of (data.edges || [])) {
        const localEdge = edgesRef.current.find(
          e => e.source_id === te.source_id && e.target_id === te.target_id
        );
        if (localEdge) traversalEdgeIds.add(localEdge.id);
      }
      traversalEdgeIdsRef.current = traversalEdgeIds;
    } catch (err: any) {
      setTraverseError(err?.message || 'Failed to reach the server. Is the backend running?');
    }
    setTraverseLoading(false);
  };

  const stats = graphQ.data?.stats;
  const nodeTypes: string[] = stats?.node_types || [];
  const relTypes: string[] = stats?.relationship_types || [];

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex-shrink-0">
        <h2 className="text-xl font-bold" style={{ color: NAV }}>Knowledge Graph Explorer</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {stats ? `${stats.node_count} nodes · ${stats.edge_count} edges` : 'Loading graph…'}
        </p>
        <Legend types={nodeTypes} />
      </div>

      {/* Controls row */}
      <div className="flex-shrink-0 flex flex-wrap gap-2 items-end">
        {/* Node type filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Filter by node type</label>
          <select
            className="border rounded px-2 py-1.5 text-sm bg-white"
            value={nodeTypeFilter}
            onChange={e => { setNodeTypeFilter(e.target.value); setSelectedNode(null); highlightedRef.current = new Set(); traversalEdgeIdsRef.current = new Set(); }}
          >
            <option value="">All types</option>
            {nodeTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {/* Relationship filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Filter by relationship</label>
          <select
            className="border rounded px-2 py-1.5 text-sm bg-white"
            value={relFilter}
            onChange={e => { setRelFilter(e.target.value); setSelectedNode(null); highlightedRef.current = new Set(); traversalEdgeIdsRef.current = new Set(); }}
          >
            <option value="">All relationships</option>
            {relTypes.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Concern traversal */}
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <label className="text-xs text-gray-500 font-medium">Traverse from concern</label>
          <div className="flex gap-1">
            <Input
              placeholder="e.g. anxiety, focus, career…"
              value={concernInput}
              onChange={e => setConcernInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTraverse()}
              className="text-sm"
            />
            <Button size="sm" onClick={handleTraverse} disabled={traverseLoading} style={{ background: NAV, color: '#fff' }}>
              {traverseLoading ? '…' : 'Traverse →'}
            </Button>
          </div>
        </div>

        {/* Sim controls */}
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setSimRunning(r => !r)}>
            {simRunning ? 'Pause' : 'Resume'} sim
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            Reset view
          </Button>
        </div>
      </div>

      {/* Traversal error */}
      {traverseError && (
        <div className="flex-shrink-0 bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
          {traverseError}
        </div>
      )}

      {/* Traversal results */}
      {traverseResult && !traverseError && (
        <div className="flex-shrink-0 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm">
          <div className="font-semibold text-blue-800 mb-1">
            Traversal: "{traverseResult.resolved_label}" — {traverseResult.traversed_nodes} nodes reached (depth {traverseResult.depth})
          </div>
          {traverseResult.reasoning_path?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {traverseResult.reasoning_path.map((step: any, i: number) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-blue-400">→</span>}
                  <span className="bg-white border border-blue-200 rounded px-1.5 py-0.5 text-xs text-blue-700">
                    <span className="text-blue-400">{step.label}:</span> {step.node}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-blue-600">
            {traverseResult.lbi_domains_activated?.length > 0 && (
              <span>Domains: {traverseResult.lbi_domains_activated.map((d: any) => d.label).join(', ')}</span>
            )}
            {traverseResult.recommended_interventions?.length > 0 && (
              <span>Interventions: {traverseResult.recommended_interventions.map((d: any) => d.label).join(', ')}</span>
            )}
          </div>
        </div>
      )}

      {/* Main content: graph + sidebar */}
      <div className="flex flex-1 min-h-0 gap-0 border rounded-xl overflow-hidden shadow-sm">
        {/* Canvas */}
        <div className="flex-1 bg-gray-50 relative" ref={containerRef}>
          {graphQ.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              Loading graph data…
            </div>
          )}
          {graphQ.isError && (
            <div className="absolute inset-0 flex items-center justify-center text-red-400">
              Failed to load graph. Is the backend running?
            </div>
          )}
          {graphQ.data?.nodes?.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
              <p>No graph nodes found.</p>
              <p className="text-xs">Use the LDE Intelligence Engine tab to seed the graph first.</p>
            </div>
          )}
          <svg
            ref={svgRef}
            width={svgSize.w}
            height={svgSize.h}
            style={{ display: 'block', cursor: draggingPan.current ? 'grabbing' : 'grab' }}
            onMouseDown={onSvgMouseDown}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={onSvgMouseUp}
            onClick={onSvgClick}
            onWheel={onWheel}
          />
          {/* Zoom hint */}
          <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white/80 rounded px-2 py-1 border">
            Scroll to zoom · Drag canvas to pan · Click node for details
          </div>
        </div>

        {/* Sidebar */}
        {selectedNode && (
          <NodeDetail
            node={selectedNode}
            edges={edgesRef.current}
            allNodes={nodesRef.current}
            onClose={() => { setSelectedNode(null); highlightedRef.current = new Set(); traversalEdgeIdsRef.current = new Set(); }}
          />
        )}
      </div>
    </div>
  );
}
