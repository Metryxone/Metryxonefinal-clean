/**
 * Employability Passport — presentational + owner/recruiter wrappers (T-P7).
 *
 * Additive & reuse-only: renders a snapshot built by `passportClient`, reusing
 * the Career OS `SectionCard` + `COLOR` canon. One presentational component
 * (`EmployabilityPassport`) serves both the owner (in-page, with sharing +
 * visibility controls) and the public recruiter view (read-only, contact
 * already stripped server-side).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, ShieldCheck, TrendingUp, Briefcase, GraduationCap, Brain, Sparkles,
  FileText, Eye, EyeOff, Link2, Download, X, Copy, Check, BadgeCheck, Loader2,
} from 'lucide-react';
import { SectionCard } from '@/components/career';
import { COLOR } from '@/design-system';
import {
  assemblePassportSnapshot, createShareLink, revokeShareLink, getShareStatus,
  fetchPublicPassport, defaultVisibility, PASSPORT_SECTION_KEYS, PASSPORT_SECTION_LABELS,
  type PassportSnapshot, type PassportVisibility, type PassportSectionKey, type ShareStatus,
} from '@/lib/passport/passportClient';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', green: '#2A9D8F' };
const BORDER = '#E8EBF4';

function bandColor(band: string): string {
  switch (band) {
    case 'Elite': return BRAND.green;
    case 'Strong': return BRAND.primary;
    case 'Developing': return '#f4a261';
    default: return '#94a3b8';
  }
}

const SECTION_ICON: Record<PassportSectionKey, React.ReactNode> = {
  competencies: <Brain size={16} />,
  assessment: <Sparkles size={16} />,
  skills: <Award size={16} />,
  projects: <Briefcase size={16} />,
  certifications: <GraduationCap size={16} />,
  careerReadiness: <TrendingUp size={16} />,
  verifiedCredentials: <ShieldCheck size={16} />,
  growthReport: <TrendingUp size={16} />,
};

function Chips({ items, color }: { items: string[]; color?: string }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${color ?? BRAND.primary}14`, color: color ?? BRAND.primary }}>{s}</span>
      ))}
    </div>
  );
}

// ── Per-section renderers (null-safe; only render when data present) ──────────
function renderSection(key: PassportSectionKey, snapshot: PassportSnapshot): React.ReactNode {
  const s = snapshot.sections;
  switch (key) {
    case 'competencies': {
      const d = s.competencies; if (!d?.items?.length) return null;
      return (
        <div className="space-y-2">
          {d.items.map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-gray-700">{c.label}</span>
                <span className="font-semibold" style={{ color: BRAND.primary }}>{c.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, c.value))}%`, background: BRAND.primary }} />
              </div>
            </div>
          ))}
        </div>
      );
    }
    case 'assessment': {
      const d = s.assessment; if (!d) return null;
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">{d.headline}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Signals', d.signals], ['Patterns', d.patterns], ['Risk flags', d.risks]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-gray-50 p-2">
                <div className="text-lg font-bold text-gray-800">{v as number}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{l}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'skills': {
      const d = s.skills; if (!d) return null;
      const groups: [string, string[]][] = [['Technical', d.technical], ['Soft', d.soft], ['Tools', d.tools], ['Languages', d.languages]];
      return (
        <div className="space-y-3">
          {groups.filter(([, arr]) => arr.length).map(([label, arr]) => (
            <div key={label}>
              <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{label}</div>
              <Chips items={arr} />
            </div>
          ))}
        </div>
      );
    }
    case 'projects': {
      const d = s.projects; if (!d?.length) return null;
      return (
        <div className="space-y-2.5">
          {d.map((p, i) => (
            <div key={i} className="border-l-2 pl-3" style={{ borderColor: BRAND.accent }}>
              <div className="text-sm font-semibold text-gray-800">{p.title}</div>
              {p.description && <div className="text-xs text-gray-600 line-clamp-2">{p.description}</div>}
            </div>
          ))}
        </div>
      );
    }
    case 'certifications': {
      const d = s.certifications; if (!d?.length) return null;
      return (
        <div className="space-y-2">
          {d.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <BadgeCheck size={15} style={{ color: BRAND.green }} />
              <span className="text-sm text-gray-800">{c.name}</span>
              {c.authority && <span className="text-xs text-gray-400">· {c.authority}</span>}
            </div>
          ))}
        </div>
      );
    }
    case 'careerReadiness': {
      const d = s.careerReadiness; if (!d) return null;
      return (
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-4xl font-black" style={{ color: bandColor(d.band) }}>{d.eiScore}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">EI Score</div>
          </div>
          <div className="flex-1">
            <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: bandColor(d.band) }}>{d.band}</span>
            <div className="mt-2 text-xs text-gray-500">Profile completeness: <span className="font-semibold text-gray-700">{d.completeness}%</span></div>
          </div>
        </div>
      );
    }
    case 'verifiedCredentials': {
      const d = s.verifiedCredentials; if (!d) return null;
      return (
        <div className="space-y-2">
          {d.trustScore != null && (
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} style={{ color: BRAND.green }} />
              <span className="text-sm text-gray-700">Trust score</span>
              <span className="ml-auto text-lg font-bold" style={{ color: BRAND.green }}>{d.trustScore}{d.level ? ` · ${d.level}` : ''}</span>
            </div>
          )}
          {d.items.length > 0 && <Chips items={d.items.map((x) => x.label)} color={BRAND.green} />}
          {d.trustScore == null && d.items.length === 0 && <p className="text-xs text-gray-400">No verified credentials yet.</p>}
        </div>
      );
    }
    case 'growthReport': {
      const d = s.growthReport; if (!d) return null;
      const block = (label: string, arr: string[], color: string) => arr.length ? (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{label}</div>
          <Chips items={arr} color={color} />
        </div>
      ) : null;
      return (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{d.snapshots} tracked snapshot{d.snapshots === 1 ? '' : 's'}</p>
          {block('Improving', d.improving, BRAND.green)}
          {block('Emerging patterns', d.emerging, BRAND.primary)}
          {block('Stable strengths', d.stable, '#64748b')}
        </div>
      );
    }
    default: return null;
  }
}

// ── Presentational passport ──────────────────────────────────────────────────
export function EmployabilityPassport({
  snapshot, mode, visibility, onToggle, contentRef,
}: {
  snapshot: PassportSnapshot;
  mode: 'owner' | 'recruiter';
  visibility?: PassportVisibility;
  onToggle?: (key: PassportSectionKey) => void;
  contentRef?: React.RefObject<HTMLDivElement>;
}) {
  const vis = visibility ?? defaultVisibility();
  return (
    <div ref={contentRef} className="space-y-4" style={{ background: '#F7F8FC' }}>
      {/* Header */}
      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${BRAND.primary}, #243b6b)` }}>
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest opacity-80">
          <FileText size={14} /> Employability Passport
        </div>
        <h1 className="text-2xl font-black mt-2">{snapshot.header.name}</h1>
        {snapshot.header.headline && <p className="text-sm opacity-90 mt-1 max-w-2xl">{snapshot.header.headline}</p>}
        <div className="flex items-center gap-3 mt-4">
          <div className="bg-white/15 rounded-xl px-4 py-2">
            <div className="text-2xl font-black">{snapshot.header.eiScore}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-80">EI Score</div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: bandColor(snapshot.header.eiBand), color: '#fff' }}>{snapshot.header.eiBand}</span>
        </div>
      </div>

      {/* Sections */}
      <div className="grid md:grid-cols-2 gap-4">
        {PASSPORT_SECTION_KEYS.map((key) => {
          const body = renderSection(key, snapshot);
          // Recruiter: snapshot is already visibility-filtered server-side — skip empty.
          if (mode === 'recruiter' && !body) return null;
          // Owner: always list each section so they can toggle visibility, but mark empty.
          if (mode === 'owner' && !body && !onToggle) return null;
          const hidden = mode === 'owner' && !vis[key];
          return (
            <div key={key} className={hidden ? 'opacity-50' : ''}>
              <SectionCard
                title={PASSPORT_SECTION_LABELS[key]}
                icon={SECTION_ICON[key]}
                action={mode === 'owner' && onToggle ? (
                  <button
                    onClick={() => onToggle(key)}
                    className="flex items-center gap-1 text-[11px] font-semibold"
                    style={{ color: vis[key] ? BRAND.primary : '#94a3b8' }}
                    title={vis[key] ? 'Visible to recruiters' : 'Hidden from recruiters'}
                  >
                    {vis[key] ? <Eye size={14} /> : <EyeOff size={14} />}
                    {vis[key] ? 'Visible' : 'Hidden'}
                  </button>
                ) : undefined}
              >
                {body ?? <p className="text-xs text-gray-400">No data yet for this section.</p>}
              </SectionCard>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 text-center pt-2">
        Generated {new Date(snapshot.generatedAt).toLocaleDateString()} · Contact details are private and never shared.
      </p>
    </div>
  );
}

// ── PDF export (reuses the platform's html2canvas + jsPDF pattern) ───────────
async function exportPassportPdf(el: HTMLElement | null, name: string) {
  if (!el) return;
  const [{ default: html2canvas }, jspdfMod] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const jsPDF = (jspdfMod as any).jsPDF ?? (jspdfMod as any).default;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#F7F8FC', useCORS: true });
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pw = 210, ph = 297;
  const ih = (canvas.height * pw) / canvas.width;
  let left = ih, pos = 0;
  pdf.addImage(img, 'PNG', 0, pos, pw, ih);
  left -= ph;
  while (left > 0) { pos -= ph; pdf.addPage(); pdf.addImage(img, 'PNG', 0, pos, pw, ih); left -= ph; }
  pdf.save(`Employability-Passport-${name.replace(/\s+/g, '-')}.pdf`);
}

// ── Owner modal (in-page; assembles snapshot + sharing controls) ─────────────
export function PassportOwnerModal({
  userId, profile, eiScore, eiBreakdown, onClose,
}: {
  userId: string;
  profile: any;
  eiScore: number;
  eiBreakdown?: { total: number; components: any[] };
  onClose: () => void;
}) {
  const [snapshot, setSnapshot] = useState<PassportSnapshot | null>(null);
  const [visibility, setVisibility] = useState<PassportVisibility>(defaultVisibility());
  const [share, setShare] = useState<ShareStatus>({ shared: false });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [snap, status] = await Promise.all([
          assemblePassportSnapshot({ userId, profile, eiScore, eiBreakdown }),
          getShareStatus(userId).catch(() => ({ shared: false } as ShareStatus)),
        ]);
        if (!alive) return;
        setSnapshot(snap);
        setShare(status);
        if (status.visibility) setVisibility(status.visibility);
      } catch {
        if (!alive) return;
        setErr('Could not assemble your passport. Please close and try again.');
      }
    })();
    return () => { alive = false; };
  }, [userId, profile, eiScore, eiBreakdown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const toggle = (key: PassportSectionKey) => setVisibility((v) => ({ ...v, [key]: !v[key] }));

  const doShare = async () => {
    if (!snapshot) return;
    setBusy(true); setErr(null);
    try { setShare(await createShareLink(userId, snapshot, visibility)); }
    catch (e: any) { setErr(e?.message === 'feature_disabled' ? 'Passport sharing is currently disabled.' : 'Could not create the link. Please try again.'); }
    finally { setBusy(false); }
  };
  const doRevoke = async () => {
    setBusy(true); setErr(null);
    try { setShare(await revokeShareLink(userId)); } catch { setErr('Could not revoke the link.'); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    if (!share.url) return;
    try { await navigator.clipboard.writeText(share.url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
        <div className="w-full max-w-4xl bg-[#F7F8FC] rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ border: `1px solid ${BORDER}` }}>
          {/* Toolbar */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-3 bg-white rounded-t-2xl border-b" style={{ borderColor: BORDER }}>
            <span className="text-sm font-black uppercase tracking-widest" style={{ color: BRAND.primary }}>My Passport</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!share.shared ? (
                <button onClick={doShare} disabled={busy || !snapshot} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: BRAND.primary }}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Create shareable link
                </button>
              ) : (
                <>
                  <button onClick={copy} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: BRAND.primary, color: BRAND.primary }}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <button onClick={doShare} disabled={busy} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: BRAND.primary }}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Update
                  </button>
                  <button onClick={doRevoke} disabled={busy} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 disabled:opacity-50">Revoke</button>
                </>
              )}
              <button onClick={() => exportPassportPdf(contentRef.current, snapshot?.header.name ?? 'passport')} disabled={!snapshot} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: BORDER }}>
                <Download size={14} /> PDF
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
          </div>

          {share.shared && share.url && (
            <div className="px-4 py-2 text-xs bg-emerald-50 text-emerald-700 flex items-center gap-2 break-all">
              <ShieldCheck size={14} /> Live link: <span className="font-mono">{share.url}</span>
            </div>
          )}
          {err && <div className="px-4 py-2 text-xs bg-red-50 text-red-600">{err}</div>}

          <div className="p-4">
            {!snapshot ? (
              <div className="flex items-center justify-center py-20 text-gray-400 gap-2"><Loader2 size={18} className="animate-spin" /> Building your passport…</div>
            ) : (
              <EmployabilityPassport snapshot={snapshot} mode="owner" visibility={visibility} onToggle={toggle} contentRef={contentRef} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Public recruiter view (reads token from the URL; no auth) ────────────────
export function PassportRecruiterView() {
  const [state, setState] = useState<{ loading: boolean; snapshot?: PassportSnapshot; error?: string }>({ loading: true });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = window.location.pathname.split('/')[2] ?? '';
    if (!token) { setState({ loading: false, error: 'not_found' }); return; }
    (async () => {
      const res = await fetchPublicPassport(token);
      if (res.ok && res.passport) setState({ loading: false, snapshot: res.passport });
      else setState({ loading: false, error: res.error ?? 'not_found' });
    })();
  }, []);

  if (state.loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 gap-2"><Loader2 size={18} className="animate-spin" /> Loading passport…</div>;
  }
  if (state.error || !state.snapshot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <FileText size={36} className="text-gray-300 mb-3" />
        <h1 className="text-lg font-bold text-gray-700">Passport unavailable</h1>
        <p className="text-sm text-gray-500 mt-1">{state.error === 'feature_disabled' ? 'Passport sharing is currently disabled.' : 'This link is no longer active or does not exist.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] py-6 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-end mb-3">
          <button onClick={() => exportPassportPdf(contentRef.current, state.snapshot!.header.name)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white" style={{ borderColor: BORDER }}>
            <Download size={14} /> Download PDF
          </button>
        </div>
        <EmployabilityPassport snapshot={state.snapshot} mode="recruiter" contentRef={contentRef} />
      </div>
    </div>
  );
}
