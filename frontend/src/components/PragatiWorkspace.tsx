import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowRight, Sparkles, Brain, TrendingUp, Shield,
  ChevronRight, Layers, Zap, RefreshCw, BarChart3,
  AlertCircle, CheckCircle2, Lightbulb, Compass, Heart,
  AlertTriangle, History, Activity, Info, Globe, Zap as ZapIcon, BookOpen,
} from "lucide-react";

import { writePragatiHandoff } from "@/lib/pragatiBridge";

type SessionMode = "standard" | "quick_clarity" | "deep_reflection";

// ─── Types ──────────────────────────────────────────────────────────────────
type BlockType =
  | "reflection" | "question" | "bridge" | "insight"
  | "reassurance" | "pattern_detection" | "progression" | "closure"
  | "curiosity_report";
type EmotionalTone = "gentle" | "reflective" | "observational" | "supportive";

interface CuriosityReportData {
  coreConcern: string;
  emotionalSignals: string[];
  behaviouralEffects: string[];
  severityLevel: "low" | "moderate" | "high";
  hiddenPattern: string;
  insightBridge: string;
}

interface ConversationBlock {
  id: string;
  type: BlockType;
  content: string;
  emotionalTone?: EmotionalTone;
  signalMappings?: string[];
  pacing?: { speed: string; delayMs: number };
  reportData?: CuriosityReportData;
}

interface DetectedPattern {
  id: string;
  label: string;
  description: string;
  confidence: number;
  signals: string[];
  category: "pattern" | "intervention" | "insight";
  type?: string;
  intensity?: "low" | "moderate" | "high";
  detection_basis?: string[];
  concern_family?: string;
}

interface QualityScore {
  engagement_depth: number;
  emotional_resonance: number;
  pattern_clarity: number;
  session_depth: number;
  total: number;
}

interface DriftResult {
  direction: "worsening" | "stabilizing" | "recovering" | "improving" | "new_session";
  description: string;
  confidence: number;
}

interface PragatiMsg {
  id: string;
  role: "pragati" | "user";
  block?: ConversationBlock;
  text?: string;
}

interface PragatiWorkspaceProps {
  onNavigate?: (screen: string) => void;
  open: boolean;
  onClose: () => void;
  onStartAssessment?: (concern?: string) => void;
  initialConcern?: string;
  initialEmail?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STAGES = [
  { key: "CURIOSITY", label: "Curiosity",  color: "#3B82F6" },
  { key: "INSIGHT",   label: "Insight",    color: "#8B5CF6" },
  { key: "GROWTH",    label: "Growth",     color: "#10B981" },
  { key: "MASTERY",   label: "Mastery",    color: "#F59E0B" },
];

const DRIFT_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  worsening:   { color: "#EF4444", icon: TrendingUp,    label: "Signal intensity increasing" },
  stabilizing: { color: "#F59E0B", icon: Activity,      label: "Pattern stable" },
  recovering:  { color: "#10B981", icon: TrendingUp,    label: "Signals recovering" },
  improving:   { color: "#3B82F6", icon: TrendingUp,    label: "Positive shift detected" },
  new_session: { color: "#94A3B8", icon: Activity,      label: "First session" },
};

// ─── Block visual config ─────────────────────────────────────────────────────
const BLOCK_STYLE: Record<BlockType, {
  bg: string; border: string; textColor: string;
  italic?: boolean; small?: boolean; icon?: React.ElementType; label?: string;
}> = {
  reflection:       { bg: "#FAFAFA",    border: "#E2E8F0", textColor: "#334155", italic: true },
  bridge:           { bg: "transparent",border: "transparent", textColor: "#64748B", small: true },
  question:         { bg: "#FFFFFF",    border: "#E2E8F0", textColor: "#1E293B" },
  insight:          { bg: "#F0F9FF",    border: "#BAE6FD", textColor: "#0369A1", icon: Lightbulb, label: "Insight" },
  reassurance:      { bg: "#F0FDF4",    border: "#BBF7D0", textColor: "#15803D", icon: Heart,     label: "Worth knowing" },
  pattern_detection:{ bg: "#FFFBEB",    border: "#FDE68A", textColor: "#92400E", icon: AlertCircle, label: "Something taking shape" },
  progression:      { bg: "#F5F3FF",    border: "#DDD6FE", textColor: "#5B21B6", icon: Compass,   label: "A shift" },
  closure:          { bg: "#F8FAFC",    border: "#CBD5E1", textColor: "#0f172a", icon: CheckCircle2, label: "Journey Complete" },
};

const INTENSITY_COLOR: Record<string, string> = {
  high: "#EF4444", moderate: "#F59E0B", low: "#10B981",
};

const INTERVENTION_ICON: Record<string, React.ElementType> = {
  cognitive_reframing: Brain,    burnout_recovery: RefreshCw,
  emotional_regulation: Shield,  focus_stabilization: Zap,
  momentum_rebuilding: TrendingUp, load_management: Layers,
  identity_work: Sparkles,       self_awareness: BarChart3,
  meaning_making: Heart,         boundary_setting: Shield,
};

const SESSION_KEY  = "pragati_active_session";
const LANG_KEY     = "pragati_preferred_lang";

