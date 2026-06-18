import React, { useState, useRef, useEffect } from 'react';
import { PhaseProps } from '../types';

// ── Palette ─────────────────────────────────────────────────────────────────
const NAVY  = '#1E3A8A';
const ACC   = '#2563EB';
const ABGL  = '#EFF6FF';
const ABDR  = '#BFDBFE';
const LIGHT = '#F0F9FF';

// ── Master role list (grouped for display, flat for search) ──────────────────
const ROLE_GROUPS: { group: string; roles: string[] }[] = [
  { group: 'Technology & Engineering', roles: [
    'Software Engineer', 'Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer',
    'Mobile Developer (iOS)', 'Mobile Developer (Android)', 'DevOps Engineer',
    'Site Reliability Engineer', 'Cloud Engineer', 'Solutions Architect', 'System Architect',
    'Data Engineer', 'Data Scientist', 'Machine Learning Engineer', 'AI Researcher',
    'Security Engineer', 'QA Engineer / Test Automation', 'Database Administrator',
    'Network Engineer', 'Cybersecurity Analyst', 'Blockchain Developer',
    'Tech Lead', 'Engineering Manager', 'VP of Engineering', 'CTO',
  ]},
  { group: 'Product & Design', roles: [
    'Product Manager', 'Technical Product Manager', 'Product Owner',
    'UX Designer', 'UI Designer', 'UX Researcher', 'Product Designer',
    'Graphic Designer', 'Creative Director', 'Motion Designer',
  ]},
  { group: 'Data & Analytics', roles: [
    'Business Analyst', 'Data Analyst', 'Analytics Manager',
    'BI Developer', 'Tableau / Power BI Developer', 'Quantitative Analyst',
    'Research Analyst', 'Insights Manager',
  ]},
  { group: 'Finance & Banking', roles: [
    'Financial Analyst', 'Investment Banker', 'Chartered Accountant (CA)',
    'Cost Accountant (CMA)', 'Financial Controller', 'Finance Manager', 'CFO',
    'Auditor', 'Tax Consultant', 'Credit Analyst', 'Risk Analyst',
    'Portfolio Manager', 'Relationship Manager', 'Treasury Analyst',
    'Compliance Officer', 'Actuary', 'Insurance Analyst',
  ]},
  { group: 'Marketing & Media', roles: [
    'Digital Marketer', 'Brand Manager', 'Content Writer / Copywriter',
    'SEO Specialist', 'Social Media Manager', 'Performance Marketing Manager',
    'Marketing Manager', 'Marketing Director', 'CMO',
    'PR Manager', 'Market Research Analyst', 'Product Marketing Manager',
    'Video Editor', 'Journalist / Reporter',
  ]},
  { group: 'Sales & Business Development', roles: [
    'Sales Executive', 'Senior Sales Manager', 'Account Manager',
    'Key Account Manager', 'Business Development Executive',
    'Business Development Manager', 'Sales Director', 'VP of Sales',
    'Pre-Sales Consultant', 'Channel Sales Manager', 'Inside Sales Representative',
  ]},
  { group: 'Operations & Supply Chain', roles: [
    'Operations Manager', 'Project Manager', 'Program Manager',
    'Supply Chain Manager', 'Logistics Manager', 'Procurement Manager',
    'Warehouse Manager', 'Quality Manager', 'Process Excellence Manager',
    'Six Sigma Black Belt', 'Scrum Master', 'Agile Coach',
  ]},
  { group: 'Human Resources', roles: [
    'HR Executive', 'HR Manager', 'Talent Acquisition Specialist', 'Recruiter',
    'HR Business Partner', 'L&D Manager', 'Compensation & Benefits Manager',
    'HR Director', 'CHRO', 'OD Consultant', 'Corporate Trainer',
  ]},
  { group: 'Consulting & Strategy', roles: [
    'Management Consultant', 'Strategy Consultant', 'Associate Consultant',
    'Principal Consultant', 'Director of Strategy', 'Chief Strategy Officer',
    'IT Consultant', 'ERP Consultant', 'Change Management Consultant',
  ]},
  { group: 'Education & Training', roles: [
    'School Teacher', 'College Lecturer', 'Professor', 'School Principal',
    'Academic Coordinator', 'Curriculum Designer', 'Education Counsellor',
    'Learning & Development Specialist', 'Instructional Designer',
  ]},
  { group: 'Healthcare', roles: [
    'Doctor (General Physician)', 'Specialist Doctor', 'Surgeon', 'Dentist',
    'Nurse', 'Pharmacist', 'Hospital Administrator', 'Healthcare Manager',
    'Clinical Research Associate', 'Medical Representative', 'Physiotherapist',
    'Nutritionist / Dietitian', 'Psychologist / Counsellor',
  ]},
  { group: 'Legal & Compliance', roles: [
    'Lawyer / Advocate', 'Corporate Legal Counsel', 'Compliance Officer',
    'Contract Manager', 'Legal Manager', 'IP Attorney',
  ]},
  { group: 'Government & Public Sector', roles: [
    'IAS / IPS / IFS Officer', 'Civil Servant', 'Policy Analyst',
    'Government Administrator', 'Public Health Officer', 'Defence Officer',
  ]},
  { group: 'Research & Academia', roles: [
    'Research Scientist', 'Postdoctoral Researcher', 'PhD Scholar',
    'Academic Researcher', 'Scientist (R&D)',
  ]},
  { group: 'Entrepreneurship & Leadership', roles: [
    'Founder / Co-founder', 'CEO', 'COO', 'Managing Director',
    'General Manager', 'Country Head', 'Regional Director',
  ]},
];

