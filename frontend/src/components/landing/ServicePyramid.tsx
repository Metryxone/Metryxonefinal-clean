import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Layers,
  GraduationCap,
  Briefcase,
  Users,
  Building2,
  Target,
  Compass,
  Sparkles,
} from "lucide-react";
import type { Screen } from "../../App";

interface ServicePyramidProps {
  onNavigate: (screen: Screen | string) => void;
}

type NodeId =
  | "core"
  | "lbi"
  | "competency"
  | "examready"
  | "schools"
  | "coaching"
  | "campus"
  | "mentor"
  | "career"
  | "enterprise";

interface PyramidNode {
  id: NodeId;
  label: string;
  sub?: string;
  Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  tier: 1 | 2 | 3;
  /** % from left of pyramid frame (0 - 100) */
  x: number;
  /** % from top of pyramid frame (0 - 100) */
  y: number;
  navigate?: Screen;
  accent?: "blue" | "teal" | "indigo";
}

const NODES: PyramidNode[] = [
  // Tier 1 — apex
  { id: "core",       label: "MetryxOne Intelligence",     sub: "AI · 19 Domains · 97 Subdomains",  Icon: Brain,       tier: 1, x: 50, y: 8,  accent: "blue"   },
  // Tier 2 — engines
  { id: "lbi",        label: "LBI™ Behavioral",            sub: "Cognitive & behavioural profiling",Icon: Layers,      tier: 2, x: 18, y: 38, accent: "teal",   navigate: "lbi-product" },
  { id: "competency", label: "Competency Intelligence",    sub: "50 competencies · 7 industries",   Icon: Target,      tier: 2, x: 50, y: 38, accent: "indigo", navigate: "intelligence-frameworks" },
  { id: "examready",  label: "ExamReady™",                 sub: "Cognitive readiness scoring",      Icon: Sparkles,    tier: 2, x: 82, y: 38, accent: "teal",   navigate: "exam-ready" },
  // Tier 3 — outcomes / markets
  { id: "schools",    label: "Schools",                    Icon: GraduationCap, tier: 3, x:  8,  y: 78, accent: "blue",   navigate: "k12-schools" },
  { id: "coaching",   label: "Coaching",                   Icon: Compass,       tier: 3, x: 25,  y: 78, accent: "teal",   navigate: "coaching" },
  { id: "campus",     label: "Campus Hiring",              Icon: Briefcase,     tier: 3, x: 42,  y: 78, accent: "indigo", navigate: "campus-recruit" },
  { id: "mentor",     label: "Mentor Network",             Icon: Users,         tier: 3, x: 58,  y: 78, accent: "teal",   navigate: "mentor-marketplace" },
  { id: "career",     label: "Career Builder",             Icon: Compass,       tier: 3, x: 75,  y: 78, accent: "blue",   navigate: "career-builder" },
  { id: "enterprise", label: "Enterprise",                 Icon: Building2,     tier: 3, x: 92,  y: 78, accent: "indigo", navigate: "enterprise-hiring" },
];

// Connections — parent → child relationships
const EDGES: Array<[NodeId, NodeId]> = [
  ["core", "lbi"],
  ["core", "competency"],
  ["core", "examready"],
  ["lbi", "schools"],
  ["lbi", "coaching"],
  ["competency", "campus"],
  ["competency", "mentor"],
  ["competency", "enterprise"],
  ["examready", "career"],
  ["examready", "campus"],
];

const ACCENT = {
  blue:   { fill: "#0B3C5D", glow: "rgba(11,60,93,0.55)",  stroke: "rgba(11,60,93,0.35)"  },
  teal:   { fill: "#4ECDC4", glow: "rgba(78,205,196,0.55)", stroke: "rgba(78,205,196,0.35)" },
  indigo: { fill: "#6366F1", glow: "rgba(99,102,241,0.55)", stroke: "rgba(99,102,241,0.35)" },
} as const;

