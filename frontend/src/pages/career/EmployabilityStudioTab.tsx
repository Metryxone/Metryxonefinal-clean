/**
 * MX-302F — Employability Studio (Resume · Portfolio · Interview).
 *
 * A NET-NEW consolidated student employability surface, rendered only when the
 * `employabilityStudio` flag is ON (the parent CareerBuilderPage gates this tab
 * behind a /api/employability-studio/enabled probe → byte-identical OFF).
 *
 * Honesty-first: every AI-dependent panel reads /ai-status and labels results
 * as AI vs Rule-based vs Static-template. When no LLM key is configured the
 * panels fall back to clearly-labelled rule-based output — static content is
 * NEVER presented as AI. Unscorable answers show "not scored", never a fake 0.
 *
 * It REUSES the existing ResumeStudio builder unchanged and adds the genuinely-
 * new gaps (resume analyzer, versions, LinkedIn review, structured research /
 * publications, curated coding assessment, group discussion, Q&A feedback).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText, Sparkles, Linkedin, FolderGit2, BookOpen, FlaskConical,
  MessageSquare, Code2, Users, History, AlertTriangle, CheckCircle2,
  Loader2, Plus, Trash2, Save, RefreshCw, Gauge, Zap,
} from 'lucide-react';
import ResumeStudio from '../../components/career/ResumeStudio';

type StudioId = 'resume' | 'portfolio' | 'interview';

const API = '/api/employability-studio';

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

// ── Source badge (honest provenance label) ──────────────────────────────────
function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const map: Record<string, { label: string; cls: string }> = {
    ai: { label: 'AI-generated', cls: 'bg-violet-100 text-violet-700' },
    'rule-based': { label: 'Rule-based', cls: 'bg-amber-100 text-amber-700' },
    'static-library': { label: 'Static template', cls: 'bg-slate-200 text-slate-700' },
  };
  const m = map[source] || { label: source, cls: 'bg-slate-200 text-slate-700' };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${m.cls}`}>{m.label}</span>;
}

function AiBanner({ aiAvailable, reason }: { aiAvailable: boolean | null; reason?: string | null }) {
  if (aiAvailable === null) return null;
  if (aiAvailable) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
        <CheckCircle2 size={16} /> AI assistance is active — analyses below are AI-generated.
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>
        AI assistance is unavailable{reason ? ` (${reason})` : ''}. You'll still get <strong>rule-based</strong> analysis
        and template suggestions — these are clearly labelled and are <strong>not</strong> AI-generated.
      </span>
    </div>
  );
}

const card = 'bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-sm';
const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition';
const btnPrimary = `${btn} bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50`;
const btnGhost = `${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`;
const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';

// ════════════════════════════ RESUME STUDIO ════════════════════════════

function readLocalResume(userId: string): any | null {
  try {
    const raw = localStorage.getItem(`mx-resume-${userId || 'anon'}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function ResumeAnalyzerPanel({ userId, aiAvailable }: { userId: string; aiAvailable: boolean | null }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null); setRes(null);
    const resume = readLocalResume(userId);
    if (!resume) { setErr('No resume found yet — build your resume in the editor above first.'); return; }
    setLoading(true);
    try {
      const j = await api('/resume/analyze', { method: 'POST', body: JSON.stringify({ resume }) });
      setRes(j);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const a = res?.analysis;
  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles size={18} /> Resume Analyzer</h3>
        <button className={btnPrimary} onClick={run} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Analyze my resume
        </button>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {res && (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><SourceBadge source={res.source} /></div>
          {/* AI path */}
          {res.source === 'ai' && a && (
            <>
              {a.summary && <p className="text-sm text-slate-700">{a.summary}</p>}
              {Array.isArray(a.strengths) && a.strengths.length > 0 && (
                <div><p className="text-sm font-medium">Strengths</p><ul className="list-disc ml-5 text-sm text-slate-700">{a.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
              )}
              {Array.isArray(a.improvements) && a.improvements.length > 0 && (
                <div><p className="text-sm font-medium">Improvements</p><ul className="list-disc ml-5 text-sm text-slate-700">{a.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
              )}
              {Array.isArray(a.rewrittenBullets) && a.rewrittenBullets.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Suggested rewrites</p>
                  {a.rewrittenBullets.map((b: any, i: number) => (
                    <div key={i} className="text-sm bg-slate-50 rounded-lg p-2">
                      <p className="text-rose-600 line-through">{b.before}</p>
                      <p className="text-emerald-700">{b.after}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {/* Rule-based path */}
          {res.source === 'rule-based' && a && (
            <>
              <p className="text-xs text-amber-700">{a.note}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-lg font-semibold">{a.scores.overall}</div><div className="text-[11px] text-slate-500">Overall</div></div>
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-lg font-semibold">{a.scores.impactVerbs}%</div><div className="text-[11px] text-slate-500">Action verbs</div></div>
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-lg font-semibold">{a.scores.quantification}%</div><div className="text-[11px] text-slate-500">Quantified</div></div>
              </div>
              {a.strengths?.length > 0 && <div><p className="text-sm font-medium">Strengths</p><ul className="list-disc ml-5 text-sm text-slate-700">{a.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
              {a.improvements?.length > 0 && <div><p className="text-sm font-medium">Improvements</p><ul className="list-disc ml-5 text-sm text-slate-700">{a.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
              {a.missingSections?.length > 0 && <p className="text-sm text-rose-600">Missing / empty sections: {a.missingSections.join(', ')}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResumeVersionsPanel({ userId }: { userId: string }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try { const j = await api('/resume-versions'); setVersions(j.versions || []); }
    catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr(null);
    const resume = readLocalResume(userId);
    if (!resume) { setErr('No resume to save yet — build it in the editor above.'); return; }
    setBusy(true);
    try {
      await api('/resume-versions', { method: 'POST', body: JSON.stringify({ label: label || `Version ${versions.length + 1}`, data: resume, source: 'imported-local' }) });
      setLabel(''); await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const del = async (id: string) => { try { await api(`/resume-versions/${id}`, { method: 'DELETE' }); await load(); } catch (e: any) { setErr(e.message); } };

  return (
    <div className={card}>
      <h3 className="font-semibold flex items-center gap-2 mb-3"><History size={18} /> Saved versions</h3>
      <div className="flex gap-2 mb-3">
        <input className={input} placeholder="Label (e.g. Backend roles)" value={label} onChange={e => setLabel(e.target.value)} />
        <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save current</button>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {versions.length === 0 ? <p className="text-sm text-slate-500">No saved versions yet.</p> : (
        <ul className="divide-y divide-slate-100">
          {versions.map(v => (
            <li key={v.id} className="flex items-center justify-between py-2 text-sm">
              <span>{v.label} <span className="text-slate-400 text-xs">· {new Date(v.updated_at).toLocaleDateString()}</span></span>
              <button className="text-rose-500 hover:text-rose-700" onClick={() => del(v.id)}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkedInReviewPanel() {
  const [f, setF] = useState({ headline: '', about: '', url: '', skillsCount: '', connections: '', hasPhoto: false });
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null); setRes(null); setBusy(true);
    try {
      const j = await api('/linkedin/review', { method: 'POST', body: JSON.stringify({ profile: { ...f, skillsCount: Number(f.skillsCount) || 0, connections: Number(f.connections) || 0 } }) });
      setRes(j);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const rb = res?.source === 'rule-based' ? res.review : (res?.ruleBased || null);
  return (
    <div className={card}>
      <h3 className="font-semibold flex items-center gap-2 mb-3"><Linkedin size={18} /> LinkedIn Review</h3>
      <div className="grid md:grid-cols-2 gap-2 mb-2">
        <input className={input} placeholder="Headline" value={f.headline} onChange={e => setF({ ...f, headline: e.target.value })} />
        <input className={input} placeholder="Profile URL" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} />
        <input className={input} placeholder="# skills listed" value={f.skillsCount} onChange={e => setF({ ...f, skillsCount: e.target.value })} />
        <input className={input} placeholder="# connections" value={f.connections} onChange={e => setF({ ...f, connections: e.target.value })} />
      </div>
      <textarea className={`${input} mb-2`} rows={3} placeholder="About section" value={f.about} onChange={e => setF({ ...f, about: e.target.value })} />
      <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={f.hasPhoto} onChange={e => setF({ ...f, hasPhoto: e.target.checked })} /> I have a profile photo</label>
      <button className={btnPrimary} onClick={run} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Review profile</button>
      {err && <p className="text-sm text-rose-600 mt-2">{err}</p>}
      {res && (
        <div className="mt-3 space-y-2">
          <SourceBadge source={res.source} />
          {res.source === 'ai' && res.review && (
            <>
              {res.review.headlineSuggestion && <p className="text-sm"><strong>Headline:</strong> {res.review.headlineSuggestion}</p>}
              {res.review.aboutFeedback && <p className="text-sm"><strong>About:</strong> {res.review.aboutFeedback}</p>}
              {Array.isArray(res.review.improvements) && <ul className="list-disc ml-5 text-sm text-slate-700">{res.review.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>}
            </>
          )}
          {rb && Array.isArray(rb.checklist) && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Checklist ({rb.score}%)</p>
              {rb.checklist.map((c: any, i: number) => (
                <div key={i} className="text-sm flex items-start gap-2">
                  {c.ok ? <CheckCircle2 size={15} className="text-emerald-600 mt-0.5" /> : <AlertTriangle size={15} className="text-amber-600 mt-0.5" />}
                  <span>{c.item}{!c.ok && <span className="text-slate-500"> — {c.advice}</span>}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════ PORTFOLIO STUDIO ════════════════════════════

function PortfolioPanel({ kind }: { kind: 'research' | 'publication' }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const empty = { title: '', authors: '', venue: '', role: '', abstract: '', link: '', doi: '', status: kind === 'publication' ? 'published' : 'in-progress', publishedOn: '' };
  const [form, setForm] = useState<any>(empty);

  const load = async () => { try { const j = await api(`/portfolio?kind=${kind}`); setEntries(j.entries || []); } catch (e: any) { setErr(e.message); } };
  useEffect(() => { load(); }, [kind]);

  const add = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    setErr(null);
    try { await api('/portfolio', { method: 'POST', body: JSON.stringify({ ...form, kind }) }); setForm(empty); setAdding(false); await load(); }
    catch (e: any) { setErr(e.message); }
  };
  const del = async (id: string) => { try { await api(`/portfolio/${id}`, { method: 'DELETE' }); await load(); } catch (e: any) { setErr(e.message); } };

  const Icon = kind === 'research' ? FlaskConical : BookOpen;
  const title = kind === 'research' ? 'Research' : 'Publications';
  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Icon size={18} /> {title}</h3>
        <button className={btnGhost} onClick={() => setAdding(a => !a)}><Plus size={16} /> Add</button>
      </div>
      {err && <p className="text-sm text-rose-600 mb-2">{err}</p>}
      {adding && (
        <div className="space-y-2 mb-3 bg-slate-50 rounded-lg p-3">
          <input className={input} placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <div className="grid md:grid-cols-2 gap-2">
            <input className={input} placeholder="Authors" value={form.authors} onChange={e => setForm({ ...form, authors: e.target.value })} />
            <input className={input} placeholder={kind === 'research' ? 'Lab / institution' : 'Journal / conference'} value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} />
            <input className={input} placeholder="Your role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
            <input className={input} placeholder="Link (DOI / arXiv / URL)" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} />
            <select className={input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="published">Published</option>
              <option value="under-review">Under review</option>
              <option value="in-progress">In progress</option>
            </select>
            <input className={input} type="date" value={form.publishedOn} onChange={e => setForm({ ...form, publishedOn: e.target.value })} />
          </div>
          <textarea className={input} rows={2} placeholder="Abstract / summary" value={form.abstract} onChange={e => setForm({ ...form, abstract: e.target.value })} />
          <button className={btnPrimary} onClick={add}><Save size={16} /> Save</button>
        </div>
      )}
      {entries.length === 0 ? <p className="text-sm text-slate-500">Nothing added yet.</p> : (
        <ul className="divide-y divide-slate-100">
          {entries.map(e => (
            <li key={e.id} className="py-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{e.title} <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{e.status}</span></p>
                  <p className="text-xs text-slate-500">{[e.venue, e.role, e.authors].filter(Boolean).join(' · ')}{e.published_on ? ` · ${e.published_on}` : ''}</p>
                  {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">{e.link}</a>}
                </div>
                <button className="text-rose-500 hover:text-rose-700" onClick={() => del(e.id)}><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ════════════════════════════ INTERVIEW STUDIO ════════════════════════════

function CodingAssessmentPanel() {
  const [mcqs, setMcqs] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selfReview, setSelfReview] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api('/coding-questions').then(j => { setMcqs(j.mcqs || []); setPrompts(j.selfReviewPrompts || []); }).catch(e => setErr(e.message)); }, []);

  const submit = async () => {
    setBusy(true); setErr(null);
    try { const j = await api('/coding-assessment/submit', { method: 'POST', body: JSON.stringify({ answers, selfReview }) }); setResult(j.result); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className={card}>
      <h3 className="font-semibold flex items-center gap-2 mb-1"><Code2 size={18} /> Coding Assessment</h3>
      <p className="text-xs text-slate-500 mb-3">Knowledge check (MCQ) + structured self-review. There is no code-execution sandbox — self-review answers are for reflection, not auto-graded.</p>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <div className="space-y-4">
        {mcqs.map((q, qi) => (
          <div key={q.id}>
            <p className="text-sm font-medium">{qi + 1}. {q.question} <span className="text-[11px] text-slate-400">({q.topic} · {q.difficulty})</span></p>
            <div className="mt-1 space-y-1">
              {q.options.map((opt: string, oi: number) => {
                const chosen = answers[q.id] === oi;
                const correct = result?.perQuestion?.find((p: any) => p.id === q.id);
                let cls = 'border-slate-200';
                if (result && correct) {
                  if (oi === correct.answerIndex) cls = 'border-emerald-400 bg-emerald-50';
                  else if (chosen) cls = 'border-rose-400 bg-rose-50';
                }
                return (
                  <label key={oi} className={`flex items-center gap-2 text-sm border rounded-lg px-2 py-1 cursor-pointer ${cls}`}>
                    <input type="radio" name={q.id} disabled={!!result} checked={chosen} onChange={() => setAnswers({ ...answers, [q.id]: oi })} />
                    {opt}
                  </label>
                );
              })}
            </div>
            {result?.perQuestion?.find((p: any) => p.id === q.id)?.explanation && (
              <p className="text-xs text-slate-500 mt-1">{result.perQuestion.find((p: any) => p.id === q.id).explanation}</p>
            )}
          </div>
        ))}
      </div>
      {prompts.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Self-review (not graded)</p>
          {prompts.map((p, i) => (
            <div key={i}>
              <p className="text-sm text-slate-600">{p}</p>
              <textarea className={input} rows={2} value={selfReview[String(i)] || ''} onChange={e => setSelfReview({ ...selfReview, [String(i)]: e.target.value })} />
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        {!result && <button className={btnPrimary} onClick={submit} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Submit</button>}
        {result && (
          <div className="text-sm">
            <span className="font-semibold">{result.correct}/{result.total} correct ({result.score}%)</span>
            <span className="text-slate-500"> — {result.note}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupDiscussionPanel() {
  const [topics, setTopics] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api('/group-discussion/topics').then(j => setTopics(j.topics || [])).catch(e => setErr(e.message)); }, []);
  return (
    <div className={card}>
      <h3 className="font-semibold flex items-center gap-2 mb-3"><Users size={18} /> Group Discussion</h3>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <ul className="space-y-2">
        {topics.map(t => (
          <li key={t.id} className="border border-slate-200 rounded-lg">
            <button className="w-full text-left px-3 py-2 text-sm font-medium flex justify-between" onClick={() => setOpen(open === t.id ? null : t.id)}>
              {t.title} <span className="text-xs text-slate-400">{t.category}</span>
            </button>
            {open === t.id && (
              <div className="px-3 pb-3 text-sm space-y-2">
                <p className="text-slate-600">{t.prompt}</p>
                <div className="grid md:grid-cols-2 gap-2">
                  <div><p className="font-medium text-emerald-700">Points for</p><ul className="list-disc ml-5 text-slate-700">{t.pointsFor.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
                  <div><p className="font-medium text-rose-700">Points against</p><ul className="list-disc ml-5 text-slate-700">{t.pointsAgainst.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
                </div>
                <div><p className="font-medium">Tips</p><ul className="list-disc ml-5 text-slate-700">{t.tips.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const CAT_LABELS: Record<string, string> = { hr: 'HR', technical: 'Technical', behavioral: 'Behavioural' };

function QAPracticePanel() {
  const [categories, setCategories] = useState<any[]>([]);
  const [bank, setBank] = useState<any[]>([]);
  const [activeCat, setActiveCat] = useState<string>('hr');
  const [question, setQuestion] = useState('Tell me about a time you faced a difficult challenge and how you handled it.');
  const [hint, setHint] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api('/interview/questions').then(j => {
      setCategories(j.categories || []);
      setBank(j.questions || []);
    }).catch(e => setErr(e.message));
  }, []);

  const pick = (q: any) => { setQuestion(q.question); setHint(q.hint || null); setRes(null); };
  const inCat = bank.filter((q: any) => q.category === activeCat);

  const run = async () => {
    if (!answer.trim()) { setErr('Write an answer first.'); return; }
    setBusy(true); setErr(null); setRes(null);
    try { const j = await api('/interview/feedback', { method: 'POST', body: JSON.stringify({ question, answer, mode: 'qa' }) }); setRes(j); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const fb = res?.feedback;
  return (
    <div className={card}>
      <h3 className="font-semibold flex items-center gap-2 mb-1"><MessageSquare size={18} /> Answer Practice & Feedback</h3>
      <p className="text-xs text-slate-500 mb-3">Rehearse HR, technical and behavioural questions, then get structured feedback on your answer.</p>
      {/* Category tracks */}
      <div className="flex gap-2 mb-2">
        {categories.map((c: any) => (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${activeCat === c.id ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            {c.label || CAT_LABELS[c.id] || c.id}
          </button>
        ))}
      </div>
      {/* Curated questions for the track */}
      {inCat.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {inCat.map((q: any) => (
            <button key={q.id} onClick={() => pick(q)}
              className={`text-left text-xs px-2 py-1 rounded-lg border ${question === q.question ? 'border-slate-900 bg-slate-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {q.question}
            </button>
          ))}
        </div>
      )}
      <input className={`${input} mb-1`} value={question} onChange={e => { setQuestion(e.target.value); setHint(null); }} />
      {hint && <p className="text-xs text-slate-500 mb-2"><strong>What good looks like:</strong> {hint}</p>}
      <textarea className={`${input} mb-2`} rows={5} placeholder="Type your answer using the STAR structure…" value={answer} onChange={e => setAnswer(e.target.value)} />
      <button className={btnPrimary} onClick={run} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Get feedback</button>
      {err && <p className="text-sm text-rose-600 mt-2">{err}</p>}
      {res && fb && (
        <div className="mt-3 space-y-2">
          <SourceBadge source={res.source} />
          <p className="text-sm font-semibold">
            Score: {fb.score === null || fb.score === undefined ? <span className="text-slate-500">Not scored (answer too short to evaluate)</span> : `${fb.score}/100`}
          </p>
          {/* AI shape */}
          {res.source === 'ai' && (
            <>
              {Array.isArray(fb.strengths) && fb.strengths.length > 0 && <div><p className="text-sm font-medium">Strengths</p><ul className="list-disc ml-5 text-sm text-slate-700">{fb.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
              {Array.isArray(fb.improvements) && fb.improvements.length > 0 && <div><p className="text-sm font-medium">Improvements</p><ul className="list-disc ml-5 text-sm text-slate-700">{fb.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
              {fb.modelAnswerOutline && <p className="text-sm"><strong>Model outline:</strong> {fb.modelAnswerOutline}</p>}
            </>
          )}
          {/* Rule-based shape */}
          {res.source === 'rule-based' && (
            <>
              <p className="text-xs text-amber-700">{fb.note}</p>
              {Array.isArray(fb.observations) && <div><p className="text-sm font-medium">Observations</p><ul className="list-disc ml-5 text-sm text-slate-700">{fb.observations.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
              {Array.isArray(fb.suggestions) && fb.suggestions.length > 0 && <div><p className="text-sm font-medium">Suggestions</p><ul className="list-disc ml-5 text-sm text-slate-700">{fb.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Interview-readiness surfacing — reuses the existing readiness/simulation tabs
// rather than recomputing. Deep-links into AI Simulations (mock interview),
// Hiring Readiness (role fit) and Future Readiness (FRI).
function InterviewReadinessPanel({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const links: { tab: string; title: string; desc: string; icon: React.ReactNode }[] = [
    { tab: 'simulations', title: 'Mock interview (AI Simulations)', desc: 'Branching scenario practice with real-time behavioural feedback.', icon: <MessageSquare size={16} /> },
    { tab: 'hiring-readiness', title: 'Hiring Readiness', desc: 'How your assessed competencies map to a target role — developmental, not a hiring decision.', icon: <Gauge size={16} /> },
    { tab: 'future-readiness', title: 'Future Readiness (FRI)', desc: 'Your forward-looking readiness index across skill durability, market alignment and more.', icon: <Zap size={16} /> },
  ];
  return (
    <div className={card}>
      <h3 className="font-semibold flex items-center gap-2 mb-1"><Gauge size={18} /> Interview readiness</h3>
      <p className="text-xs text-slate-500 mb-3">These readiness views live elsewhere in Career Builder — open them to see where you stand before an interview.</p>
      <div className="grid sm:grid-cols-3 gap-2">
        {links.map(l => (
          <button key={l.tab} onClick={() => onNavigate?.(l.tab)} disabled={!onNavigate}
            className="text-left border border-slate-200 rounded-lg p-3 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-default transition">
            <div className="flex items-center gap-1.5 text-sm font-medium mb-1">{l.icon} {l.title}</div>
            <p className="text-xs text-slate-500">{l.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════ RESUME BULLET SUGGESTIONS ════════════════════════════

// Static template library used ONLY when AI is unavailable (clearly labelled as a
// static template, never as AI). These are generic, role-agnostic scaffolds with
// placeholders the student fills in — not fabricated achievements.
const STATIC_BULLET_TEMPLATES: string[] = [
  'Built <feature/system> using <technology>, <outcome — e.g. cutting load time by __%>.',
  'Led <project> with a team of <n>, delivering <result> <timeframe ahead of schedule>.',
  'Improved <process/metric> by <__%> by <action you took>.',
  'Automated <manual task>, saving <__ hours/week> and reducing errors.',
  'Designed and shipped <component>, adopted by <n users/teams>.',
];

function ResumeBulletSuggestPanel({ aiAvailable }: { aiAvailable: boolean | null }) {
  const [role, setRole] = useState('');
  const [context, setContext] = useState('');
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!role.trim()) { setErr('Enter a target role first.'); return; }
    setBusy(true); setErr(null); setRes(null);
    try { const j = await api('/resume/suggest-bullets', { method: 'POST', body: JSON.stringify({ role, context }) }); setRes(j); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  // Honest fallback: when AI is unavailable the API returns source 'static-library'
  // with no bullets — we then show the labelled static template library.
  const usingStatic = res && (res.source === 'static-library' || res.aiAvailable === false);
  const aiBullets: string[] = (res && res.source === 'ai' && Array.isArray(res.bullets)) ? res.bullets : [];

  return (
    <div className={card}>
      <h3 className="font-semibold flex items-center gap-2 mb-1"><Sparkles size={18} /> Resume bullet suggestions</h3>
      <p className="text-xs text-slate-500 mb-3">Generate achievement-oriented bullet points for a target role. With an AI key these are tailored; without one you get a clearly-labelled template library.</p>
      <div className="grid md:grid-cols-2 gap-2 mb-2">
        <input className={input} placeholder="Target role (e.g. Backend Engineer)" value={role} onChange={e => setRole(e.target.value)} />
        <input className={input} placeholder="Context (optional — e.g. internship, Go/Postgres)" value={context} onChange={e => setContext(e.target.value)} />
      </div>
      <button className={btnPrimary} onClick={run} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Suggest bullets</button>
      {err && <p className="text-sm text-rose-600 mt-2">{err}</p>}
      {res && (
        <div className="mt-3 space-y-2">
          <SourceBadge source={usingStatic ? 'static-library' : res.source} />
          {usingStatic && (
            <>
              <p className="text-xs text-amber-700">{res.note || 'AI unavailable — these are static templates, not AI-generated. Replace the <placeholders> with your real details.'}</p>
              <ul className="list-disc ml-5 text-sm text-slate-700 space-y-1">{STATIC_BULLET_TEMPLATES.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </>
          )}
          {!usingStatic && aiBullets.length > 0 && (
            <ul className="list-disc ml-5 text-sm text-slate-700 space-y-1">{aiBullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════ ROOT ════════════════════════════

export function EmployabilityStudioTab({ profile, userId, onNavigate }: { profile: any; userId: string; onNavigate?: (tab: string) => void }) {
  const [studio, setStudio] = useState<StudioId>('resume');
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiReason, setAiReason] = useState<string | null>(null);

  useEffect(() => {
    api('/ai-status').then(j => { setAiAvailable(!!j.aiAvailable); setAiReason(j.reason || null); }).catch(() => { setAiAvailable(false); setAiReason('AI status unavailable'); });
  }, []);

  const studios: { id: StudioId; label: string; icon: React.ReactNode }[] = useMemo(() => [
    { id: 'resume', label: 'Resume Studio', icon: <FileText size={16} /> },
    { id: 'portfolio', label: 'Portfolio', icon: <FolderGit2 size={16} /> },
    { id: 'interview', label: 'Interview Studio', icon: <MessageSquare size={16} /> },
  ], []);

  return (
    <div className="p-4 md:p-6 overflow-auto h-full">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles size={20} /> Employability Studio</h2>
        <p className="text-sm text-slate-500">Polish your resume, showcase your portfolio, and rehearse interviews — all in one place.</p>
      </div>

      <div className="flex gap-2 mb-4 border-b border-slate-200">
        {studios.map(s => (
          <button key={s.id} onClick={() => setStudio(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${studio === s.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <AiBanner aiAvailable={aiAvailable} reason={aiReason} />

      {studio === 'resume' && (
        <div className="space-y-4">
          <div className={card}>
            <h3 className="font-semibold flex items-center gap-2 mb-3"><FileText size={18} /> Resume Editor</h3>
            <ResumeStudio profile={profile} userId={userId} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ResumeAnalyzerPanel userId={userId} aiAvailable={aiAvailable} />
            <ResumeVersionsPanel userId={userId} />
          </div>
          <ResumeBulletSuggestPanel aiAvailable={aiAvailable} />
          <LinkedInReviewPanel />
        </div>
      )}

      {studio === 'portfolio' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <PortfolioPanel kind="research" />
          <PortfolioPanel kind="publication" />
        </div>
      )}

      {studio === 'interview' && (
        <div className="space-y-4">
          <InterviewReadinessPanel onNavigate={onNavigate} />
          <QAPracticePanel />
          <div className="grid lg:grid-cols-2 gap-4">
            <CodingAssessmentPanel />
            <GroupDiscussionPanel />
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployabilityStudioTab;