const ALL_ROLES = ROLE_GROUPS.flatMap(g => g.roles);

// ── Blocker options ───────────────────────────────────────────────────────────
const BLOCKER_OPTIONS = [
  "I don't know what skills I'm missing",
  "Imposter syndrome holds me back",
  "I freeze in high-stakes conversations",
  "I don't know how to position myself",
  "I lack the confidence to make the leap",
  "I don't have the right network",
  "I've faced repeated rejections",
  "I'm unsure if I'm ready yet",
  "I don't know where to start",
  "My current role isn't supporting my growth",
  "Work-life pressure is slowing me down",
  "Other (describe)",
];

// ── Industries ────────────────────────────────────────────────────────────────
const INDUSTRIES = [
  'Technology / IT', 'Finance & Banking', 'Healthcare', 'Education',
  'Marketing & Media', 'Consulting', 'Manufacturing', 'Government / Public Sector',
  'Legal', 'Retail & E-commerce', 'Logistics & Supply Chain', 'Real Estate',
  'Research & Academia', 'Hospitality & Tourism', 'Other',
];
const SENIORITY = [
  'Fresher / Intern', 'Junior (0–2 yrs)', 'Mid-level (3–5 yrs)',
  'Senior (6–9 yrs)', 'Lead / Principal (10–14 yrs)', 'Director / VP (15+ yrs)', 'C-Suite / Founder',
];
const EXP_YEARS = ['Less than 1 year', '1–2 years', '3–5 years', '6–9 years', '10–14 years', '15+ years'];
const TIMELINES = ['Right now — urgent', 'Within 3 months', 'Within 6 months', 'In 1 year', 'In 2+ years', 'Exploring options'];

// ── PDF text extractor (heuristic — works for most digital PDFs) ─────────────
function extractTextFromPDF(binary: string): string {
  const texts: string[] = [];
  // Single-string Tj operator
  const tjRe = /\(([^)\\]|\\.)*\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(binary)) !== null) {
    const raw = m[0].slice(1, m[0].lastIndexOf(')'));
    texts.push(raw.replace(/\\n/g, '\n').replace(/\\t/g, ' ').replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\'/g, "'"));
  }
  // Array TJ operator
  const tjArrRe = /\[([^\]]*)\]\s*TJ/g;
  while ((m = tjArrRe.exec(binary)) !== null) {
    const strRe = /\(([^)\\]|\\.)*\)/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRe.exec(m[1])) !== null) {
      texts.push(sm[0].slice(1, -1));
    }
  }
  const result = texts.join(' ').replace(/\s+/g, ' ').trim();
  return result;
}

// ── CV Extractor ──────────────────────────────────────────────────────────────
interface CVExtracted { skills: string[]; roles: string[]; education: string[]; }
const SKILL_KEYWORDS = [
  'Python','JavaScript','TypeScript','React','Node.js','SQL','Java','C++','AWS','Azure','GCP',
  'Machine Learning','Data Analysis','Product Management','Agile','Scrum','Leadership',
  'Project Management','Excel','PowerPoint','Communication','Stakeholder Management',
  'Strategy','UX Design','Figma','Marketing','Sales','Finance','Accounting',
  'Research','Statistics','Tableau','Power BI','Docker','Kubernetes','Git',
];
const CV_ROLE_KEYWORDS = ['engineer','manager','developer','analyst','designer','consultant','lead','director','vp','head','officer','specialist','coordinator','executive','architect','researcher','scientist'];
function extractFromCV(text: string): CVExtracted {
  if (!text.trim()) return { skills: [], roles: [], education: [] };
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  const skills = SKILL_KEYWORDS.filter(k => lower.includes(k.toLowerCase())).slice(0, 8);
  const roles: string[] = [];
  lines.forEach(line => {
    if (line.length < 60 && CV_ROLE_KEYWORDS.some(k => line.toLowerCase().includes(k))) {
      const cleaned = line.replace(/[•\-–—|]/g, '').trim();
      if (cleaned && !roles.includes(cleaned) && cleaned.length < 55) roles.push(cleaned);
    }
  });
  const eduPat = /(b\.?tech|m\.?tech|mba|b\.?e|m\.?e|b\.?sc|m\.?sc|phd|bachelor|master|degree|diploma)/i;
  const education: string[] = [];
  lines.forEach(line => {
    if (eduPat.test(line) && line.length < 70) education.push(line.replace(/[•\-–—]/g, '').trim());
  });
  return { skills, roles: roles.slice(0, 4), education: education.slice(0, 2) };
}