// ─── Language-aware UI copy ───────────────────────────────────────────────────
function uiCopy(lang: string) {
  if (lang === "hi" || lang === "hi_en") return {
    placeholder:    "Jo bhi chal raha hai, bata sakte ho…",
    entryPlaceholder: "Aaj kya mushkil lag raha hai?",
    langPrompt:     "Aaj kaunsi bhasha comfortable lagti hai?",
    completeCta:    "Poora CAPADEX Assessment Shuru Karein",
    langHint:       "Aap kisi bhi bhasha mein type kar sakte ho",
  };
  if (lang === "te" || lang === "te_en") return {
    placeholder:    "Meeru emi cheppaalanna, share cheyyavachchu…",
    entryPlaceholder: "Ippudu ela feel avutunnaru?",
    langPrompt:     "Ee rojy meeru elaa comfortable ga feel avutunnaru?",
    completeCta:    "Poorna CAPADEX Assessment Praarabhinchandi",
    langHint:       "Meeru ee notlo typee cheyyavachchu",
  };
  if (lang === "ta") return {
    placeholder:    "Enna-vo pesanum-nu irundha, share pannalaam…",
    entryPlaceholder: "Ippo enna kastam-a irukku?",
    langPrompt:     "Inru enna mol comfortable-a irukkudhu?",
    completeCta:    "Poorna CAPADEX Assessment Thoda-nguvom",
    langHint:       "Neenga yendha molilayum type pannalaam",
  };
  return {
    placeholder:    "Share what's been on your mind…",
    entryPlaceholder: "What's been feeling difficult lately?",
    langPrompt:     "What feels most comfortable today?",
    completeCta:    "Begin Full CAPADEX Assessment",
    langHint:       "There's no right or wrong way · You can type in any language",
  };
}

// ─── Typing indicator ────────────────────────────────────────────────────────
function TypingIndicator({ speed = "medium" }: { speed?: string }) {
  const dur = speed === "slow" ? 1.4 : speed === "fast" ? 0.7 : 1;
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
           style={{ background: "#0B3C5D" }}>
        <Sparkles size={13} color="#fff" />
      </div>
      <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm"
           style={{ background: "#F1F5F9", border: "1px solid #E2E8F0" }}>
        {[0, 1, 2].map(i => (
          <motion.span key={i} className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#94A3B8" }}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: dur, repeat: Infinity, delay: i * 0.22 }} />
        ))}
      </div>
    </div>
  );
}

// ─── Report section eyebrow — mirrors CapadexReportPhase section chrome ────────
function ReportEyebrow({ label, color = "#344E86" }: { label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div className="rounded-full shrink-0" style={{ width: 3, height: 13, backgroundColor: color }} />
      <span className="text-[10.5px] font-black uppercase" style={{ color, letterSpacing: "0.14em" }}>{label}</span>
    </div>
  );
}

