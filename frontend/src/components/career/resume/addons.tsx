import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, FileText, Target, X, Plus, Download, Mail, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { AI_BULLET_LIBRARY, atsScore, COVER_LETTER_DEFAULT, CoverLetterData } from './library';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', green: '#2A9D8F' };

/* ─────────────────────────── AI Bullet Picker ─────────────────────────── */
export function AIBulletPicker({ roleHint, onPick, onClose }: { roleHint: string; onPick: (b: string) => void; onClose: () => void }) {
  const role = (roleHint || '').toLowerCase();
  // Match best library group; if nothing matches, show all.
  const matched = useMemo(() => {
    const hits = AI_BULLET_LIBRARY.filter(g => g.keywords.some(k => role.includes(k)));
    return hits.length ? hits : AI_BULLET_LIBRARY;
  }, [role]);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = matched[activeIdx] || matched[0];
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2"><Sparkles size={16} style={{ color: BRAND.primary }}/>
            <div>
              <div className="text-sm font-semibold text-gray-900">AI bullet suggestions</div>
              <div className="text-[10.5px] text-gray-500">Tap any to add to your experience · placeholders %x/%n/%m</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
        </div>
        <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap gap-1.5">
          {matched.map((g, i) => (
            <button key={g.role} onClick={() => setActiveIdx(i)}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${i === activeIdx ? 'text-white border-transparent' : 'text-gray-600 border-gray-200'}`}
              style={i === activeIdx ? { backgroundColor: BRAND.primary } : undefined}>{g.role}</button>))}
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {active.bullets.map((b, i) => (
            <button key={i} onClick={() => onPick(b)} className="w-full text-left text-[12px] text-gray-800 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 flex items-start gap-2">
              <Plus size={13} className="mt-0.5 shrink-0" style={{ color: BRAND.primary }}/>
              <span className="leading-relaxed">{b}</span>
            </button>))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── ATS Panel ─────────────────────────── */
export function ATSCheckPanel({ resumeText, defaultOpen = false }: { resumeText: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [jd, setJD] = useState('');
  const result = useMemo(() => atsScore(jd, resumeText), [jd, resumeText]);
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-gray-800 flex items-center gap-2"><Target size={13} style={{ color: BRAND.primary }}/>ATS check{result.total > 0 && <span className="text-[10px] text-gray-400">({result.score}% match)</span>}</span>
        {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-[10.5px] text-gray-500">Paste the target job description — we&apos;ll show keywords your resume is missing.</div>
          <textarea value={jd} onChange={e => setJD(e.target.value)} rows={5}
            className="w-full text-[11.5px] px-2.5 py-2 rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none bg-white leading-relaxed"
            placeholder="Paste job description here…"/>
          {jd.trim() && result.total > 0 && (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-700">Match score</span>
                <span className="font-bold" style={{ color: result.score >= 70 ? BRAND.green : result.score >= 40 ? BRAND.primary : '#dc2626' }}>{result.score}/100</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${result.score}%`, backgroundColor: result.score >= 70 ? BRAND.green : result.score >= 40 ? BRAND.primary : '#dc2626' }}/>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1 flex items-center gap-1"><CheckCircle2 size={10} className="text-green-600"/>Matched ({result.matched.length})</div>
                <div className="flex flex-wrap gap-1">
                  {result.matched.slice(0, 24).map(w => <span key={w} className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-200">{w}</span>)}
                  {result.matched.length === 0 && <span className="text-[10.5px] text-gray-400">No matches yet.</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1 flex items-center gap-1"><AlertCircle size={10} className="text-amber-600"/>Missing keywords ({result.missing.length})</div>
                <div className="flex flex-wrap gap-1">
                  {result.missing.slice(0, 24).map(w => <span key={w} className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">{w}</span>)}
                  {result.missing.length === 0 && <span className="text-[10.5px] text-gray-400">None — strong alignment.</span>}
                </div>
                {result.missing.length > 0 && <div className="text-[10.5px] text-gray-500 mt-1.5 italic">Tip: weave a handful of these into your summary or experience bullets where they apply truthfully.</div>}
              </div>
            </>)}
        </div>)}
    </div>
  );
}

/* ─────────────────────────── Cover Letter Studio ─────────────────────────── */
const clKey = (userId: string) => `mx-cover-letter-${userId || 'anon'}`;
const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

function loadCL(userId: string, fallback: CoverLetterData): CoverLetterData {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(clKey(userId));
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch {}
  return fallback;
}
function saveCL(userId: string, data: CoverLetterData) {
  if (!hasStorage()) return;
  try { window.localStorage.setItem(clKey(userId), JSON.stringify(data)); } catch {}
}

export function CoverLetterStudio({ userId, personal, fontFamily, accent }: { userId: string; personal: { name: string; email: string; phone: string; location: string; linkedin: string }; fontFamily: string; accent: string }) {
  const initial = useMemo(() => ({ ...COVER_LETTER_DEFAULT, signatureName: personal.name || '' }), [personal.name]);
  const [data, setData] = useState<CoverLetterData>(() => loadCL(userId, initial));
  const [exporting, setExporting] = useState(false);
  const previewRef = React.useRef<HTMLDivElement | null>(null);

  // Re-hydrate when user changes.
  const lastUserRef = React.useRef<string>(userId);
  useEffect(() => {
    if (lastUserRef.current !== userId) {
      lastUserRef.current = userId;
      setData(loadCL(userId, initial));
    }
  }, [userId, initial]);

  useEffect(() => {
    if (lastUserRef.current !== userId) return;
    const t = setTimeout(() => saveCL(userId, data), 600);
    return () => clearTimeout(t);
  }, [data, userId]);

  const upd = <K extends keyof CoverLetterData>(k: K, v: CoverLetterData[K]) => setData(d => ({ ...d, [k]: v }));

  const downloadPDF = async () => {
    if (!previewRef.current || typeof window === 'undefined') return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, html2canvas] = await Promise.all([
        import('jspdf'),
        import('html2canvas').then(m => m.default),
      ]);
      const canvas = await html2canvas(previewRef.current as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWmm = 210, pageHmm = 297;
      const pageHpx = Math.floor((pageHmm * canvas.width) / pageWmm);
      let renderedPx = 0, pageIndex = 0;
      while (renderedPx < canvas.height - 1) {
        const sliceHpx = Math.min(pageHpx, canvas.height - renderedPx);
        const slice = document.createElement('canvas');
        slice.width = canvas.width; slice.height = sliceHpx;
        const ctx = slice.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, renderedPx, slice.width, sliceHpx, 0, 0, slice.width, sliceHpx);
        const sliceHmm = (sliceHpx * pageWmm) / canvas.width;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, pageWmm, sliceHmm);
        renderedPx += sliceHpx; pageIndex += 1;
        if (pageIndex > 10) break;
      }
      pdf.save(`${(personal.name || 'cover_letter').replace(/\s+/g, '_')}_cover_letter.pdf`);
    } catch (e) {
      console.error(e);
      if (typeof window !== 'undefined') window.alert('PDF export failed.');
    } finally { setExporting(false); }
  };

  const inputCls = 'w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none bg-white';
  const labelCls = 'text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1 block';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] text-gray-600 flex items-center gap-1.5"><Mail size={12} style={{ color: accent }}/>Cover Letter Studio — auto-saved</div>
        <button onClick={downloadPDF} disabled={exporting}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm disabled:opacity-60"
          style={{ backgroundColor: accent }}>
          <Download size={13}/> {exporting ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
        {/* Editor */}
        <div className="space-y-2.5">
          <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
            <div className="text-xs font-semibold text-gray-800 flex items-center gap-1.5"><FileText size={12} style={{ color: accent }}/>Recipient</div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Recipient name</label><input className={inputCls} value={data.recipientName} onChange={e => upd('recipientName', e.target.value)} placeholder="e.g. Jane Doe"/></div>
              <div><label className={labelCls}>Recipient title</label><input className={inputCls} value={data.recipientTitle} onChange={e => upd('recipientTitle', e.target.value)}/></div>
            </div>
            <div><label className={labelCls}>Company</label><input className={inputCls} value={data.recipientCompany} onChange={e => upd('recipientCompany', e.target.value)}/></div>
            <div><label className={labelCls}>Company address</label><input className={inputCls} value={data.recipientAddress} onChange={e => upd('recipientAddress', e.target.value)}/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Date</label><input className={inputCls} value={data.dateLine} onChange={e => upd('dateLine', e.target.value)}/></div>
              <div><label className={labelCls}>Greeting</label><input className={inputCls} value={data.greeting} onChange={e => upd('greeting', e.target.value)}/></div>
            </div>
            <div><label className={labelCls}>Subject</label><input className={inputCls} value={data.subject} onChange={e => upd('subject', e.target.value)}/></div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
            <div className="text-xs font-semibold text-gray-800 flex items-center gap-1.5"><FileText size={12} style={{ color: accent }}/>Body paragraphs</div>
            {data.paragraphs.map((p, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={labelCls + ' mb-0'}>Paragraph {i + 1}</label>
                  <button onClick={() => upd('paragraphs', data.paragraphs.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X size={11}/></button>
                </div>
                <textarea className={inputCls + ' resize-y leading-relaxed'} rows={4} value={p} spellCheck
                  onChange={e => upd('paragraphs', data.paragraphs.map((x, j) => j === i ? e.target.value : x))}/>
              </div>))}
            <button onClick={() => upd('paragraphs', [...data.paragraphs, ''])}
              className="w-full text-[11px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 flex items-center justify-center gap-1 hover:border-gray-400">
              <Plus size={11}/> Add paragraph
            </button>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
            <div className="text-xs font-semibold text-gray-800">Closing</div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Closing</label><input className={inputCls} value={data.closing} onChange={e => upd('closing', e.target.value)}/></div>
              <div><label className={labelCls}>Signature</label><input className={inputCls} value={data.signatureName} onChange={e => upd('signatureName', e.target.value)}/></div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Live preview · A4</div>
          <div className="overflow-auto rounded-xl border border-gray-200 shadow-lg bg-gray-100 p-4" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <div ref={previewRef} className="mx-auto bg-white shadow-md" style={{ width: '210mm' }}>
              <div className="bg-white text-gray-900 px-14 py-14" style={{ fontFamily, minHeight: '297mm' }}>
                {/* Sender block */}
                <div className="text-right text-[11px] text-gray-700 leading-snug mb-8">
                  <div className="font-bold text-gray-900" style={{ fontSize: '13px' }}>{personal.name}</div>
                  {personal.email    && <div>{personal.email}</div>}
                  {personal.phone    && <div>{personal.phone}</div>}
                  {personal.location && <div>{personal.location}</div>}
                  {personal.linkedin && <div>{personal.linkedin}</div>}
                </div>
                {/* Recipient block */}
                <div className="text-[11.5px] text-gray-800 leading-snug mb-1">
                  {data.recipientName && <div className="font-semibold">{data.recipientName}</div>}
                  {data.recipientTitle && <div>{data.recipientTitle}</div>}
                  {data.recipientCompany && <div>{data.recipientCompany}</div>}
                  {data.recipientAddress && <div className="text-gray-600">{data.recipientAddress}</div>}
                </div>
                <div className="text-[11px] text-gray-500 mb-6">{data.dateLine}</div>
                {data.subject && <div className="text-[12px] font-semibold mb-3" style={{ color: accent }}>{data.subject}</div>}
                <div className="text-[12px] text-gray-800 mb-3">{data.greeting}</div>
                <div className="space-y-3">
                  {data.paragraphs.map((p, i) => <p key={i} className="text-[12px] text-gray-800 leading-relaxed text-justify">{p}</p>)}
                </div>
                <div className="mt-8">
                  <div className="text-[12px] text-gray-800">{data.closing}</div>
                  <div className="text-[13px] font-semibold mt-6" style={{ color: accent }}>{data.signatureName || personal.name}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