// ── Searchable role combobox ──────────────────────────────────────────────────
interface RoleComboboxProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
  id: string;
}
function RoleCombobox({ value, onChange, placeholder, error, id }: RoleComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.length < 1
    ? ALL_ROLES.slice(0, 30)
    : ALL_ROLES.filter(r => r.toLowerCase().includes(query.toLowerCase())).slice(0, 20);

  const handleSelect = (role: string) => {
    onChange(role);
    setQuery(role);
    setOpen(false);
  };

  const handleInputChange = (v: string) => {
    setQuery(v);
    onChange(v);
    setOpen(true);
  };

  // Group filtered results by their group
  const groupedFiltered: { group: string; roles: string[] }[] = [];
  if (query.length < 1) {
    // Show first few from each group
    ROLE_GROUPS.forEach(g => {
      const subset = g.roles.slice(0, 4);
      if (subset.length) groupedFiltered.push({ group: g.group, roles: subset });
    });
  } else {
    ROLE_GROUPS.forEach(g => {
      const matches = g.roles.filter(r => r.toLowerCase().includes(query.toLowerCase()));
      if (matches.length) groupedFiltered.push({ group: g.group, roles: matches });
    });
  }
  const totalShown = groupedFiltered.reduce((a, g) => a + g.roles.length, 0);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          className="w-full rounded-xl px-3.5 py-2.5 pr-9 text-[13px] outline-none transition-all"
          style={{
            border: `1.5px solid ${error ? '#EF4444' : focused ? ACC : ABDR}`,
            background: focused ? LIGHT : '#fff',
            color: '#111827',
            boxShadow: focused ? `0 0 0 3px rgba(37,99,235,0.08)` : 'none',
          }}
        />
        {/* Chevron */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg viewBox="0 0 10 6" style={{ width: 10, height: 6 }} fill="none">
            <path d="M1 1l4 4 4-4" stroke={ACC} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-xl shadow-lg overflow-hidden"
          style={{ background: '#fff', border: `1.5px solid ${ABDR}`, maxHeight: 260, overflowY: 'auto' }}>
          {groupedFiltered.length === 0 ? (
            <div className="px-4 py-3 text-[12px]" style={{ color: '#9CA3AF' }}>
              No matches — you can type any title and continue.
            </div>
          ) : (
            <>
              {groupedFiltered.map(g => (
                <div key={g.group}>
                  <div className="px-3 pt-2.5 pb-1 text-[9.5px] font-bold tracking-wider sticky top-0"
                    style={{ color: ACC, background: ABGL, borderBottom: `1px solid ${ABDR}` }}>
                    {g.group.toUpperCase()}
                  </div>
                  {g.roles.map(role => (
                    <button key={role} type="button"
                      onMouseDown={e => { e.preventDefault(); handleSelect(role); }}
                      className="w-full text-left px-4 py-2 text-[12.5px] transition-colors hover:bg-blue-50"
                      style={{ color: query && role.toLowerCase().includes(query.toLowerCase()) ? '#111827' : '#374151' }}>
                      {query ? highlightMatch(role, query) : role}
                    </button>
                  ))}
                </div>
              ))}
              <div className="px-3 pt-1.5 pb-1 text-[9.5px]" style={{ color: '#9CA3AF', borderTop: `1px solid ${ABDR}` }}>
                {totalShown} options shown — or type to search {ALL_ROLES.length}+ roles
              </div>
            </>
          )}
        </div>
      )}
      {error && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: ACC, fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Stage header ──────────────────────────────────────────────────────────────
const STAGE_LABELS = ['CURIOSITY', 'INSIGHT', 'GROWTH', 'MASTERY'];
function StageHeader() {
  return (
    <div className="sticky top-0 z-10"
      style={{ background: `linear-gradient(135deg, #0F172A 0%, ${NAVY} 60%, #1E40AF 100%)` }}>
      <div className="px-5 pt-3.5 pb-2">
        <div className="flex items-center gap-1.5 mb-2.5">
          {STAGE_LABELS.map((label, i) => {
            const done = i === 0; const active = i === 1;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: done ? '#34D399' : active ? '#60A5FA' : '#94A3B8', opacity: done || active ? 1 : 0.3 }} />
                  <span className="text-[9.5px] font-semibold tracking-wider"
                    style={{ color: done ? '#34D399' : active ? '#93C5FD' : '#94A3B8', opacity: done || active ? 1 : 0.35 }}>
                    {label}
                  </span>
                </div>
                {i < STAGE_LABELS.length - 1 && (
                  <div className="flex-1 h-px mx-1" style={{ background: i === 0 ? '#34D399' : '#94A3B8', opacity: i === 0 ? 1 : 0.2 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-widest mb-0.5" style={{ color: '#93C5FD' }}>STEP 0 OF 2 — PROFILING</p>
            <h2 className="text-[17px] font-bold text-white leading-tight">Competency Intelligence Setup</h2>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9.5px] font-bold tracking-wide"
              style={{ background: 'rgba(37,99,235,0.25)', color: '#93C5FD', border: '1px solid rgba(96,165,250,0.4)' }}>
              INSIGHT STAGE
            </span>
            <p className="text-[9px] mt-0.5" style={{ color: '#64748B' }}>COMPETENCY ANALYSIS</p>
          </div>
        </div>
      </div>
      <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
    </div>
  );
}

function SectionLabel({ step, label, sub }: { step: number; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[12px] font-bold text-white"
        style={{ background: `linear-gradient(135deg, ${NAVY}, ${ACC})` }}>
        {step}
      </div>
      <div>
        <p className="text-[12.5px] font-bold" style={{ color: '#111827' }}>{label}</p>
        <p className="text-[11px] leading-snug mt-0.5" style={{ color: '#6B7280' }}>{sub}</p>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold mb-1.5 tracking-wide" style={{ color: '#374151' }}>{children}</label>;
}

const selectStyle = (focused: boolean): React.CSSProperties => ({
  border: `1.5px solid ${focused ? ACC : ABDR}`,
  background: focused ? LIGHT : '#fff',
  color: '#111827',
  boxShadow: focused ? `0 0 0 3px rgba(37,99,235,0.08)` : 'none',
  appearance: 'none',
});

// ── Auto-grow textarea with ambient "Saved" indicator ────────────────────────
// Live-sensor pattern (telemetry-friendly): expands to fit content so no internal
// scrollbar appears, and surfaces a low-contrast fading "Saved" pill 600ms after
// typing stops. Save is local-state-only (controlled component); the pill is a
// calmness cue, not a network status. Used by the CV paste field and any future
// open-text inputs in the assessment funnel.
interface AGSTextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  focused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}
function AutoGrowSavedTextarea({
  value, onChange, placeholder, minRows = 3, focused = false, onFocus, onBlur,
}: AGSTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjust height to fit content on every value change. scrollHeight gives the
  // intrinsic content height; we set it back to the inline style to grow the
  // box. Reset first to handle deletions correctly.
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);

  // Cleanup any pending timers on unmount so we don't setState after teardown.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  const handle = (v: string) => {
    onChange(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    saveTimer.current = setTimeout(() => {
      setShowSaved(true);
      fadeTimer.current = setTimeout(() => setShowSaved(false), 1400);
    }, 600);
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={(e) => handle(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        rows={minRows}
        className="w-full rounded-xl px-3.5 text-[13px] outline-none block resize-none"
        style={{
          paddingTop: 16, paddingBottom: 24, // 16px top + 24px bottom for sync pill room
          border: `1.5px solid ${focused ? ACC : ABDR}`,
          background: focused ? LIGHT : '#fff',
          color: '#111827',
          lineHeight: '1.6',
          boxShadow: focused ? `0 0 0 3px rgba(37,99,235,0.08)` : 'none',
          overflow: 'hidden', // suppress vertical scrollbar — height tracks content
          transition: 'background-color 0.25s ease-in-out, border-color 0.25s ease-in-out',
        }}
      />
      {/* Ambient sync micro-label — low contrast, fades in/out smoothly */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 6, right: 10,
          fontSize: 9.5, fontWeight: 500, letterSpacing: '0.02em',
          color: '#94A3B8',
          opacity: showSaved && value.length > 0 ? 1 : 0,
          transform: showSaved ? 'translateY(0)' : 'translateY(2px)',
          transition: 'opacity 0.45s ease-in-out, transform 0.45s ease-in-out',
        }}
        aria-live="polite"
      >
        ✓ Saved
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CapadexInsProfilePhase({ setPhase, participantName, capadexRegEmail, selectedConcern, capadexReport }: PhaseProps) {
  const [currentRole, setCurrentRole]     = useState('');
  const [currentIndustry, setCurrentIndustry] = useState('');
  const [yearsExp, setYearsExp]           = useState('');
  const [seniority, setSeniority]         = useState('');
  // ── Phase 1 Global Ontology context ──────────────────────────────────
  const [businessFunction, setBusinessFunction] = useState('');
  const [orgComplexity, setOrgComplexity]       = useState('');
  const [geography, setGeography]               = useState('');
  const [groFunctions, setGroFunctions]         = useState<Array<{ id: string; name: string }>>([]);
  const [groGeographies, setGroGeographies]     = useState<Array<{ geography_code: string; geography_name: string }>>([]);
  const [groIndustries, setGroIndustries]       = useState<Array<{ id: string; name: string }>>([]);
  const [detectedLayer, setDetectedLayer]       = useState<{ code: string; name: string } | null>(null);
  const [targetRole, setTargetRole]       = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [timeline, setTimeline]           = useState('');
  const [selectedBlocker, setSelectedBlocker] = useState('');
  const [blockerOther, setBlockerOther]   = useState('');
  const [cvText, setCvText]               = useState('');
  const [cvFocused, setCvFocused]         = useState(false);
  const [cvExtracted, setCvExtracted]     = useState<CVExtracted>({ skills: [], roles: [], education: [] });
  const [cvFileName, setCvFileName]       = useState('');
  const [cvUploadStatus, setCvUploadStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [cvUploadError, setCvUploadError] = useState('');
  const [dragOver, setDragOver]           = useState(false);
  const fileInputRef                      = useRef<HTMLInputElement>(null);
  const [focusedField, setFocusedField]   = useState<string | null>(null);
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const [submitting, setSubmitting]       = useState(false);

  const displayName = participantName || capadexRegEmail?.split('@')[0] || 'there';
  const concernName = capadexReport?.concernName || selectedConcern || 'your concern';

  // Load Global Ontology reference data (functions, geographies, industries) — fail silent
  useEffect(() => {
    (async () => {
      try {
        const [fnR, gR, iR] = await Promise.all([
          fetch('/api/functions').then(r => r.json()).catch(() => null),
          fetch('/api/geographies').then(r => r.json()).catch(() => null),
          fetch('/api/industries').then(r => r.json()).catch(() => null),
        ]);
        if (fnR?.ok) setGroFunctions(fnR.data ?? []);
        if (gR?.ok)  setGroGeographies(gR.data ?? []);
        if (iR?.ok)  setGroIndustries(iR.data ?? []);
      } catch { /* silent */ }
    })();
  }, []);

  // Auto-detect organisational layer from role title + seniority + experience.
  useEffect(() => {
    const y = (() => {
      if (yearsExp.startsWith('15')) return 16;
      if (yearsExp.startsWith('10')) return 12;
      if (yearsExp.startsWith('6'))  return 7;
      if (yearsExp.startsWith('3'))  return 4;
      if (yearsExp.startsWith('1'))  return 1.5;
      return 0;
    })();
    if (!currentRole && !seniority && !y) { setDetectedLayer(null); return; }
    const qs = new URLSearchParams();
    if (currentRole) qs.set('role_title', currentRole);
    if (seniority)   qs.set('seniority', seniority);
    if (y)           qs.set('years_exp', String(y));
    const ctrl = new AbortController();
    fetch(`/api/role-layers/detect?${qs.toString()}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(j => {
        if (j?.ok && j.data?.layer) setDetectedLayer({ code: j.data.detected_code, name: j.data.layer.layer_name });
      })
      .catch(() => { /* silent */ });
    return () => ctrl.abort();
  }, [currentRole, seniority, yearsExp]);

  const handleCVChange = (text: string) => {
    setCvText(text);
    if (text.length > 80) {
      const extracted = extractFromCV(text);
      setCvExtracted(extracted);
      if (!currentRole && extracted.roles.length > 0) setCurrentRole(extracted.roles[0]);
    } else {
      setCvExtracted({ skills: [], roles: [], education: [] });
    }
  };

  const processFile = async (file: File) => {
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      setCvUploadError(`File too large — max ${MAX_MB} MB`);
      setCvUploadStatus('error');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['txt', 'pdf', 'doc', 'docx'].includes(ext)) {
      setCvUploadError('Unsupported format. Use .txt or .pdf');
      setCvUploadStatus('error');
      return;
    }
    setCvFileName(file.name);
    setCvUploadStatus('parsing');
    setCvUploadError('');
    try {
      if (ext === 'txt') {
        const text = await file.text();
        handleCVChange(text);
        setCvUploadStatus('done');
      } else if (ext === 'pdf') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const binary = e.target?.result as string ?? '';
          const extracted = extractTextFromPDF(binary);
          if (extracted.length > 30) {
            handleCVChange(extracted);
            setCvUploadStatus('done');
          } else {
            setCvUploadStatus('error');
            setCvUploadError('PDF text could not be extracted. Please paste your CV text below.');
          }
        };
        reader.onerror = () => {
          setCvUploadStatus('error');
          setCvUploadError('Could not read file. Try pasting your CV text instead.');
        };
        reader.readAsBinaryString(file);
      } else {
        setCvUploadStatus('error');
        setCvUploadError('.doc/.docx not supported in browser — please paste your CV text below.');
      }
    } catch {
      setCvUploadStatus('error');
      setCvUploadError('Could not read file. Try pasting your CV text instead.');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!currentRole.trim()) errs.currentRole = 'Required — select or type your current role';
    if (!yearsExp) errs.yearsExp = 'Required';
    if (!seniority) errs.seniority = 'Required';
    if (!targetRole.trim()) errs.targetRole = 'Required — select or type your target role';
    if (!timeline) errs.timeline = 'Select a timeline';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleBegin = () => {
    if (!validate()) return;
    setSubmitting(true);
    const blockerValue = selectedBlocker === 'Other (describe)' ? blockerOther : selectedBlocker;
    const profile = {
      currentRole, currentIndustry, yearsExp, seniority,
      targetRole, targetIndustry, timeline,
      blockers: blockerValue,
      cvText,
      cvSkills: cvExtracted.skills,
      // Phase 1 Global Ontology context
      businessFunction, orgComplexity, geography,
      detectedLayer: detectedLayer?.code ?? null,
    };
    try { sessionStorage.setItem('metryx_ins_profile', JSON.stringify(profile)); } catch { /**/ }
    setPhase('capadex_q');
  };

  const fi = (field: string) => ({ onFocus: () => setFocusedField(field), onBlur: () => setFocusedField(null) });
  const cls = "w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none transition-all";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#F8FAFF' }}>
      <StageHeader />

      {/* ── Intro banner ── */}
      <div className="mx-4 mt-4 mb-3 rounded-xl px-4 py-3.5"
        style={{ background: `linear-gradient(135deg, #1E3A8A 0%, ${ACC} 100%)` }}>
        <p className="text-[13px] font-bold text-white leading-snug">
          Hi {displayName}, before we analyse your competency profile —
        </p>
        <p className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: '#BFDBFE' }}>
          We need a precise professional snapshot so your Competency Gap Analysis for <em>"{concernName}"</em> is benchmarked against real role standards — not generic advice.
        </p>
      </div>

      {/* ── Section 1: Professional Snapshot ── */}
      <div className="mx-4 mb-3 rounded-xl p-4" style={{ background: '#fff', border: `1.5px solid ${ABDR}` }}>
        <SectionLabel step={1} label="Professional Snapshot" sub="Where you are right now — used to calibrate your behavioural baseline." />

        <div className="space-y-3.5">
          {/* Current Role — combobox */}
          <div>
            <FieldLabel>
              Current Role / Job Title <span style={{ color: ACC }}>*</span>
            </FieldLabel>
            <RoleCombobox
              id="current-role"
              value={currentRole}
              onChange={setCurrentRole}
              placeholder="Search or type your role…"
              error={errors.currentRole}
            />
          </div>

          {/* Industry — sourced from Global Ontology /api/industries when available, else static fallback */}
          <div>
            <FieldLabel>Current Industry / Sector</FieldLabel>
            <select value={currentIndustry} onChange={e => setCurrentIndustry(e.target.value)}
              className={cls} style={selectStyle(focusedField === 'ci')} {...fi('ci')}>
              <option value="">Select industry…</option>
              {groIndustries.length > 0
                ? groIndustries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)
                : INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Total Experience <span style={{ color: ACC }}>*</span></FieldLabel>
              <select value={yearsExp} onChange={e => setYearsExp(e.target.value)}
                className={cls} style={selectStyle(focusedField === 'ye')} {...fi('ye')}>
                <option value="">Select…</option>
                {EXP_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {errors.yearsExp && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.yearsExp}</p>}
            </div>
            <div>
              <FieldLabel>Seniority Level <span style={{ color: ACC }}>*</span></FieldLabel>
              <select value={seniority} onChange={e => setSeniority(e.target.value)}
                className={cls} style={selectStyle(focusedField === 'sn')} {...fi('sn')}>
                <option value="">Select…</option>
                {SENIORITY.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.seniority && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.seniority}</p>}
            </div>
          </div>

          {/* ── Phase 1 Global Ontology: business function + geography + complexity ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Business Function</FieldLabel>
              <select value={businessFunction} onChange={e => setBusinessFunction(e.target.value)}
                className={cls} style={selectStyle(focusedField === 'bf')} {...fi('bf')}>
                <option value="">Select function…</option>
                {groFunctions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Primary Geography</FieldLabel>
              <select value={geography} onChange={e => setGeography(e.target.value)}
                className={cls} style={selectStyle(focusedField === 'gx')} {...fi('gx')}>
                <option value="">Select geography…</option>
                {groGeographies.map(g => <option key={g.geography_code} value={g.geography_code}>{g.geography_name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <FieldLabel>Organisational Complexity</FieldLabel>
            <select value={orgComplexity} onChange={e => setOrgComplexity(e.target.value)}
              className={cls} style={selectStyle(focusedField === 'oc')} {...fi('oc')}>
              <option value="">Select complexity…</option>
              <option value="1">1 — Micro / Solo (1–10 people)</option>
              <option value="2">2 — Small (11–100)</option>
              <option value="3">3 — Mid-size (101–1k)</option>
              <option value="4">4 — Large (1k–10k)</option>
              <option value="5">5 — Enterprise / Global (10k+)</option>
            </select>
            <p className="text-[10.5px] mt-1 leading-snug" style={{ color: '#6B7280' }}>
              Used to calibrate role-expectations against your operating scale.
            </p>
          </div>

          {detectedLayer && (
            <div className="rounded-lg px-3 py-2.5 flex items-center gap-2"
              style={{ background: LIGHT, border: `1px solid ${ABDR}` }}>
              <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: ACC }}>
                Detected layer
              </span>
              <span className="text-[12px] font-semibold" style={{ color: '#111827' }}>
                {detectedLayer.name}
              </span>
              <span className="text-[10.5px]" style={{ color: '#6B7280' }}>
                (auto from role + seniority)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Career Direction ── */}
      <div className="mx-4 mb-3 rounded-xl p-4" style={{ background: '#fff', border: `1.5px solid ${ABDR}` }}>
        <SectionLabel step={2} label="Career Direction" sub="Where you're heading — used to compute your competency gap vector." />

        <div className="space-y-3.5">
          {/* Target Role — combobox */}
          <div>
            <FieldLabel>
              Target Role / Aspired Position <span style={{ color: ACC }}>*</span>
            </FieldLabel>
            <RoleCombobox
              id="target-role"
              value={targetRole}
              onChange={setTargetRole}
              placeholder="Search or type your target role…"
              error={errors.targetRole}
            />
          </div>

          {/* Target Industry */}
          <div>
            <FieldLabel>Target Industry (if different)</FieldLabel>
            <select value={targetIndustry} onChange={e => setTargetIndustry(e.target.value)}
              className={cls} style={selectStyle(focusedField === 'ti')} {...fi('ti')}>
              <option value="">Same as current / Not sure</option>
              {groIndustries.length > 0
                ? groIndustries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)
                : INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {/* Timeline chips */}
          <div>
            <FieldLabel>When do you want to make this move? <span style={{ color: ACC }}>*</span></FieldLabel>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {TIMELINES.map(t => (
                <button key={t} type="button" onClick={() => setTimeline(t)}
                  className="px-3 py-2 rounded-xl text-[11px] font-medium text-left transition-all"
                  style={{
                    background: timeline === t ? ACC : ABGL,
                    color: timeline === t ? '#fff' : '#374151',
                    border: `1.5px solid ${timeline === t ? ACC : ABDR}`,
                  }}>
                  {t}
                </button>
              ))}
            </div>
            {errors.timeline && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.timeline}</p>}
          </div>

          {/* Primary Blocker — chip select */}
          <div>
            <FieldLabel>
              Primary Blocker{' '}
              <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(optional)</span>
            </FieldLabel>
            <div className="flex flex-wrap gap-2 mt-1">
              {BLOCKER_OPTIONS.map(b => (
                <button key={b} type="button"
                  onClick={() => setSelectedBlocker(prev => prev === b ? '' : b)}
                  // ── Calm-interaction profile: 16px vertical padding for effortless
                  //    click targets, 0.25s ease-in-out colour transition (relief-first
                  //    design standard — no jarring snaps).
                  className="px-4 rounded-2xl text-[11px] font-medium text-left"
                  style={{
                    paddingTop: 16, paddingBottom: 16,
                    background: selectedBlocker === b ? ACC : ABGL,
                    color: selectedBlocker === b ? '#fff' : '#374151',
                    border: `1.5px solid ${selectedBlocker === b ? ACC : ABDR}`,
                    transition: 'background-color 0.25s ease-in-out, color 0.25s ease-in-out, border-color 0.25s ease-in-out',
                  }}>
                  {b}
                </button>
              ))}
            </div>
            {selectedBlocker === 'Other (describe)' && (
              <input
                type="text"
                placeholder="Describe your blocker briefly…"
                value={blockerOther}
                onChange={e => setBlockerOther(e.target.value.slice(0, 160))}
                className={cls + ' mt-2.5'}
                style={{
                  border: `1.5px solid ${ABDR}`,
                  background: '#fff', color: '#111827',
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: CV Intelligence ── */}
      <div className="mx-4 mb-3 rounded-xl p-4" style={{ background: '#fff', border: `1.5px solid ${ABDR}` }}>
        <SectionLabel step={3} label="CV Intelligence" sub="Upload or paste your CV — we extract signals to sharpen your gap analysis." />

        {/* Privacy note */}
        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg" style={{ background: ABGL, border: `1px solid ${ABDR}` }}>
          <svg viewBox="0 0 14 14" style={{ width: 12, height: 12, marginTop: 2, flexShrink: 0 }} fill="none">
            <circle cx="7" cy="7" r="6" stroke={ACC} strokeWidth="1.3"/>
            <path d="M7 6v4M7 4.5v.5" stroke={ACC} strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <p className="text-[10.5px] leading-relaxed" style={{ color: '#374151' }}>
            Your CV is used only to pre-fill fields and extract skill signals — it is <strong>never stored independently</strong>.
          </p>
        </div>

        {/* ── Upload zone ── */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf"
          className="hidden"
          onChange={handleFileInput}
        />

        <div
          onClick={() => cvUploadStatus !== 'parsing' && fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="rounded-xl transition-all cursor-pointer"
          style={{
            border: `2px dashed ${dragOver ? ACC : cvUploadStatus === 'done' ? '#34D399' : cvUploadStatus === 'error' ? '#EF4444' : ABDR}`,
            background: dragOver ? '#EFF6FF' : cvUploadStatus === 'done' ? '#F0FDF4' : cvUploadStatus === 'error' ? '#FEF2F2' : '#FAFBFF',
            padding: '16px',
          }}>

          {cvUploadStatus === 'idle' && (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: ABGL, border: `1.5px solid ${ABDR}` }}>
                <svg viewBox="0 0 20 20" style={{ width: 18, height: 18 }} fill="none">
                  <path d="M10 13V4M10 4L7 7M10 4l3 3" stroke={ACC} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 14v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke={ACC} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-[12.5px] font-semibold" style={{ color: '#111827' }}>
                Click to upload or drag & drop
              </p>
              <p className="text-[10.5px]" style={{ color: '#9CA3AF' }}>Supports .txt and .pdf — max 5 MB</p>
              <div className="flex items-center gap-2 mt-1">
                {['TXT', 'PDF'].map(fmt => (
                  <span key={fmt} className="text-[9px] font-bold px-2 py-0.5 rounded"
                    style={{ background: ABGL, color: ACC, border: `1px solid ${ABDR}` }}>
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {cvUploadStatus === 'parsing' && (
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${ACC} transparent ${ACC} ${ACC}` }} />
              <p className="text-[12.5px] font-medium" style={{ color: ACC }}>Parsing {cvFileName}…</p>
            </div>
          )}

          {cvUploadStatus === 'done' && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: '#DCFCE7', border: '1.5px solid #86EFAC' }}>
                <svg viewBox="0 0 16 16" style={{ width: 14, height: 14 }} fill="none">
                  <path d="M3 8l3.5 3.5L13 5" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate" style={{ color: '#15803D' }}>{cvFileName}</p>
                <p className="text-[10.5px]" style={{ color: '#6B7280' }}>{cvText.length.toLocaleString()} characters extracted — fields pre-filled below</p>
              </div>
              <button type="button" onClick={e => { e.stopPropagation(); setCvUploadStatus('idle'); setCvFileName(''); handleCVChange(''); }}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                style={{ background: '#fff', border: `1px solid #D1FAE5`, color: '#6B7280' }}>
                Remove
              </button>
            </div>
          )}

          {cvUploadStatus === 'error' && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: '#FEE2E2', border: '1.5px solid #FCA5A5' }}>
                <svg viewBox="0 0 14 14" style={{ width: 12, height: 12 }} fill="none">
                  <circle cx="7" cy="7" r="6" stroke="#EF4444" strokeWidth="1.3"/>
                  <path d="M7 4v3.5M7 9.5v.5" stroke="#EF4444" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[11.5px] font-semibold" style={{ color: '#B91C1C' }}>Upload failed</p>
                <p className="text-[10.5px] mt-0.5" style={{ color: '#6B7280' }}>{cvUploadError}</p>
              </div>
              <button type="button" onClick={e => { e.stopPropagation(); setCvUploadStatus('idle'); setCvFileName(''); }}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg"
                style={{ background: '#fff', border: `1px solid #FCA5A5`, color: '#6B7280' }}>
                Try again
              </button>
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px" style={{ background: ABDR }} />
          <span className="text-[10px] font-medium px-1" style={{ color: '#9CA3AF' }}>or paste below</span>
          <div className="flex-1 h-px" style={{ background: ABDR }} />
        </div>

        {/* ── Paste area (auto-expanding, ambient sync indicator) ──
            Live-sensor pattern: textarea grows with content (no internal scrollbar),
            and a soft fading "Saved" micro-label appears 600ms after typing stops.
            The save is local-only (state already lives in cvText) — no network call,
            no high-pressure submit button. Sync indicator is purely a calmness cue. */}
        <AutoGrowSavedTextarea
          placeholder="Paste your CV text here — work history, skills, education…"
          value={cvText}
          onChange={(v) => { handleCVChange(v); if (cvUploadStatus !== 'idle') { setCvUploadStatus('idle'); setCvFileName(''); } }}
          focused={cvFocused}
          onFocus={() => setCvFocused(true)}
          onBlur={() => setCvFocused(false)}
          minRows={4}
        />
        <p className="text-[9.5px] mt-1" style={{ color: '#9CA3AF' }}>{cvText.length.toLocaleString()} characters</p>

        {(cvExtracted.skills.length > 0 || cvExtracted.roles.length > 0) && (
          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${ABDR}` }}>
            <div className="px-3 py-2" style={{ background: ABGL, borderBottom: `1px solid ${ABDR}` }}>
              <p className="text-[10.5px] font-semibold" style={{ color: ACC }}>
                <span className="inline-block w-2 h-2 rounded-full mr-1.5 mb-px" style={{ background: '#34D399', verticalAlign: 'middle' }} />
                Extracted from your CV
              </p>
            </div>
            <div className="px-3 py-3 space-y-2.5">
              {cvExtracted.roles.length > 0 && (
                <div>
                  <p className="text-[9.5px] font-semibold tracking-wide mb-1.5" style={{ color: '#6B7280' }}>ROLES DETECTED — click to use</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cvExtracted.roles.map((r, i) => (
                      <button key={i} type="button" onClick={() => setCurrentRole(r)}
                        className="text-[10.5px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:bg-blue-50"
                        style={{ background: '#fff', border: `1px solid ${ABDR}`, color: '#374151' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {cvExtracted.skills.length > 0 && (
                <div>
                  <p className="text-[9.5px] font-semibold tracking-wide mb-1.5" style={{ color: '#6B7280' }}>SKILLS IDENTIFIED</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cvExtracted.skills.map((s, i) => (
                      <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: ABGL, color: ACC, border: `1px solid ${ABDR}` }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {cvExtracted.education.length > 0 && (
                <div>
                  <p className="text-[9.5px] font-semibold tracking-wide mb-1" style={{ color: '#6B7280' }}>EDUCATION</p>
                  {cvExtracted.education.map((e, i) => (
                    <p key={i} className="text-[10.5px]" style={{ color: '#374151' }}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── What happens next ── */}
      <div className="mx-4 mb-3 rounded-xl px-4 py-3" style={{ background: ABGL, border: `1px solid ${ABDR}` }}>
        <p className="text-[11px] font-semibold mb-2" style={{ color: NAVY }}>What happens next</p>
        <div className="space-y-1.5">
          {[
            '10 Insight-stage questions calibrated to your role and concern',
            'Competency gap vector computed from your profile vs. role benchmark',
            'Personalised report with ranked gaps and decoding pathways',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[9px] font-bold mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                style={{ background: ACC, color: '#fff' }}>{i + 1}</span>
              <p className="text-[11px] leading-snug" style={{ color: '#374151' }}>{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="mx-4 mb-4 mt-2">
        <button onClick={handleBegin} disabled={submitting}
          className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 text-[15px] font-bold text-white transition-all"
          style={{
            background: submitting ? '#93C5FD' : `linear-gradient(135deg, ${NAVY} 0%, ${ACC} 100%)`,
            cursor: submitting ? 'default' : 'pointer',
          }}>
          {submitting ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Setting up your analysis…</>
          ) : (
            <>
              Begin Competency Analysis
              <svg viewBox="0 0 14 14" style={{ width: 13, height: 13 }} fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </button>
        <p className="text-center text-[10.5px] mt-2" style={{ color: '#9CA3AF' }}>
          Your answers are confidential and used solely for your competency report.
        </p>
      </div>
    </div>
  );
}