// ─── CuriosityReport card ─────────────────────────────────────────────────────
// Mirrors the CAPADEX Curiosity report theme (CapadexReportPhase): navy brand
// palette, Plus Jakarta type, ring gauge + level pill, navy-bar section eyebrows
// and callout boxes. The report's score ring means capability (higher = better),
// but this summary's intensity means concern load (higher = worse) — so the gauge
// keeps intensity-correct colours (low = green, high = red) rather than the
// report's capability bands.
function CuriosityReportCard({ block }: { block: ConversationBlock }) {
  const r = block.reportData;
  if (!r) return null;

  // Report brand palette (mirrors CapadexReportPhase `B`)
  const B = {
    navy: "#344E86", navyBg: "#EEF2FA", navyBorder: "#D4DBF0",
    textMid: "#4A5568", textMuted: "#94A3B8",
    amberBg: "#FFFBEB", amberBorder: "#FDE68A", amberText: "#78350F",
    redBg: "#FEF2F2", redBorder: "#FECACA", redText: "#991B1B",
    violet: "#7C3AED", violetBg: "#F5F3FF", violetBorder: "#DDD6FE", violetText: "#4C1D95",
  };
  const FONT = "'Plus Jakarta Sans','DM Sans',sans-serif";

  const loadPct  = r.severityLevel === "high" ? 80 : r.severityLevel === "moderate" ? 50 : 25;
  const loadCol  = r.severityLevel === "high" ? "#DC2626" : r.severityLevel === "moderate" ? "#D97706" : "#059669";
  const loadLbl  = { high: "High", moderate: "Moderate", low: "Mild" }[r.severityLevel];
  const cleanTag = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const circ   = 2 * Math.PI * 28;
  const filled = (circ * loadPct / 100).toFixed(2);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="mb-4 rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${B.navyBorder}`, background: "#fff", fontFamily: FONT }}>
      {/* ── Hero: intensity ring + concern ── */}
      <div className="px-4 pt-4 pb-4" style={{ borderBottom: "1px solid #E8EBF4" }}>
        <p className="text-[10px] font-black uppercase mb-3" style={{ color: B.textMuted, letterSpacing: "0.16em" }}>
          Behavioural Clarity Summary
        </p>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <svg width="76" height="76" viewBox="0 0 84 84" role="img"
                 aria-label={`${loadLbl} concern intensity — a developmental signal, not a clinical or capability score. Higher means greater intensity.`}>
              <circle cx="42" cy="42" r="34" fill="none" stroke={`${loadCol}12`} strokeWidth="10" />
              <circle cx="42" cy="42" r="28" fill="#F8F9FB" stroke="#E8EBF4" strokeWidth="8" />
              <motion.circle cx="42" cy="42" r="28" fill="none" stroke={loadCol} strokeWidth="8"
                strokeLinecap="round" transform="rotate(-90 42 42)"
                initial={{ strokeDasharray: `0 ${circ.toFixed(2)}` }}
                animate={{ strokeDasharray: `${filled} ${circ.toFixed(2)}` }}
                transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${loadCol}50)` }} />
              <text x="42" y="40" textAnchor="middle" fill="#111827" fontSize="18" fontWeight="800" fontFamily={FONT}>{loadPct}</text>
              <text x="42" y="52" textAnchor="middle" fill="#9CA3AF" fontSize="9" fontFamily={FONT}>/100</text>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 mb-1.5"
                 style={{ backgroundColor: `${loadCol}12`, border: `1px solid ${loadCol}30` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: loadCol }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: loadCol }}>{loadLbl} intensity</span>
            </div>
            <p className="text-[18px] font-bold leading-tight capitalize" style={{ color: "#111827", letterSpacing: "-0.01em" }}>
              {cleanTag(r.coreConcern)}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>Clarity Journey · Curiosity stage</p>
            <p className="text-[10px] mt-1 leading-snug" style={{ color: "#B8C0CE" }}>Intensity index — a developmental signal, not a clinical score</p>
          </div>
        </div>
      </div>

      {/* ── Signals, effects + callouts ── */}
      <div className="px-4 py-4 space-y-4">
        {/* Emotional signals */}
        <div>
          <ReportEyebrow label="Emotional signals" />
          <div className="flex flex-wrap gap-1.5">
            {r.emotionalSignals.map((s, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                    style={{ background: B.amberBg, color: B.amberText, border: `1px solid ${B.amberBorder}` }}>
                {cleanTag(s)}
              </span>
            ))}
          </div>
        </div>

        {/* Behavioural effects */}
        <div>
          <ReportEyebrow label="Behavioural effects" />
          <div className="flex flex-wrap gap-1.5">
            {r.behaviouralEffects.map((e, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                    style={{ background: B.redBg, color: B.redText, border: `1px solid ${B.redBorder}` }}>
                {cleanTag(e)}
              </span>
            ))}
          </div>
        </div>

        {/* Hidden pattern callout */}
        <div className="rounded-xl px-3.5 py-3" style={{ background: B.navyBg, border: `1px solid ${B.navyBorder}` }}>
          <ReportEyebrow label="Hidden pattern" />
          <p className="text-[12.5px] leading-relaxed" style={{ color: B.textMid }}>{r.hiddenPattern}</p>
        </div>

        {/* Insight bridge — where this goes next */}
        <div className="rounded-xl px-3.5 py-3" style={{ background: B.violetBg, border: `1px solid ${B.violetBorder}` }}>
          <ReportEyebrow label="Where this goes next" color={B.violet} />
          <div className="flex items-start gap-2">
            <ChevronRight size={13} color={B.violet} style={{ marginTop: 1, flexShrink: 0 }} />
            <p className="text-[12.5px] leading-relaxed" style={{ color: B.violetText }}>{r.insightBridge}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Block renderer ───────────────────────────────────────────────────────────
function BlockMessage({ block }: { block: ConversationBlock }) {
  if (block.type === "curiosity_report") {
    return <CuriosityReportCard block={block} />;
  }

  const style = BLOCK_STYLE[block.type] || BLOCK_STYLE.question;
  const Icon  = style.icon;

  if (block.type === "bridge") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-1 mb-2 ml-9 text-[13px]"
                  style={{ color: style.textColor }}>
        {block.content}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="flex items-start gap-2 mb-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
           style={{ background: block.type === "question" ? "#0B3C5D" : "transparent" }}>
        {block.type === "question"
          ? <Sparkles size={13} color="#fff" />
          : Icon
            ? <Icon size={14} color={style.textColor} />
            : <Sparkles size={13} color="#CBD5E1" />
        }
      </div>
      <div className={`flex-1 max-w-[84%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed ${style.italic ? "italic" : ""}`}
           style={{
             background: style.bg,
             border:     style.border !== "transparent" ? `1px solid ${style.border}` : undefined,
             color:      style.textColor,
             boxShadow:  block.type === "question" ? "0 1px 3px rgba(0,0,0,0.05)" : undefined,
           }}>
        {Icon && style.label && block.type !== "question" && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon size={11} color={style.textColor} />
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{style.label}</span>
          </div>
        )}
        {block.content}
      </div>
    </motion.div>
  );
}

// ─── User bubble ──────────────────────────────────────────────────────────────
function UserBubble({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }} className="flex justify-end mb-3">
      <div className="max-w-[76%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed"
           style={{ background: "#0B3C5D", color: "#fff" }}>
        {text}
      </div>
    </motion.div>
  );
}

// ─── Pattern card ─────────────────────────────────────────────────────────────
function PatternCard({ p, expanded = false }: { p: DetectedPattern; expanded?: boolean }) {
  const [showBasis, setShowBasis] = useState(false);
  const Icon = p.type ? (INTERVENTION_ICON[p.type] || Zap) : p.category === "pattern" ? BarChart3 : Zap;
  const dot  = INTENSITY_COLOR[p.intensity || "low"] || "#10B981";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl mb-2 last:mb-0 cursor-default"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
             style={{ background: p.category === "intervention" ? "rgba(11,60,93,0.08)" : `${dot}18` }}>
          <Icon size={15} style={{ color: p.category === "intervention" ? "#0B3C5D" : dot }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
            <p className="text-xs font-semibold" style={{ color: "#0f172a" }}>{p.label}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {p.intensity && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ background: `${dot}18`, color: dot }}>{p.intensity}</span>
              )}
              {p.confidence < 1 && (
                <span className="text-[10px]" style={{ color: "#94A3B8" }}>
                  {Math.round(p.confidence * 100)}%
                </span>
              )}
              {p.detection_basis && p.detection_basis.length > 0 && (
                <button onClick={() => setShowBasis(s => !s)}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <Info size={10} color="#94A3B8" />
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "#64748B" }}>{p.description}</p>

          {/* Explainability pills */}
          <AnimatePresence>
            {showBasis && p.detection_basis && p.detection_basis.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }} className="mt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#94A3B8" }}>
                  Detected because:
                </p>
                <div className="flex flex-wrap gap-1">
                  {p.detection_basis.map((b, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}>
                      {b}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Narrative stage label ────────────────────────────────────────────────────
function NarrativeStage({ label }: { label: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key={label}
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold"
                  style={{ background: "#F0F9FF", borderColor: "#BAE6FD", color: "#0369A1" }}>
        <Compass size={11} />
        {label}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Quality bar ──────────────────────────────────────────────────────────────
function QualityBar({ score, label, value }: { score: number; label: string; value: number }) {
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px]" style={{ color: "#94A3B8" }}>{label}</span>
        <span className="text-[10px] font-medium" style={{ color: "#64748B" }}>{value}/25</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
        <motion.div className="h-full rounded-full" style={{ background: "#3B82F6" }}
                    animate={{ width: `${(value / 25) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }} />
      </div>
    </div>
  );
}