export function ServicePyramid({ onNavigate }: ServicePyramidProps) {
  const [hovered, setHovered] = useState<NodeId | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.9, delay: 0.2 }}
      className="relative w-full"
      style={{ minHeight: 540 }}
      data-testid="service-pyramid"
    >
      {/* Glass frame */}
      <div
        className="relative w-full h-full rounded-3xl overflow-hidden"
        style={{
          minHeight: 540,
          background:
            "linear-gradient(135deg, rgba(11,60,93,0.06), rgba(78,205,196,0.04) 60%, rgba(99,102,241,0.05))",
          border: "1px solid rgba(78,205,196,0.18)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.04)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Soft radial glow centre */}
        <div
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            inset: "10% 15%",
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(78,205,196,0.18), transparent 65%)",
            filter: "blur(20px)",
          }}
        />

        {/* Caption */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase"
             style={{ backgroundColor: "rgba(78,205,196,0.10)", color: "var(--accent-cyan)", border: "1px solid rgba(78,205,196,0.25)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#4ECDC4" }} />
          How our services connect
        </div>

        {/* SVG layer for edges */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="edge-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#4ECDC4" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0B3C5D" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {EDGES.map(([fromId, toId], i) => {
            const a = NODES.find(n => n.id === fromId)!;
            const b = NODES.find(n => n.id === toId)!;
            return (
              <g key={`${fromId}-${toId}-${i}`}>
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="url(#edge-grad)"
                  strokeWidth={0.35}
                  strokeOpacity={0.85}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Animated flow dash overlay */}
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="#4ECDC4"
                  strokeWidth={0.45}
                  strokeOpacity={0.9}
                  strokeDasharray="1.2 3"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    animation: `mx-edge-flow 3.5s linear infinite`,
                    animationDelay: `${i * 0.25}s`,
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {NODES.map((node, idx) => {
          const accent = ACCENT[node.accent ?? "blue"];
          const isActive = hovered === node.id;
          const sizeClass =
            node.tier === 1 ? "px-4 py-3" :
            node.tier === 2 ? "px-3.5 py-2.5" :
                              "px-2.5 py-2";
          const iconSize = node.tier === 1 ? 22 : node.tier === 2 ? 18 : 14;
          return (
            <motion.button
              key={node.id}
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.25 + idx * 0.06 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => node.navigate && onNavigate(node.navigate)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl flex items-center gap-2 shrink-0 ${sizeClass}`}
              style={{
                left: `${node.x}%`,
                top:  `${node.y}%`,
                background:
                  node.tier === 1
                    ? `linear-gradient(135deg, ${accent.fill} 0%, #1a5f8a 100%)`
                    : "var(--bg-secondary)",
                color: node.tier === 1 ? "#fff" : "var(--text-primary)",
                border: `1px solid ${isActive ? accent.fill : "var(--border-subtle)"}`,
                boxShadow: isActive
                  ? `0 8px 24px ${accent.glow}, 0 0 0 3px ${accent.stroke}`
                  : node.tier === 1
                    ? `0 10px 24px ${accent.glow}`
                    : "0 2px 10px rgba(0,0,0,0.10)",
                cursor: node.navigate ? "pointer" : "default",
                whiteSpace: "nowrap",
                fontFamily: "'Inter', sans-serif",
                transition: "box-shadow 0.25s ease, border-color 0.25s ease",
                zIndex: isActive ? 5 : 2,
              }}
              data-testid={`pyramid-node-${node.id}`}
            >
              {/* Pulse ring on apex */}
              {node.tier === 1 && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    border: `1px solid ${accent.stroke}`,
                    animation: "mx-pulse-ring 2.4s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
                  }}
                />
              )}
              <span
                className="rounded-md flex items-center justify-center shrink-0"
                style={{
                  width: iconSize + 10,
                  height: iconSize + 10,
                  background:
                    node.tier === 1 ? "rgba(255,255,255,0.18)" : `${accent.fill}1F`,
                  color: node.tier === 1 ? "#fff" : accent.fill,
                }}
              >
                <node.Icon size={iconSize} />
              </span>
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span
                  className={node.tier === 1 ? "text-sm font-semibold" : node.tier === 2 ? "text-xs font-semibold" : "text-[11px] font-semibold"}
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {node.label}
                </span>
                {node.sub && (
                  <span
                    className="text-[10px] leading-tight"
                    style={{ color: node.tier === 1 ? "rgba(255,255,255,0.78)" : "var(--text-muted)" }}
                  >
                    {node.sub}
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}

        {/* Footer hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] tracking-wide flex items-center gap-1.5"
             style={{ color: "var(--text-muted)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#4ECDC4" }} />
          One unified intelligence layer · click any service to explore
        </div>
      </div>

      {/* Local CSS animations */}
      <style>{`
        @keyframes mx-edge-flow {
          0%   { stroke-dashoffset: 0;   }
          100% { stroke-dashoffset: -12; }
        }
        @keyframes mx-pulse-ring {
          0%   { transform: scale(1);    opacity: 0.7; }
          70%  { transform: scale(1.18); opacity: 0;   }
          100% { transform: scale(1);    opacity: 0;   }
        }
      `}</style>
    </motion.div>
  );
}

export default ServicePyramid;
