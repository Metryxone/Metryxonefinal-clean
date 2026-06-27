/**
 * MX-302B — Career Discovery & AI Guidance (frontend)
 * ----------------------------------------------------------------------------
 * Flag-gated experience that runs BEFORE Career Builder. When the
 * `careerDiscovery` flag is OFF the gate endpoint 503s and this page renders an
 * honest "not available" state and offers to continue to Career Builder.
 *
 * Composes the backend discovery surfaces:
 *   GET  /api/career-discovery/enabled
 *   GET  /api/career-discovery/status
 *   GET  /api/career-discovery/values/questions
 *   POST /api/career-discovery/values
 *   GET  /api/career-discovery/profile
 *   GET  /api/career-discovery/explorer
 *   GET  /api/career-discovery/guidance
 *   POST /api/career-discovery/complete
 *
 * Honesty: null is never rendered as 0; empty states are explicit; AI guidance
 * surfaces its honest mode (LLM vs rule-based) label.
 */
import { useEffect, useState, useCallback } from 'react';
import { BRAND, RADIUS, SHADOW } from '../design-system/tokens';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

type Screen = string;
interface Props {
  onNavigate: (screen: Screen) => void;
}

// MetryxOne brand identity gradient (deep-navy → teal accent).
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.primary} 55%, ${BRAND.accent} 100%)`;

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const jsonHeaders = (): Record<string, string> => ({ 'Content-Type': 'application/json', ...authHeader() });

// ── API shapes (mirrors backend services) ───────────────────────────────────
interface ValuesQuestion {
  id: string;
  dimension: string;
  prompt: string;
  scale: { min: number; max: number; lowLabel: string; highLabel: string };
}
interface DimScore { dimension: string; label: string; score: number | null; answered: number; total: number; }
interface ValuesScore {
  measurable: boolean;
  dimensions: DimScore[];
  top_values: Array<{ dimension: string; label: string; score: number }>;
  coverage: { answered: number; total: number; pct: number };
}
interface DiscoveryStatus {
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  values_completed: boolean;
  compatibility_score: number | null;
  hasCompletedDiscovery?: boolean;
}
interface DiscoveryProfile {
  values: ValuesScore | null;
  top_matches: Array<{ role_id: string; role_name: string; match_percentage: number | null; confidence: string | null }>;
  mei: { composite_score: number | null; band: string | null } | null;
  compatibility_score: number | null;
  coverage: { values: boolean; matches: boolean; mei: boolean };
}
interface ExplorerRole {
  role_id: string;
  role_name: string;
  family: string | null;
  match_percentage: number | null;
  confidence: string | null;
  explanation: string | null;
}
interface ExplorerView { measurable: boolean; roles: ExplorerRole[]; anchor: ExplorerRole | null; note?: string; }
interface MarketIndustry { industry_id: string; industry_name: string; measurable: boolean; readiness_score: number | null; readiness_band: string | null; }
interface MarketFunction { function_id: string; function_name: string; measurable: boolean; readiness_score: number | null; readiness_band: string | null; }
interface MarketSalary { occupation_id: string; title: string | null; role_family: string | null; salary_min: number | null; salary_max: number | null; currency: string | null; demand_score: number | null; hiring_trend: string | null; }
interface MarketEmerging { occupation_id: string; title: string | null; role_family: string | null; future_relevance_score: number | null; hiring_trend: string | null; }
interface ExplorerMarket {
  measurable: boolean;
  industries: MarketIndustry[];
  functions: MarketFunction[];
  salaries: MarketSalary[];
  emerging_careers: MarketEmerging[];
  notes: string[];
}
interface Guidance {
  ai_available: boolean;
  ai_mode: 'llm' | 'rule_based';
  ai_note: string;
  coach: { headline: string; body: string; actions: string[] };
  recommendations: any[];
  roadmap_milestones: any[];
  development_streams: any[];
  nudges: string[];
  daily_brief: { headline: string; focus: string | null; items: string[] };
  weekly_goals: string[];
  monthly_roadmap: { horizon: string; milestones: Array<{ title: string; detail: string | null }> };
  competency_advice: Array<{ area: string; advice: string }>;
  industry_trends: { measurable: boolean; rising: string[]; declining: string[]; emerging: string[]; note?: string };
  coverage: { recommendations: boolean; roadmap: boolean; development: boolean; industry_trends: boolean };
}

type Step = 'intro' | 'values' | 'profile' | 'explore' | 'guidance';

const card: React.CSSProperties = {
  background: BRAND.cardBg,
  border: `1px solid ${BRAND.border}`,
  borderRadius: RADIUS.xl,
  boxShadow: SHADOW.sm,
  padding: 24,
};

const chip: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 12px',
  borderRadius: 999,
  border: `1px solid ${BRAND.border}`,
  background: BRAND.cardBg,
  color: BRAND.text,
  fontSize: 13,
};

function pctLabel(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : `${Math.round(v)}%`;
}

export function CareerDiscoveryPage({ onNavigate }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('intro');

  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [questions, setQuestions] = useState<ValuesQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null);
  const [explorer, setExplorer] = useState<ExplorerView | null>(null);
  const [market, setMarket] = useState<ExplorerMarket | null>(null);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Gate probe + initial loads ────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/career-discovery/enabled', { credentials: 'include' });
        const j = await r.json().catch(() => ({ enabled: false }));
        if (!alive) return;
        const on = !!j?.enabled;
        setEnabled(on);
        if (on) {
          const [sR, qR] = await Promise.all([
            fetch('/api/career-discovery/status', { headers: authHeader(), credentials: 'include' }),
            fetch('/api/career-discovery/values/questions', { headers: authHeader(), credentials: 'include' }),
          ]);
          const sJ = await sR.json().catch(() => null);
          const qJ = await qR.json().catch(() => null);
          if (!alive) return;
          if (sJ?.ok) setStatus(sJ as DiscoveryStatus);
          if (qJ?.ok && Array.isArray(qJ.questions)) setQuestions(qJ.questions);
        }
      } catch {
        if (alive) setEnabled(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const loadProfile = useCallback(async () => {
    const r = await fetch('/api/career-discovery/profile', { headers: authHeader(), credentials: 'include' });
    const j = await r.json().catch(() => null);
    if (j?.ok) setProfile(j as DiscoveryProfile);
  }, []);

  const loadExplorer = useCallback(async () => {
    const r = await fetch('/api/career-discovery/explorer', { headers: authHeader(), credentials: 'include' });
    const j = await r.json().catch(() => null);
    if (j?.ok) setExplorer(j as ExplorerView);
    const mr = await fetch('/api/career-discovery/explorer/market', { headers: authHeader(), credentials: 'include' });
    const mj = await mr.json().catch(() => null);
    if (mj?.ok) setMarket(mj as ExplorerMarket);
  }, []);

  const loadGuidance = useCallback(async () => {
    const r = await fetch('/api/career-discovery/guidance', { headers: authHeader(), credentials: 'include' });
    const j = await r.json().catch(() => null);
    if (j?.ok) setGuidance(j as Guidance);
  }, []);

  const submitValues = useCallback(async () => {
    setBusy(true);
    try {
      await fetch('/api/career-discovery/values', {
        method: 'POST', headers: jsonHeaders(), credentials: 'include',
        body: JSON.stringify({ responses }),
      });
      await loadProfile();
      setStep('profile');
    } finally {
      setBusy(false);
    }
  }, [responses, loadProfile]);

  const finishDiscovery = useCallback(async (skip: boolean) => {
    setBusy(true);
    try {
      await fetch('/api/career-discovery/complete', {
        method: 'POST', headers: jsonHeaders(), credentials: 'include',
        body: JSON.stringify({ skip }),
      });
    } finally {
      setBusy(false);
      onNavigate('career-builder');
    }
  }, [onNavigate]);

  // ── Loading / disabled states ─────────────────────────────────────────────
  if (loading) {
    return (
      <Shell onNavigate={onNavigate}>
        <div style={{ ...card, textAlign: 'center' }}>Loading Career Discovery…</div>
      </Shell>
    );
  }

  if (enabled === false) {
    return (
      <Shell onNavigate={onNavigate}>
        <div style={{ ...card, textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ color: BRAND.text, marginBottom: 8 }}>Career Discovery isn’t available yet</h2>
          <p style={{ color: BRAND.muted, marginBottom: 20 }}>
            This guided discovery experience is currently turned off. You can head straight to
            Career Builder.
          </p>
          <PrimaryBtn onClick={() => onNavigate('career-builder')}>Go to Career Builder</PrimaryBtn>
        </div>
      </Shell>
    );
  }

  return (
    <Shell onNavigate={onNavigate}>
      <StepNav step={step} setStep={(s) => {
        setStep(s);
        if (s === 'profile' && !profile) void loadProfile();
        if (s === 'explore' && !explorer) void loadExplorer();
        if (s === 'guidance' && !guidance) void loadGuidance();
      }} />

      {step === 'intro' && (
        <IntroStep status={status} onStart={() => setStep('values')} onSkip={() => finishDiscovery(true)} busy={busy} />
      )}

      {step === 'values' && (
        <ValuesStep
          questions={questions}
          responses={responses}
          setResponse={(id, v) => setResponses((p) => ({ ...p, [id]: v }))}
          onSubmit={submitValues}
          busy={busy}
        />
      )}

      {step === 'profile' && (
        <ProfileStep profile={profile} onExplore={() => { setStep('explore'); if (!explorer) void loadExplorer(); }} />
      )}

      {step === 'explore' && (
        <ExploreStep explorer={explorer} market={market} onGuidance={() => { setStep('guidance'); if (!guidance) void loadGuidance(); }} />
      )}

      {step === 'guidance' && (
        <GuidanceStep guidance={guidance} onFinish={() => finishDiscovery(false)} busy={busy} />
      )}
    </Shell>
  );
}

// ── Layout primitives ────────────────────────────────────────────────────────
function Shell({ onNavigate, children }: { onNavigate: (s: Screen) => void; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: BRAND.bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
      <Navbar onNavigate={onNavigate} currentScreen="career-discovery" />
      <div style={{ flex: 1, padding: '32px 20px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <header
            style={{
              marginBottom: 24,
              padding: '32px 28px',
              borderRadius: RADIUS.xl,
              background: BRAND_GRADIENT,
              boxShadow: SHADOW.md,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 }}>
              Career Discovery
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: '8px 0 6px', color: '#fff' }}>Discover your direction</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.92, margin: 0, maxWidth: 560 }}>
              A guided, few-minute journey to surface what fits — before you build your career.
            </p>
          </header>
          {children}
        </div>
      </div>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'intro', label: 'Start' },
  { id: 'values', label: 'Values' },
  { id: 'profile', label: 'Profile' },
  { id: 'explore', label: 'Explore' },
  { id: 'guidance', label: 'Guidance' },
];

function StepNav({ step, setStep }: { step: Step; setStep: (s: Step) => void }) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
      {STEPS.map((s, i) => {
        const active = s.id === step;
        const done = i < idx;
        return (
          <button
            key={s.id}
            onClick={() => done && setStep(s.id)}
            disabled={!done && !active}
            style={{
              flex: '1 1 auto', minWidth: 90, padding: '8px 12px', borderRadius: RADIUS.full,
              border: `1px solid ${active ? 'transparent' : done ? BRAND.accent : BRAND.border}`,
              background: active ? BRAND_GRADIENT : done ? BRAND.accentLight : BRAND.cardBg,
              color: active ? '#fff' : done ? BRAND.green : BRAND.muted,
              fontWeight: 600, fontSize: 13, cursor: done ? 'pointer' : 'default',
            }}
          >
            {i + 1}. {s.label}
          </button>
        );
      })}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 22px', borderRadius: RADIUS.md, border: 'none',
        background: disabled ? BRAND.slate : BRAND_GRADIENT, color: '#fff',
        fontWeight: 600, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : SHADOW.sm,
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 22px', borderRadius: RADIUS.md,
        border: `1px solid ${BRAND.border}`, background: BRAND.cardBg, color: BRAND.muted,
        fontWeight: 600, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, borderRadius: RADIUS.md, background: BRAND.bg, color: BRAND.muted, fontSize: 14, textAlign: 'center' }}>
      {children}
    </div>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────
function IntroStep({ status, onStart, onSkip, busy }: { status: DiscoveryStatus | null; onStart: () => void; onSkip: () => void; busy: boolean }) {
  return (
    <div style={card}>
      <h2 style={{ color: BRAND.text, marginTop: 0 }}>Before you build, let’s discover what fits</h2>
      <p style={{ color: BRAND.muted, lineHeight: 1.6 }}>
        Career Discovery takes a few minutes. We’ll capture what you value at work, then compose your
        existing assessment results into a profile, explore matching roles, and end with personalised
        guidance. Nothing here is a hiring or suitability prediction — it’s a developmental starting point.
      </p>
      {status?.values_completed && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: RADIUS.md, background: BRAND.primaryLight, color: BRAND.primary, fontSize: 14 }}>
          You’ve already completed the values inventory — you can review your profile or continue.
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        <PrimaryBtn onClick={onStart} disabled={busy}>Start discovery</PrimaryBtn>
        <GhostBtn onClick={onSkip} disabled={busy}>Skip to Career Builder</GhostBtn>
      </div>
    </div>
  );
}

function ValuesStep({
  questions, responses, setResponse, onSubmit, busy,
}: {
  questions: ValuesQuestion[];
  responses: Record<string, number>;
  setResponse: (id: string, v: number) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const answered = questions.filter((q) => responses[q.id] != null).length;
  return (
    <div style={card}>
      <h2 style={{ color: BRAND.text, marginTop: 0 }}>Work Values Inventory</h2>
      <p style={{ color: BRAND.muted }}>Rate how much you agree with each statement. You can leave any blank.</p>
      {questions.length === 0 ? (
        <EmptyNote>No values questions are available right now.</EmptyNote>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
          {questions.map((q) => (
            <div key={q.id} style={{ borderBottom: `1px solid ${BRAND.border}`, paddingBottom: 14 }}>
              <div style={{ color: BRAND.text, fontWeight: 500, marginBottom: 10 }}>{q.prompt}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: BRAND.muted, width: 90 }}>{q.scale.lowLabel}</span>
                {[1, 2, 3, 4, 5].map((v) => {
                  const sel = responses[q.id] === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setResponse(q.id, v)}
                      style={{
                        width: 40, height: 40, borderRadius: RADIUS.full,
                        border: `1px solid ${sel ? BRAND.primary : BRAND.border}`,
                        background: sel ? BRAND.primary : BRAND.cardBg,
                        color: sel ? '#fff' : BRAND.muted, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
                <span style={{ fontSize: 11, color: BRAND.muted, width: 90, textAlign: 'right' }}>{q.scale.highLabel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
        <span style={{ color: BRAND.muted, fontSize: 13 }}>{answered} of {questions.length} answered</span>
        <PrimaryBtn onClick={onSubmit} disabled={busy || answered === 0}>
          {busy ? 'Saving…' : 'See my profile'}
        </PrimaryBtn>
      </div>
    </div>
  );
}

function ProfileStep({ profile, onExplore }: { profile: DiscoveryProfile | null; onExplore: () => void }) {
  if (!profile) return <div style={card}><EmptyNote>Building your profile…</EmptyNote></div>;
  const { values, top_matches, compatibility_score, coverage } = profile;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <h2 style={{ color: BRAND.text, marginTop: 0 }}>Your discovery profile</h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Stat label="Career compatibility" value={pctLabel(compatibility_score)} hint={compatibility_score == null ? 'Not measurable yet' : undefined} />
          <Stat label="Values coverage" value={values ? `${values.coverage.pct}%` : '—'} />
        </div>
      </div>

      <div style={card}>
        <h3 style={{ color: BRAND.text, marginTop: 0 }}>What you value most</h3>
        {!values || !values.measurable || values.top_values.length === 0 ? (
          <EmptyNote>No values captured yet — complete the inventory to see this.</EmptyNote>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {values.top_values.map((v) => (
              <Bar key={v.dimension} label={v.label} value={v.score} />
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ color: BRAND.text, marginTop: 0 }}>Top role matches</h3>
        {!coverage.matches || top_matches.length === 0 ? (
          <EmptyNote>No measurable role matches yet — complete the competency assessment in Career Builder to unlock these.</EmptyNote>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top_matches.map((m) => (
              <div key={m.role_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: RADIUS.md, background: BRAND.bg }}>
                <span style={{ color: BRAND.text, fontWeight: 500 }}>{m.role_name}</span>
                <span style={{ color: BRAND.primary, fontWeight: 600 }}>{pctLabel(m.match_percentage)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <PrimaryBtn onClick={onExplore}>Explore careers</PrimaryBtn>
      </div>
    </div>
  );
}

function ExploreStep({ explorer, market, onGuidance }: { explorer: ExplorerView | null; market: ExplorerMarket | null; onGuidance: () => void }) {
  if (!explorer) return <div style={card}><EmptyNote>Loading career explorer…</EmptyNote></div>;
  const salaryLabel = (s: MarketSalary): string => {
    if (s.salary_min == null && s.salary_max == null) return '—';
    const cur = s.currency || '';
    const fmt = (n: number) => `${cur}${Math.round(n).toLocaleString()}`;
    if (s.salary_min != null && s.salary_max != null) return `${fmt(s.salary_min)}–${fmt(s.salary_max)}`;
    return fmt((s.salary_min ?? s.salary_max) as number);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <h2 style={{ color: BRAND.text, marginTop: 0 }}>Career Explorer</h2>
        {!explorer.measurable || explorer.roles.length === 0 ? (
          <EmptyNote>{explorer.note || 'No measurable role matches yet.'}</EmptyNote>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {explorer.roles.map((r) => (
              <div key={r.role_id} style={{ padding: 14, borderRadius: RADIUS.md, border: `1px solid ${BRAND.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: BRAND.text, fontWeight: 600 }}>{r.role_name}</span>
                  <span style={{ color: BRAND.primary, fontWeight: 700 }}>{pctLabel(r.match_percentage)}</span>
                </div>
                {r.family && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 2 }}>{r.family}</div>}
                {r.explanation && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{r.explanation}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ color: BRAND.text, marginTop: 0 }}>Explore the market</h3>
        {!market ? (
          <EmptyNote>Loading market view…</EmptyNote>
        ) : !market.measurable && market.salaries.length === 0 ? (
          <EmptyNote>{market.notes[0] || 'No market data available yet.'}</EmptyNote>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {market.industries.length > 0 && (
              <div>
                <div style={{ color: BRAND.slate, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Industry readiness</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {market.industries.map((i) => (
                    <span key={i.industry_id} style={chip}>
                      {i.industry_name}{i.readiness_score != null ? ` · ${pctLabel(i.readiness_score)}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {market.functions.length > 0 && (
              <div>
                <div style={{ color: BRAND.slate, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Function readiness</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {market.functions.map((f) => (
                    <span key={f.function_id} style={chip}>
                      {f.function_name}{f.readiness_score != null ? ` · ${pctLabel(f.readiness_score)}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {market.salaries.length > 0 && (
              <div>
                <div style={{ color: BRAND.slate, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Salary ranges</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {market.salaries.slice(0, 8).map((s) => (
                    <div key={s.occupation_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: BRAND.text }}>{s.title || s.role_family || s.occupation_id}</span>
                      <span style={{ color: BRAND.muted }}>{salaryLabel(s)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {market.emerging_careers.length > 0 && (
              <div>
                <div style={{ color: BRAND.slate, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Emerging careers</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {market.emerging_careers.map((e) => (
                    <span key={e.occupation_id} style={chip}>{e.title || e.role_family || e.occupation_id}</span>
                  ))}
                </div>
              </div>
            )}
            {market.notes.length > 0 && market.salaries.length === 0 && (
              <EmptyNote>{market.notes[0]}</EmptyNote>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <PrimaryBtn onClick={onGuidance}>Get guidance</PrimaryBtn>
      </div>
    </div>
  );
}

function GuidanceStep({ guidance, onFinish, busy }: { guidance: Guidance | null; onFinish: () => void; busy: boolean }) {
  if (!guidance) return <div style={card}><EmptyNote>Preparing your guidance…</EmptyNote></div>;
  const modeLabel = guidance.ai_mode === 'llm' ? 'AI coach' : 'Guided (rule-based)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ color: BRAND.text, margin: 0 }}>{guidance.coach.headline}</h2>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: RADIUS.full,
            background: guidance.ai_mode === 'llm' ? BRAND.accentLight : BRAND.primaryLight,
            color: guidance.ai_mode === 'llm' ? BRAND.green : BRAND.primary,
          }}>{modeLabel}</span>
        </div>
        <p style={{ color: BRAND.muted, lineHeight: 1.6 }}>{guidance.coach.body}</p>
        {guidance.coach.actions.length > 0 && (
          <ul style={{ color: BRAND.text, lineHeight: 1.8, paddingLeft: 20, marginBottom: 0 }}>
            {guidance.coach.actions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        )}
        {guidance.ai_note && (
          <div style={{ marginTop: 12, fontSize: 12, color: BRAND.slate }}>{guidance.ai_note}</div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ color: BRAND.text, marginTop: 0 }}>Today’s focus</h3>
        <div style={{ color: BRAND.text, fontWeight: 600, marginBottom: 6 }}>{guidance.daily_brief.headline}</div>
        {guidance.daily_brief.focus && <p style={{ color: BRAND.muted, marginTop: 0, lineHeight: 1.6 }}>{guidance.daily_brief.focus}</p>}
        {guidance.daily_brief.items.length > 0 && (
          <ul style={{ color: BRAND.text, lineHeight: 1.8, paddingLeft: 20, marginBottom: 0 }}>
            {guidance.daily_brief.items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        )}
      </div>

      {guidance.weekly_goals.length > 0 && (
        <div style={card}>
          <h3 style={{ color: BRAND.text, marginTop: 0 }}>This week’s goals</h3>
          <ul style={{ color: BRAND.text, lineHeight: 1.8, paddingLeft: 20, marginBottom: 0 }}>
            {guidance.weekly_goals.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}

      {guidance.monthly_roadmap.milestones.length > 0 && (
        <div style={card}>
          <h3 style={{ color: BRAND.text, marginTop: 0 }}>{guidance.monthly_roadmap.horizon} roadmap</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {guidance.monthly_roadmap.milestones.map((m, i) => (
              <div key={i} style={{ padding: 12, borderRadius: RADIUS.md, border: `1px solid ${BRAND.border}` }}>
                <div style={{ color: BRAND.text, fontWeight: 600 }}>{m.title}</div>
                {m.detail && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{m.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {guidance.competency_advice.length > 0 && (
        <div style={card}>
          <h3 style={{ color: BRAND.text, marginTop: 0 }}>Competency advice</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {guidance.competency_advice.map((c, i) => (
              <div key={i} style={{ padding: 12, borderRadius: RADIUS.md, background: BRAND.bg }}>
                <div style={{ color: BRAND.text, fontWeight: 600 }}>{c.area}</div>
                <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{c.advice}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <h3 style={{ color: BRAND.text, marginTop: 0 }}>Industry trends</h3>
        {!guidance.industry_trends.measurable ? (
          <EmptyNote>{guidance.industry_trends.note || 'No labor-market data available yet.'}</EmptyNote>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {guidance.industry_trends.rising.length > 0 && (
              <div>
                <div style={{ color: BRAND.slate, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Rising</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {guidance.industry_trends.rising.map((t, i) => <span key={i} style={chip}>{t}</span>)}
                </div>
              </div>
            )}
            {guidance.industry_trends.emerging.length > 0 && (
              <div>
                <div style={{ color: BRAND.slate, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Emerging</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {guidance.industry_trends.emerging.map((t, i) => <span key={i} style={chip}>{t}</span>)}
                </div>
              </div>
            )}
            {guidance.industry_trends.declining.length > 0 && (
              <div>
                <div style={{ color: BRAND.slate, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Declining</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {guidance.industry_trends.declining.map((t, i) => <span key={i} style={chip}>{t}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {guidance.nudges.length > 0 && (
        <div style={card}>
          <h3 style={{ color: BRAND.text, marginTop: 0 }}>Quick nudges</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {guidance.nudges.map((n, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: RADIUS.md, background: BRAND.bg, color: BRAND.text, fontSize: 14 }}>{n}</div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <h3 style={{ color: BRAND.text, marginTop: 0 }}>Where to go next</h3>
        <p style={{ color: BRAND.muted }}>
          Continue to Career Builder to act on your recommendations, roadmap, and development streams.
        </p>
        <PrimaryBtn onClick={onFinish} disabled={busy}>{busy ? 'Finishing…' : 'Continue to Career Builder'}</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Small display helpers ────────────────────────────────────────────────────
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: BRAND.primary }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: BRAND.slate }}>{hint}</div>}
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: BRAND.text, marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 8, borderRadius: RADIUS.full, background: BRAND.border, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: BRAND.primary }} />
      </div>
    </div>
  );
}

export default CareerDiscoveryPage;