// ─── Mode card ────────────────────────────────────────────────────────────────
interface ModeCardProps {
  onClick: () => void;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  preview: string;
  duration: string;
  recommended?: boolean;
}

function ModeCard({ onClick, accentColor, bgColor, borderColor, icon, title, subtitle, description, preview, duration, recommended }: ModeCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={{ scale: 0.985 }}
      className="w-full text-left rounded-xl transition-colors duration-150"
      style={{
        background: hovered ? bgColor : "#fff",
        border: `1.5px solid ${hovered ? borderColor : "#F1F5F9"}`,
        boxShadow: hovered ? `0 2px 12px ${accentColor}14` : "0 1px 3px rgba(0,0,0,0.04)",
        padding: "12px",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
             style={{ background: bgColor }}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[13px] font-semibold" style={{ color: "#0f172a" }}>{title}</span>
            {recommended && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ background: accentColor + "18", color: accentColor }}>
                Most used
              </span>
            )}
          </div>

          {/* Subtitle */}
          <p className="text-[12px] font-medium mb-1.5" style={{ color: accentColor }}>{subtitle}</p>

          {/* Description */}
          <p className="text-[12px] leading-relaxed mb-2" style={{ color: "#64748B" }}>
            {description}
          </p>

          {/* Conversation preview */}
          <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg"
               style={{ background: hovered ? bgColor : "#F8FAFC" }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                 style={{ background: accentColor }}>
              <Sparkles size={8} color="#fff" />
            </div>
            <p className="text-[11px] italic leading-relaxed" style={{ color: "#64748B" }}>
              "{preview}"
            </p>
          </div>

          {/* Duration — tertiary */}
          <p className="text-[10px] mt-1" style={{ color: "#CBD5E1" }}>{duration}</p>
        </div>
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════
export function PragatiWorkspace({
  open, onClose, onStartAssessment, onNavigate, initialConcern, initialEmail,
}: PragatiWorkspaceProps) {
  const [sessionId, setSessionId]           = useState<string | null>(null);
  const [msgs, setMsgs]                     = useState<PragatiMsg[]>([]);
  const [curState, setCurState]             = useState("emotional_entry");
  const [narrativeLabel, setNarrativeLabel] = useState("Mapping your growth profile");
  const [responseType, setResponseType]     = useState<"text" | "chips" | "action">("text");
  const [chips, setChips]                   = useState<string[]>([]);
  const [inputText, setInputText]           = useState("");
  const [isTyping, setIsTyping]             = useState(false);
  const [typingSpeed, setTypingSpeed]       = useState<string>("medium");
  const [isLoading, setIsLoading]           = useState(false);
  const [patterns, setPatterns]             = useState<DetectedPattern[]>([]);
  const [interventions, setInterventions]   = useState<DetectedPattern[]>([]);
  const [signalCount, setSignalCount]       = useState(0);
  const [stageIndex, setStageIndex]         = useState(0);
  const [isReturning, setIsReturning]       = useState(false);
  const [isResumed, setIsResumed]           = useState(false);
  const [primaryConcern, setPrimaryConcern] = useState<string | null>(null);
  const [isComplete, setIsComplete]         = useState(false);
  const [quality, setQuality]               = useState<QualityScore | null>(null);
  const [drift, setDrift]                   = useState<DriftResult | null>(null);
  const [isEscalated, setIsEscalated]       = useState(false);
  const [hasError, setHasError]             = useState(false);
  const [sessionMode, setSessionMode]       = useState<SessionMode>("standard");
  const [preferredLang, setPreferredLang]   = useState<string>(() => localStorage.getItem(LANG_KEY) || "en");
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [langSelectActive, setLangSelectActive] = useState(false);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const sessionStarted = useRef(false);
  const isMountedRef   = useRef(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, isTyping]);

  // Track mount state so streamBlocks never updates unmounted component
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (open && !sessionStarted.current) {
      // Defensively clear any stale streaming flags from a prior lifecycle
      setIsTyping(false);
      setIsLoading(false);
      sessionStarted.current = true;
      tryResumeOrStart();
    }
    if (!open) {
      // User exited mid-way through the conversational FSM (not a completed
      // session) — stash the little context we learned so the CAPADEX
      // assessment IntroPhase can pre-hydrate instead of starting blank.
      if (sessionStarted.current && !isComplete && (primaryConcern || patterns.length)) {
        writePragatiHandoff({
          concern: primaryConcern ?? undefined,
          concern_id: patterns[0]?.concern_family,
        });
      }
      sessionStarted.current = false;
      resetState();
    }
  }, [open]);

  function resetState() {
    setSessionId(null); setMsgs([]); setCurState("emotional_entry");
    setNarrativeLabel("Mapping your growth profile"); setPatterns([]);
    setInterventions([]); setSignalCount(0); setStageIndex(0);
    setIsComplete(false); setInputText(""); setChips([]);
    setResponseType("text"); setQuality(null); setDrift(null);
    setIsEscalated(false); setHasError(false); setIsResumed(false);
    setIsReturning(false); setSessionMode("standard");
    // FIX: always clear streaming flags so re-open never inherits stale disabled state
    setIsTyping(false); setIsLoading(false);
    setPreferredLang(localStorage.getItem(LANG_KEY) || "en");
    setShowModeSelect(false); setLangSelectActive(false);
  }

  const streamBlocks = useCallback(async (blocks: ConversationBlock[]) => {
    try {
      for (const block of blocks) {
        if (!isMountedRef.current) break;
        setIsTyping(true);
        const delay = block.pacing?.delayMs ?? 700;
        await new Promise(r => setTimeout(r, delay));
        if (!isMountedRef.current) break;
        setIsTyping(false);
        await new Promise(r => setTimeout(r, 50));
        if (!isMountedRef.current) break;
        setMsgs(prev => [...prev, { id: `${block.id}_${Date.now()}`, role: "pragati", block }]);
      }
    } catch (e) {
      console.error("[pragati] streamBlocks error:", e);
    } finally {
      // Always clear typing — no matter what happens during streaming
      if (isMountedRef.current) setIsTyping(false);
    }
  }, []);

  const tryResumeOrStart = async () => {
    console.log("[pragati] tryResumeOrStart: starting");

    // Validate sessionStorage safely — reject null, "undefined", "null", short strings
    const savedId = (() => {
      try {
        const v = sessionStorage.getItem(SESSION_KEY);
        if (!v || v === "undefined" || v === "null" || v.trim().length < 4) return null;
        return v;
      } catch (e) {
        console.warn("[pragati] sessionStorage read error:", e);
        return null;
      }
    })();

    if (savedId) {
      console.log("[pragati] found saved session, attempting resume:", savedId);
      // Race resume against a 4.5s hard timeout so UI never stays frozen
      const timeoutGuard = new Promise<boolean>(resolve =>
        setTimeout(() => {
          console.warn("[pragati] resume timeout — falling back to fresh session");
          resolve(false);
        }, 4500)
      );
      const resumed = await Promise.race([tryResume(savedId), timeoutGuard]);
      if (resumed) {
        console.log("[pragati] session resumed successfully");
        return;
      }
      // Resume failed or timed out — clean up and fall through
      console.warn("[pragati] resume failed, clearing stale session");
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
      setIsLoading(false);
      setIsTyping(false);
    }

    // Show mode selector for new sessions (skip if initialConcern provided for fast entry)
    if (!initialConcern) {
      setShowModeSelect(true);
    } else {
      await startSession("standard");
    }
  };

  const tryResume = async (id: string): Promise<boolean> => {
    try {
      console.log("[pragati] tryResume: fetching session", id);
      setIsLoading(true);

      const resp = await fetch(`/api/pragati/session/${id}/resume`);
      if (!resp.ok) {
        console.warn("[pragati] tryResume: fetch failed with status", resp.status);
        setIsLoading(false);
        return false;
      }

      const data = await resp.json();
      console.log("[pragati] tryResume: data received, state=", data.state, "turns=", data.prior_turns?.length);

      setSessionId(id);
      setCurState(data.state);
      setNarrativeLabel(data.narrative_label || "Understanding Your Experience");
      setResponseType(data.response_type || "chips");
      setChips(data.options || []);
      setSignalCount(data.signal_count || 0);
      setIsResumed(true);

      if (data.detected_patterns?.length) setPatterns(data.detected_patterns);
      if (data.interventions?.length)     setInterventions(data.interventions);
      if (data.drift_direction)           setDrift({ direction: data.drift_direction, description: "", confidence: 1 });
      if (data.is_escalated)              setIsEscalated(true);

      // Replay prior turns as messages
      if (data.prior_turns?.length > 0) {
        const replayMsgs: PragatiMsg[] = [];
        for (const turn of data.prior_turns) {
          if (turn.user) replayMsgs.push({ id: `u_${turn.turn}`, role: "user", text: turn.user });
          for (const b of (turn.blocks || [])) {
            replayMsgs.push({ id: `${b.id}_r${turn.turn}`, role: "pragati", block: b });
          }
        }
        setMsgs(replayMsgs);
      }

      setIsLoading(false);
      await streamBlocks(data.resume_blocks || []);
      console.log("[pragati] tryResume: complete");
      return true;
    } catch (e) {
      console.error("[pragati] tryResume: error", e);
      setIsLoading(false);
      setIsTyping(false);
      return false;
    }
  };

  const startSession = async (mode: SessionMode = "standard") => {
    setShowModeSelect(false);
    setSessionMode(mode);
    setIsLoading(true);
    try {
      const resp = await fetch("/api/pragati/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:           initialEmail,
          initial_concern: initialConcern,
          session_mode:    mode,
        }),
      });
      const data = await resp.json();
      setSessionId(data.session_id);
      sessionStorage.setItem(SESSION_KEY, data.session_id);
      setCurState(data.state);
      setIsReturning(data.is_returning_user ?? false);
      setNarrativeLabel(data.narrative_label || "Mapping your growth profile");
      setResponseType(data.response_type || "text");
      if (data.preferred_language) setPreferredLang(data.preferred_language);
      if (initialConcern) setPrimaryConcern(initialConcern);
      if (data.drift)     setDrift(data.drift);
      if (data.prior_patterns?.length) setPatterns(data.prior_patterns);
      setIsLoading(false);
      // Show language chips for brand-new (non-returning) sessions
      if (!data.is_returning_user) setLangSelectActive(true);
      await streamBlocks(data.blocks || []);
    } catch (e) {
      console.error("[pragati] start:", e);
      setIsLoading(false);
      setHasError(true);
    }
  };

  const sendResponse = async (text: string) => {
    if (!sessionId || isLoading || !text.trim()) return;
    const userText = text.trim();
    setHasError(false);
    if (!primaryConcern) setPrimaryConcern(userText);
    setMsgs(prev => [...prev, { id: `u_${Date.now()}`, role: "user", text: userText }]);
    setInputText("");
    setChips([]);
    setIsLoading(true);

    try {
      const resp = await fetch(`/api/pragati/session/${sessionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: userText, response_text: userText, preferred_language: preferredLang }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      setCurState(data.state);
      setNarrativeLabel(data.narrative_label || narrativeLabel);
      setResponseType(data.response_type || "chips");
      setChips(data.options || []);
      setSignalCount(data.signal_count || 0);
      setTypingSpeed(data.pacing?.speed || "medium");
      setIsComplete(data.is_complete ?? false);
      if (data.quality)            setQuality(data.quality);
      if (data.drift)              setDrift(data.drift);
      if (data.escalation?.flag)   setIsEscalated(true);
      if (data.preferred_language) setPreferredLang(data.preferred_language);

      if (data.detected_patterns?.length) {
        setPatterns(prev => {
          const ids = new Set(prev.map(p => p.id));
          return [...prev, ...data.detected_patterns.filter((p: DetectedPattern) => !ids.has(p.id))];
        });
      }
      if (data.interventions?.length) setInterventions(data.interventions);

      if (["insight_transition", "growth_transition", "complete"].includes(data.state)) setStageIndex(1);

      setIsLoading(false);
      await streamBlocks(data.blocks || []);
    } catch (e) {
      console.error("[pragati] respond:", e);
      setIsLoading(false);
      setHasError(true);
      // Stream fallback blocks so conversation never breaks
      await streamBlocks([
        { id: `fb_${Date.now()}`, type: "bridge",    content: "Let me take a moment before continuing.", emotionalTone: "gentle" },
        { id: `fq_${Date.now()}`, type: "question",  content: "What feels most important to explore right now?", pacing: { speed: "medium", delayMs: 600 } },
      ]);
      setChips(["Continue exploring", "Take a moment", "Go back to the start"]);
      setResponseType("chips");
    }
  };

  const handleChip = (chip: string) => sendResponse(chip);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendResponse(inputText); };

  const progressPct  = Math.min(100, Math.round((signalCount / 12) * 100));
  const driftCfg     = DRIFT_CONFIG[drift?.direction || "new_session"];
  const isMultilang  = preferredLang !== "en";
  const LANG_LABELS: Record<string, string> = {
    hi: "हिंदी", hi_en: "Hinglish", te: "తెలుగు", te_en: "Telugu",
    ta: "தமிழ்", kn: "ಕನ್ನಡ", ml: "മലയാളം", mr: "मराठी",
  };
  const langLabel = LANG_LABELS[preferredLang] || preferredLang.toUpperCase();

  if (!open) return null;

  // ── Mode selection screen ────────────────────────────────────────────────
  if (showModeSelect) {
    return (
      <AnimatePresence>
        <motion.div key="mode-overlay"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex items-center justify-center px-4"
                    style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(8px)" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[380px] rounded-2xl overflow-hidden"
            style={{
              background: "#fff",
              boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 32px 64px rgba(0,0,0,0.18)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                       style={{ background: "#0B3C5D" }}>
                    <Sparkles size={17} color="#fff" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight" style={{ color: "#0f172a" }}>Pragati</p>
                    <p className="text-[11px] leading-tight" style={{ color: "#94A3B8" }}>Your growth intelligence guide</p>
                  </div>
                </div>
                <button onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                  <X size={15} color="#94A3B8" />
                </button>
              </div>

              <p className="text-base font-semibold leading-snug mb-0.5" style={{ color: "#0f172a" }}>
                How would you like to begin today?
              </p>
              <p className="text-[13px] leading-relaxed mb-3" style={{ color: "#64748B" }}>
                Choose a pace that feels right. You can speak in any language.
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { label: "English", lang: "en"    },
                  { label: "हिन्दी",  lang: "hi"    },
                  { label: "తెలుగు",  lang: "te"    },
                  { label: "தமிழ்",   lang: "ta"    },
                  { label: "Mixed",   lang: "hi_en" },
                ].map(({ label, lang }) => (
                  <button
                    key={lang}
                    onClick={() => { setPreferredLang(lang); localStorage.setItem(LANG_KEY, lang); }}
                    className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                    style={{
                      background: preferredLang === lang ? "#0B3C5D" : "#F1F5F9",
                      color:      preferredLang === lang ? "#fff"    : "#64748B",
                      border:     `1.5px solid ${preferredLang === lang ? "#0B3C5D" : "#E2E8F0"}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <ModeCard
                  onClick={() => startSession("quick_clarity")}
                  accentColor="#15803D"
                  bgColor="#F0FDF4"
                  borderColor="#BBF7D0"
                  icon={<Zap size={15} color="#15803D" />}
                  title="Quick Clarity"
                  subtitle="Get unstuck quickly"
                  description="A short conversation to understand what may be holding back your growth right now."
                  preview="What's been slowing your progress lately?"
                  duration="5–7 min"
                />
                <ModeCard
                  onClick={() => startSession("standard")}
                  accentColor="#0369A1"
                  bgColor="#F0F9FF"
                  borderColor="#7DD3FC"
                  icon={<Compass size={15} color="#0369A1" />}
                  title="Guided Understanding"
                  subtitle="Understand your patterns more clearly"
                  description="Explore what's been coming up through a calm, adaptive conversation."
                  preview="Let's explore what keeps showing up for you."
                  duration="10–15 min"
                  recommended
                />
                <ModeCard
                  onClick={() => startSession("deep_reflection")}
                  accentColor="#6D28D9"
                  bgColor="#F5F3FF"
                  borderColor="#C4B5FD"
                  icon={<BookOpen size={15} color="#6D28D9" />}
                  title="Deep Exploration"
                  subtitle="Explore recurring patterns in depth"
                  description="For when you want to slow down and decode what keeps recurring."
                  preview="Sometimes patterns make more sense when we slow down."
                  duration="20+ min"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div key="pragati-overlay"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-50 flex"
                  style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 20 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col m-auto w-full h-full md:h-[92vh] md:max-h-[920px] md:w-[96vw] md:max-w-[820px] md:rounded-2xl overflow-hidden"
          style={{ background: "#FAFBFC", boxShadow: "0 40px 100px rgba(0,0,0,0.28)" }}
        >

          {/* ── Top bar ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
               style={{ background: "#fff", borderColor: "#E2E8F0" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                   style={{ background: "#0B3C5D" }}>
                <Sparkles size={15} color="#fff" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>Pragati</p>
                <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                  {isResumed ? "Continuing your conversation"
                   : isReturning ? "Welcome back"
                   : "Here when you need clarity"}
                </p>
              </div>
              {isResumed && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium"
                     style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0369A1" }}>
                  <History size={9} />
                  Resumed
                </div>
              )}
              {isMultilang && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium"
                            style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#C2410C" }}>
                  <Globe size={9} />
                  {langLabel}
                </motion.div>
              )}
              {sessionMode !== "standard" && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium"
                     style={{
                       background: sessionMode === "quick_clarity" ? "#F0FDF4" : "#F5F3FF",
                       border: `1px solid ${sessionMode === "quick_clarity" ? "#BBF7D0" : "#DDD6FE"}`,
                       color: sessionMode === "quick_clarity" ? "#15803D" : "#5B21B6",
                     }}>
                  {sessionMode === "quick_clarity" ? <Zap size={9} /> : <BookOpen size={9} />}
                  {sessionMode === "quick_clarity" ? "Rapid Analysis" : "Deep Exploration"}
                </div>
              )}
            </div>

            {/* Current stage — single pill, no progression pressure */}
            {STAGES[stageIndex] && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
                   style={{
                     background: `${STAGES[stageIndex].color}14`,
                     color: STAGES[stageIndex].color,
                     border: `1.5px solid ${STAGES[stageIndex].color}40`,
                   }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAGES[stageIndex].color }} />
                {STAGES[stageIndex].label}
              </div>
            )}

            <button onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors ml-3">
              <X size={17} color="#64748B" />
            </button>
          </div>

          {/* ── Single-column conversation body ────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden">

            {/* ── Conversation panel — full width ─────────────────────────────── */}
            <div className="flex flex-col flex-1 overflow-hidden"
                 style={{ background: "#FAFBFC" }}>

              {/* Narrative stage pill — visible on all sizes */}
              <div className="flex items-center px-5 py-2 border-b shrink-0"
                   style={{ background: "#fff", borderColor: "#F1F5F9" }}>
                <NarrativeStage label={narrativeLabel} />
              </div>

              {/* Escalation banner */}
              <AnimatePresence>
                {isEscalated && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              className="px-5 py-3 flex items-start gap-3 border-b shrink-0"
                              style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
                    <AlertTriangle size={15} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "#B91C1C" }}>A note of care</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: "#7F1D1D" }}>
                        What you've shared carries significant weight. While I'm here to help you understand patterns, speaking with a trusted person or counsellor can be especially valuable right now. You don't have to carry this alone.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <AnimatePresence initial={false}>
                  {msgs.map(m =>
                    m.role === "user"
                      ? <UserBubble key={m.id} text={m.text || ""} />
                      : m.block
                        ? <BlockMessage key={m.id} block={m.block} />
                        : null
                  )}
                </AnimatePresence>
                {isTyping && <TypingIndicator speed={typingSpeed} />}
                {isLoading && !isTyping && <TypingIndicator speed="medium" />}
                <div ref={bottomRef} />
              </div>

              {/* Input area */}
              <div className="px-5 py-4 border-t shrink-0"
                   style={{ background: "#fff", borderColor: "#E2E8F0" }}>

                {/* Language selection — shown once for new sessions */}
                <AnimatePresence>
                  {langSelectActive && !isLoading && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                                className="mb-4 p-4 rounded-2xl"
                                style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Globe size={13} color="#0369A1" />
                        <p className="text-[12px] font-medium" style={{ color: "#0369A1" }}>
                          {uiCopy(preferredLang).langPrompt}
                        </p>
                      </div>
                      <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "#64748B" }}>
                        You can speak in English, हिन्दी, తెలుగు, தமிழ், or any mix — I'll follow your language.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: "English",          lang: "en"    },
                          { label: "हिन्दी",            lang: "hi"    },
                          { label: "తెలుగు",            lang: "te"    },
                          { label: "தமிழ்",             lang: "ta"    },
                          { label: "Mixed Language",   lang: "hi_en" },
                        ].map(({ label, lang }) => (
                          <button key={lang}
                                  onClick={() => {
                                    setPreferredLang(lang);
                                    localStorage.setItem(LANG_KEY, lang);
                                    setLangSelectActive(false);
                                    inputRef.current?.focus();
                                  }}
                                  className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95"
                                  style={{ background: "#fff", border: "1.5px solid #BAE6FD", color: "#0369A1" }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chip options */}
                <AnimatePresence>
                  {responseType === "chips" && chips.length > 0 && !isLoading && !langSelectActive && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="flex flex-wrap gap-2 mb-3">
                      {chips.map(c => (
                        <button key={c} onClick={() => handleChip(c)}
                                className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95"
                                style={{ background: "#F1F5F9", border: "1.5px solid #E2E8F0", color: "#334155" }}>
                          {c}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Completion CTA */}
                {(isComplete || ["insight_transition", "complete"].includes(curState)) && !isLoading && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
                    <button
                      onClick={() => {
                        sessionStorage.removeItem(SESSION_KEY);
                        onStartAssessment?.(primaryConcern || undefined);
                        onClose();
                      }}
                      className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-95"
                      style={{ background: "#0B3C5D", color: "#fff" }}>
                      {uiCopy(preferredLang).completeCta}
                      <ArrowRight size={16} />
                    </button>
                    <p className="text-center text-[11px] mt-1.5" style={{ color: "#94A3B8" }}>
                      Free · Curiosity stage · ~15 minutes
                    </p>
                    {onNavigate && (
                      <button
                        onClick={() => {
                          sessionStorage.removeItem(SESSION_KEY);
                          onClose();
                          onNavigate('career-builder?tab=assessment');
                        }}
                        data-testid="pragati-take-competency-assessment"
                        className="w-full mt-2 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-95"
                        style={{ background: "#fff", border: "1.5px solid #0B3C5D", color: "#0B3C5D" }}>
                        Or take the structured Competency Assessment
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Error state */}
                {hasError && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
                              style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                    <AlertCircle size={13} color="#EF4444" />
                    <p className="text-[11px]" style={{ color: "#B91C1C" }}>Connection interrupted — your progress is saved. Continue when ready.</p>
                  </motion.div>
                )}

                {/* Text input */}
                {responseType === "text" && !["insight_transition", "complete"].includes(curState) && (
                  <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder={
                        langSelectActive
                          ? "Choose a language above, or just start typing…"
                          : curState === "emotional_entry"
                            ? uiCopy(preferredLang).entryPlaceholder
                            : uiCopy(preferredLang).placeholder
                      }
                      disabled={isLoading}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                      style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", color: "#1E293B" }}
                      onFocus={e => {
                        e.target.style.borderColor = "#0B3C5D";
                        if (langSelectActive) setLangSelectActive(false);
                      }}
                      onBlur={e  => (e.target.style.borderColor = "#E2E8F0")}
                    />
                    <button type="submit" disabled={isLoading || !inputText.trim()}
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:brightness-105 active:scale-95 disabled:opacity-40"
                            style={{ background: "#0B3C5D" }}>
                      <ArrowRight size={16} color="#fff" />
                    </button>
                  </form>
                )}

                <p className="text-center text-[10px] mt-2" style={{ color: "#CBD5E1" }}>
                  {uiCopy(preferredLang).langHint}
                </p>
              </div>
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
