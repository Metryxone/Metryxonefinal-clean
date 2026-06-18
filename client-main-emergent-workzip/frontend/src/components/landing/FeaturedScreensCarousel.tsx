import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  CheckCircle,
  Layers,
  Target,
  Sparkles,
  Briefcase,
  Users,
  Compass,
} from "lucide-react";
import type { Screen } from "../../App";

interface FeaturedScreensCarouselProps {
  onNavigate: (screen: Screen | string) => void;
}

type ScreenKind =
  | "lbi"
  | "competency"
  | "examready"
  | "career"
  | "workforce"
  | "mentor";

interface FeaturedScreen {
  id: ScreenKind;
  badge: string;
  title: string;
  caption: string;
  features: string[];
  navigate: Screen;
  accent: string;
  Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  Mock: React.ComponentType<{ accent: string }>;
}

/* ── Mock dashboard screens (pure SVG/CSS) ───────────────────────────────── */

function RadarMock({ accent }: { accent: string }) {
  const cx = 110, cy = 95, r = 70;
  const axes = [0, 60, 120, 180, 240, 300];
  const pts1 = [0.85, 0.6, 0.78, 0.92, 0.55, 0.7];
  const pts2 = [0.55, 0.75, 0.5, 0.6, 0.8, 0.45];
  const toXY = (deg: number, ratio: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + Math.cos(rad) * r * ratio, cy + Math.sin(rad) * r * ratio];
  };
  const path = (vals: number[]) =>
    vals.map((v, i) => toXY(axes[i], v).join(",")).join(" ");
  return (
    <svg viewBox="0 0 220 200" className="w-full h-full">
      {[0.25, 0.5, 0.75, 1].map((rr, i) => (
        <polygon
          key={i}
          points={axes.map(a => toXY(a, rr).join(",")).join(" ")}
          fill="none"
          stroke="rgba(148,163,184,0.25)"
          strokeWidth="1"
        />
      ))}
      {axes.map((a, i) => {
        const [x, y] = toXY(a, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />;
      })}
      <motion.polygon
        points={path(pts2)}
        fill="rgba(99,102,241,0.18)"
        stroke="#6366F1"
        strokeWidth="1.5"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.polygon
        points={path(pts1)}
        fill={`${accent}33`}
        stroke={accent}
        strokeWidth="1.8"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.1 }}
      />
      {pts1.map((v, i) => {
        const [x, y] = toXY(axes[i], v);
        return <circle key={i} cx={x} cy={y} r="3" fill={accent} />;
      })}
    </svg>
  );
}

function BarsMock({ accent }: { accent: string }) {
  const bars = [62, 78, 45, 88, 70, 55, 92, 38, 74, 60, 81, 49];
  return (
    <svg viewBox="0 0 220 200" className="w-full h-full">
      {[40, 80, 120, 160].map(y => (
        <line key={y} x1="20" y1={y} x2="210" y2={y} stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
      ))}
      {bars.map((h, i) => {
        const x = 22 + i * 16;
        const barH = (h / 100) * 130;
        const y = 170 - barH;
        const gap = h < 50;
        return (
          <motion.rect
            key={i}
            x={x}
            width="10"
            initial={{ height: 0, y: 170 }}
            animate={{ height: barH, y }}
            transition={{ duration: 0.7, delay: i * 0.05 }}
            fill={gap ? "rgba(244,63,94,0.7)" : accent}
            rx="2"
          />
        );
      })}
      <line x1="20" y1="170" x2="210" y2="170" stroke="rgba(148,163,184,0.5)" strokeWidth="1" />
    </svg>
  );
}

function ScoreMock({ accent }: { accent: string }) {
  const r = 56, c = 2 * Math.PI * r;
  const pct = 0.78;
  return (
    <svg viewBox="0 0 220 200" className="w-full h-full">
      <circle cx="110" cy="100" r={r} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="10" />
      <motion.circle
        cx="110" cy="100" r={r}
        fill="none"
        stroke={accent}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        transform="rotate(-90 110 100)"
      />
      <text x="110" y="98" textAnchor="middle" fill="currentColor" fontSize="28" fontWeight="700">78</text>
      <text x="110" y="118" textAnchor="middle" fill="currentColor" fontSize="10" opacity="0.55">EXAM READINESS</text>
      <motion.path
        d="M30,170 L60,150 L90,158 L120,140 L150,148 L180,128 L210,135"
        stroke={accent}
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, delay: 0.4 }}
      />
    </svg>
  );
}

function CareerMock({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 220 200" className="w-full h-full">
      <motion.path
        d="M20,170 C60,170 60,100 110,100 S160,30 200,30"
        stroke={accent}
        strokeWidth="2.2"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4 }}
      />
      <motion.path
        d="M110,100 C140,100 150,140 200,140"
        stroke="#6366F1"
        strokeWidth="1.6"
        strokeDasharray="4 3"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, delay: 0.3 }}
      />
      {[
        { x: 20, y: 170, label: "Now" },
        { x: 110, y: 100, label: "Year 2" },
        { x: 200, y: 30,  label: "Goal" },
        { x: 200, y: 140, label: "Alt" },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="6" fill={accent} />
          <circle cx={p.x} cy={p.y} r="11" fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="1" />
          <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.7">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function HeatmapMock({ accent }: { accent: string }) {
  const cols = 12, rows = 6;
  const cells = Array.from({ length: rows * cols }, (_, i) => {
    const v = Math.abs(Math.sin(i * 1.7) * 0.7 + Math.cos(i * 0.9) * 0.3);
    return Math.min(1, Math.max(0.1, v));
  });
  return (
    <svg viewBox="0 0 220 200" className="w-full h-full">
      {cells.map((v, i) => {
        const r = i % cols;
        const c = Math.floor(i / cols);
        return (
          <motion.rect
            key={i}
            x={14 + r * 16}
            y={20 + c * 26}
            width="13"
            height="22"
            rx="2"
            fill={accent}
            initial={{ opacity: 0 }}
            animate={{ opacity: v }}
            transition={{ duration: 0.45, delay: (i % cols) * 0.04 }}
          />
        );
      })}
    </svg>
  );
}

function MentorMock({ accent }: { accent: string }) {
  const avatars = [
    { x: 30, y: 50, c: accent },
    { x: 90, y: 35, c: "#6366F1" },
    { x: 150, y: 50, c: "#0B3C5D" },
    { x: 50, y: 110, c: "#6366F1" },
    { x: 110, y: 100, c: accent },
    { x: 170, y: 115, c: "#0B3C5D" },
    { x: 90, y: 165, c: accent },
  ];
  return (
    <svg viewBox="0 0 220 200" className="w-full h-full">
      {avatars.map((a, i) => (
        <g key={i}>
          <motion.circle
            cx={a.x} cy={a.y} r="18"
            fill={`${a.c}22`}
            stroke={a.c}
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.45, delay: i * 0.07 }}
          />
          <circle cx={a.x} cy={a.y - 4} r="6" fill={a.c} opacity="0.85" />
          <rect x={a.x - 9} y={a.y + 3} width="18" height="9" rx="4" fill={a.c} opacity="0.85" />
        </g>
      ))}
      {[
        [0, 4], [1, 4], [4, 5], [3, 4], [4, 6], [5, 6], [2, 5],
      ].map(([i, j], k) => (
        <line
          key={k}
          x1={avatars[i].x} y1={avatars[i].y}
          x2={avatars[j].x} y2={avatars[j].y}
          stroke={accent}
          strokeOpacity="0.25"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

const SCREENS: FeaturedScreen[] = [
  {
    id: "lbi",
    badge: "Behavioral Intelligence",
    title: "LBI™ Profile Report",
    caption: "19 domains · 97 subdomains · radar-mapped against age cohorts.",
    features: [
      "Cognitive readiness across 19 domains",
      "Stress, focus & decision-style signals",
      "Cohort-benchmarked recommendations",
      "Privacy-first, DPDP & FERPA aligned",
    ],
    navigate: "lbi-product",
    accent: "#4ECDC4",
    Icon: Layers,
    Mock: RadarMock,
  },
  {
    id: "competency",
    badge: "Competency Intelligence",
    title: "Competency Gap Analysis",
    caption: "50 competencies × 7 industries — gap-flagged in red, strengths in teal.",
    features: [
      "Role-weighted Employability Index",
      "Industry-norm percentile bands",
      "AI-drafted assessment items",
      "IDP recommendations per gap",
    ],
    navigate: "intelligence-frameworks",
    accent: "#6366F1",
    Icon: Target,
    Mock: BarsMock,
  },
  {
    id: "examready",
    badge: "ExamReady™",
    title: "Cognitive Readiness Score",
    caption: "Your child's readiness in <2 seconds — with stress & pacing trend lines.",
    features: [
      "Board-aligned blueprints",
      "Stress + accuracy + speed combined",
      "Trend tracking across attempts",
      "Parent-friendly explainer reports",
    ],
    navigate: "exam-ready",
    accent: "#0B3C5D",
    Icon: Sparkles,
    Mock: ScoreMock,
  },
  {
    id: "career",
    badge: "Career Builder",
    title: "Career Path Simulator",
    caption: "Model real-world career paths from current cognitive & competency profile.",
    features: [
      "Role-transition fit scoring",
      "Alternate-path simulation",
      "Skill gap → learning plan",
      "Mentor + course recommendations",
    ],
    navigate: "career-builder",
    accent: "#4ECDC4",
    Icon: Compass,
    Mock: CareerMock,
  },
  {
    id: "workforce",
    badge: "Workforce Analytics",
    title: "Team Capability Heatmap",
    caption: "Team-by-skill heatmap — leadership, adaptability & culture-fit signals.",
    features: [
      "Org-wide competency density",
      "Bench-strength & succession views",
      "Leadership pipeline forecasting",
      "L&D ROI tracking",
    ],
    navigate: "workforce-analytics",
    accent: "#0B3C5D",
    Icon: Briefcase,
    Mock: HeatmapMock,
  },
  {
    id: "mentor",
    badge: "Mentor Marketplace",
    title: "Verified Mentor Network",
    caption: "Behaviour-aligned matching across 1,200+ certified mentors and coaches.",
    features: [
      "Behaviour + goal-aligned matching",
      "Background-verified mentors",
      "Bookings, agreements & escrow",
      "Live video sessions in-app",
    ],
    navigate: "mentor-marketplace",
    accent: "#6366F1",
    Icon: Users,
    Mock: MentorMock,
  },
];

export function FeaturedScreensCarousel({ onNavigate }: FeaturedScreensCarouselProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [openId, setOpenId] = useState<ScreenKind | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Auto-advance the active dot
  useEffect(() => {
    if (isPaused || openId) return;
    const t = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % SCREENS.length);
    }, 3500);
    return () => clearInterval(t);
  }, [isPaused, openId]);

  // Scroll the active card into view smoothly
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(`[data-screen-idx="${activeIdx}"]`);
    if (card) {
      el.scrollTo({
        left: card.offsetLeft - 24,
        behavior: "smooth",
      });
    }
  }, [activeIdx]);

  const openScreen = useMemo(
    () => SCREENS.find(s => s.id === openId) ?? null,
    [openId],
  );

  return (
    <section
      id="featured-screens"
      className="relative py-10 overflow-hidden"
      style={{ backgroundColor: "transparent" }}
      data-testid="featured-screens-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container mx-auto px-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-5">
          <div>
            <span
              className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-2"
              style={{ backgroundColor: "rgba(78,205,196,0.12)", color: "var(--accent-cyan)", border: "1px solid rgba(78,205,196,0.25)" }}
            >
              Featured product screens
            </span>
            <h2 className="text-2xl md:text-3xl font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
              See the products in action
            </h2>
            <p className="text-sm mt-1 max-w-xl" style={{ color: "var(--text-secondary)" }}>
              Click any screen for a full preview, key features and a direct path to explore.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#4ECDC4" }} />
            Auto-scrolling · pauses on hover
          </div>
        </div>

        {/* Track */}
        <div
          ref={trackRef}
          className="flex gap-5 overflow-x-auto pb-3 scroll-smooth"
          style={{ scrollbarWidth: "thin" }}
        >
          {SCREENS.map((s, i) => (
            <motion.button
              key={s.id}
              data-screen-idx={i}
              data-testid={`featured-screen-${s.id}`}
              onClick={() => setOpenId(s.id)}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="relative shrink-0 w-[320px] md:w-[360px] rounded-2xl text-left overflow-hidden cursor-pointer"
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: `1px solid ${i === activeIdx ? s.accent : "var(--border-subtle)"}`,
                boxShadow:
                  i === activeIdx
                    ? `0 18px 40px ${s.accent}33, 0 0 0 1px ${s.accent}55`
                    : "0 6px 18px rgba(0,0,0,0.10)",
                transition: "box-shadow 0.3s ease, border-color 0.3s ease",
              }}
            >
              {/* Top: chrome bar + badge */}
              <div
                className="flex items-center justify-between px-4 py-2 border-b"
                style={{ borderColor: "var(--border-subtle)", backgroundColor: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FF6058" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FFBC2E" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#27C940" }} />
                </div>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: `${s.accent}1F`, color: s.accent }}
                >
                  <s.Icon size={10} />
                  {s.badge}
                </span>
              </div>

              {/* Mock visual */}
              <div
                className="relative w-full"
                style={{
                  height: 200,
                  background:
                    "linear-gradient(180deg, rgba(11,60,93,0.05) 0%, rgba(78,205,196,0.04) 100%)",
                  color: "var(--text-primary)",
                }}
              >
                <s.Mock accent={s.accent} />
              </div>

              {/* Caption */}
              <div className="px-4 py-3">
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}
                >
                  {s.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {s.caption}
                </p>
                <span
                  className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold"
                  style={{ color: s.accent }}
                >
                  Open preview <ArrowRight size={12} />
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {SCREENS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveIdx(i)}
              data-testid={`featured-dot-${s.id}`}
              aria-label={`Go to ${s.title}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === activeIdx ? 28 : 8,
                backgroundColor: i === activeIdx ? s.accent : "var(--border-subtle)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent
          className="max-w-3xl p-0 overflow-hidden"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-subtle)" }}
          data-testid="featured-screen-modal"
        >
          {openScreen && (
            <>
              <div
                className="relative w-full"
                style={{
                  height: 280,
                  background:
                    "linear-gradient(135deg, rgba(11,60,93,0.06), rgba(78,205,196,0.06))",
                  borderBottom: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                <openScreen.Mock accent={openScreen.accent} />
                <span
                  className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: `${openScreen.accent}1F`, color: openScreen.accent }}
                >
                  <openScreen.Icon size={11} />
                  {openScreen.badge}
                </span>
              </div>
              <div className="p-6">
                <DialogHeader>
                  <DialogTitle
                    className="text-xl font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {openScreen.title}
                  </DialogTitle>
                  <DialogDescription style={{ color: "var(--text-secondary)" }}>
                    {openScreen.caption}
                  </DialogDescription>
                </DialogHeader>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {openScreen.features.map(f => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <CheckCircle size={14} className="mt-0.5 shrink-0" style={{ color: openScreen.accent }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 mt-5">
                  <button
                    onClick={() => {
                      onNavigate(openScreen.navigate);
                      setOpenId(null);
                    }}
                    data-testid={`featured-modal-explore-${openScreen.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                    style={{
                      backgroundColor: openScreen.accent,
                      color: "#fff",
                      boxShadow: `0 8px 18px ${openScreen.accent}55`,
                    }}
                  >
                    Explore {openScreen.badge}
                    <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("request-demo");
                      setOpenId(null);
                    }}
                    data-testid={`featured-modal-demo-${openScreen.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                    style={{
                      backgroundColor: "transparent",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    Request a demo
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default FeaturedScreensCarousel;
