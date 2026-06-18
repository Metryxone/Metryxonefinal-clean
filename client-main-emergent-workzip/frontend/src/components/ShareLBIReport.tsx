import { useState, useEffect } from 'react';
import {
  X, Share2, Download, Copy, Check, Link2,
  BookOpen, Brain, Users, Shield, MessageSquare,
  Flame, AlertCircle, TrendingUp, TrendingDown, Minus,
  GraduationCap, Calendar, Lock
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface LBIInsight {
  category:    string;
  value:       number;
  trend?:      'up' | 'down' | 'stable';
  trendValue?: number;
  description?: string;
}

interface Child {
  name:  string;
  grade: string;
  age?:  number;
}

interface ShareLBIReportProps {
  child:     Child;
  insights:  LBIInsight[];
  avgScore:  number;
  totalScore: number;
  maxScore:   number;
  onClose:   () => void;
}

/* ── Domain icon map ────────────────────────────────────────────────────── */
const DOMAIN_ICONS: Record<string, React.ElementType> = {
  'Academic':     BookOpen,
  'Analytical':   Brain,
  'Social':       Users,
  'Adjustment':   Shield,
  'Discipline':   Shield,
  'Communication': MessageSquare,
  'Drive':        Flame,
  'External':     AlertCircle,
};

function getDomainIcon(category: string) {
  const key = Object.keys(DOMAIN_ICONS).find(k => category.includes(k));
  return key ? DOMAIN_ICONS[key] : BookOpen;
}

function scoreLabel(v: number) {
  if (v >= 80) return { text: 'Strong',     color: '#4ECDC4', bg: '#ECFDF5' };
  if (v >= 60) return { text: 'Moderate',   color: '#F59E0B', bg: '#FFFBEB' };
  if (v >= 40) return { text: 'Developing', color: '#0B3C5D', bg: '#EEF2FF' };
  return             { text: 'Needs Attn',  color: '#EF4444', bg: '#FEF2F2' };
}

/* ── HTML report generator ─────────────────────────────────────────────── */
function buildHtmlReport(child: Child, insights: LBIInsight[], avgScore: number, totalScore: number, maxScore: number) {
  const strong  = insights.filter(i => i.value >= 80).map(i => i.category);
  const growth  = insights.filter(i => i.value < 60).map(i => i.category);
  const rows    = insights.map(i => {
    const lbl = scoreLabel(i.value);
    const trend = i.trend === 'up' ? '▲' : i.trend === 'down' ? '▼' : '—';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#1e293b">${i.category}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">
        <span style="background:${lbl.bg};color:${lbl.color};padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700">${i.value}%</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${i.trend==='up'?'#4ECDC4':i.trend==='down'?'#ef4444':'#94a3b8'}">${trend} ${i.trendValue ? Math.abs(i.trendValue)+'%' : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px">${lbl.text}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LBI Behavioral Report — ${child.name}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #f8fafc; color: #1e293b; }
    .page { max-width: 820px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #0B3C5D; padding: 32px 36px; color: #fff; }
    .header h1 { margin: 0 0 4px; font-size: 22px; }
    .header p  { margin: 0; opacity: .72; font-size: 13px; }
    .badge { display:inline-block; background:rgba(78,205,196,.18); color:#4ECDC4; padding:3px 12px; border-radius:999px; font-size:12px; font-weight:700; margin-top:10px; }
    .kpi-row { display:flex; gap:16px; padding:24px 36px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
    .kpi { flex:1; text-align:center; }
    .kpi .val { font-size:28px; font-weight:800; color:#0B3C5D; }
    .kpi .lbl { font-size:12px; color:#64748b; margin-top:4px; }
    .section { padding:24px 36px; }
    .section h2 { font-size:15px; font-weight:700; color:#0B3C5D; margin:0 0 14px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#f1f5f9; padding:8px 12px; text-align:left; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:.5px; }
    .pill-row { display:flex; flex-wrap:wrap; gap:8px; }
    .pill { padding:4px 14px; border-radius:999px; font-size:12px; font-weight:600; }
    .pill-green { background:#ecfdf5; color:#4ECDC4; }
    .pill-amber  { background:#fffbeb; color:#d97706; }
    .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 36px; display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; }
    .disclaimer { background:rgba(11,60,93,0.06); border-left:4px solid #0B3C5D; padding:14px 16px; border-radius:0 8px 8px 0; font-size:12px; color:#0B3C5D; margin:0 36px 24px; line-height:1.6; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>Learning Behaviour Index (LBI) Report</h1>
    <p>Prepared for: <strong>${child.name}</strong> · Grade ${child.grade} · ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</p>
    <span class="badge">MetryxOne · Confidential — For Teacher Use Only</span>
  </div>

  <div class="kpi-row">
    <div class="kpi"><div class="val">${totalScore}</div><div class="lbl">Total Score (out of ${maxScore})</div></div>
    <div class="kpi"><div class="val">${avgScore}%</div><div class="lbl">Average Across Domains</div></div>
    <div class="kpi"><div class="val">${insights.filter(i=>i.value>=80).length}</div><div class="lbl">Strong Domains</div></div>
    <div class="kpi"><div class="val">${insights.filter(i=>i.value<60).length}</div><div class="lbl">Domains Needing Support</div></div>
  </div>

  <div class="section">
    <h2>Domain-by-Domain Breakdown</h2>
    <table>
      <thead><tr>
        <th>Domain</th><th style="text-align:center">Score</th>
        <th style="text-align:center">Trend</th><th>Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  ${strong.length ? `<div class="section" style="padding-top:0">
    <h2>Strong Areas</h2>
    <div class="pill-row">${strong.map(s=>`<span class="pill pill-green">${s}</span>`).join('')}</div>
  </div>` : ''}

  ${growth.length ? `<div class="section" style="padding-top:0">
    <h2>Areas for Teacher Support</h2>
    <div class="pill-row">${growth.map(s=>`<span class="pill pill-amber">${s}</span>`).join('')}</div>
  </div>` : ''}

  <div class="disclaimer">
    <strong>Note to Teacher:</strong> This report is generated from the MetryxOne Learning Behaviour Index assessment. Scores reflect behavioural tendencies — not academic performance. Use alongside classroom observation for a holistic picture. Data shared with parental consent under DPDP Act 2023.
  </div>

  <div class="footer">
    <span>MetryxOne · metryx.in</span>
    <span>Generated ${new Date().toLocaleString()}</span>
    <span>Confidential · Not for redistribution</span>
  </div>
</div>
</body>
</html>`;
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function ShareLBIReport({ child, insights, avgScore, totalScore, maxScore, onClose }: ShareLBIReportProps) {
  const [visible,   setVisible]   = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [shareMode, setShareMode] = useState<'options' | 'link'>('options');
  const [shareLink, setShareLink] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t); }, []);

  const close = () => { setVisible(false); setTimeout(onClose, 300); };

  /* Generate obfuscated share token (base64 encoded compact payload) */
  const generateShareLink = async () => {
    setGenerating(true);
    try {
      const payload = {
        n: child.name,
        g: child.grade,
        s: avgScore,
        t: totalScore,
        m: maxScore,
        d: insights.map(i => ({ c: i.category.substring(0, 6), v: i.value, tr: i.trend ?? 's' })),
        ts: Date.now(),
      };
      // Try backend first; fall back to client-side token
      let link = '';
      try {
        const resp = await fetch('/api/share-lbi-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ childName: child.name, grade: child.grade, avgScore, totalScore, maxScore, insights }),
        });
        if (resp.ok) {
          const data = await resp.json();
          link = data.shareUrl;
        }
      } catch { /* fallback below */ }

      if (!link) {
        const token = btoa(JSON.stringify(payload)).replace(/=/g, '');
        link = `${window.location.origin}/lbi-report/${token}`;
      }
      setShareLink(link);
      setShareMode('link');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    const html = buildHtmlReport(child, insights, avgScore, totalScore, maxScore);
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `LBI_Report_${child.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990] transition-all duration-300"
        style={{
          backgroundColor: visible ? 'rgba(10,18,40,0.6)' : 'rgba(10,18,40,0)',
          backdropFilter:   visible ? 'blur(5px)' : 'blur(0)',
        }}
        onClick={close}
      />

      {/* Panel */}
      <div
        className="fixed z-[9991] flex flex-col"
        style={{
          width:     'min(480px, 96vw)',
          top:  '50%',
          left: '50%',
          transform: `translate(-50%, ${visible ? '-50%' : '-46%'})`,
          opacity:   visible ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.34,1.3,0.64,1), opacity 0.22s ease',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 28px 72px rgba(10,18,40,0.32), 0 0 0 1px rgba(11,60,93,0.1)',
          backgroundColor: '#fff',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{ background: '#0B3C5D' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(78,205,196,0.18)', border: '1.5px solid rgba(78,205,196,0.3)' }}>
              <Share2 size={18} style={{ color: '#4ECDC4' }} />
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Share LBI Report</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>{child.name} · Grade {child.grade}</p>
            </div>
          </div>
          <button onClick={close}
            className="h-8 w-8 rounded-xl flex items-center justify-center transition-all"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(255,255,255,0.2)'; e.currentTarget.style.color='#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor='rgba(255,255,255,0.1)'; e.currentTarget.style.color='rgba(255,255,255,0.6)'; }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-6 space-y-4">

          {/* Score summary strip */}
          <div className="rounded-2xl px-5 py-4 flex items-center gap-5"
            style={{ background: '#EEF2FF', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
                style={{ background: '#0B3C5D' }}>
                <GraduationCap size={22} style={{ color: '#fff' }} />
              </div>
              <div>
                <p style={{ fontSize: '21px', fontWeight: 800, color: '#0B3C5D' }}>{avgScore}%</p>
                <p style={{ fontSize: '11px', color: '#64748b' }}>LBI Average Score</p>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2">
              {[
                { label: 'Strong',   val: insights.filter(i=>i.value>=80).length,       color: '#4ECDC4' },
                { label: 'Growth',   val: insights.filter(i=>i.value<60).length,         color: '#F59E0B' },
                { label: 'Modules',  val: `${insights.length}/7`,                        color: '#0B3C5D' },
                { label: 'Total',    val: `${totalScore}/${maxScore}`,                    color: '#0B3C5D' },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: '#fff', border: '1px solid #f1f5f9' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color }}>{val}</p>
                  <p style={{ fontSize: '10px', color: '#94a3b8' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Domain pills */}
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
              Domains included
            </p>
            <div className="flex flex-wrap gap-2">
              {insights.map(i => {
                const lbl  = scoreLabel(i.value);
                const Icon = getDomainIcon(i.category);
                return (
                  <span key={i.category} className="flex items-center gap-1.5 rounded-full px-3 py-1"
                    style={{ backgroundColor: lbl.bg, border: `1px solid ${lbl.color}28` }}>
                    <Icon size={10} style={{ color: lbl.color }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: lbl.color }}>{i.category.split(' ')[0]} · {i.value}%</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Privacy notice */}
          <div className="rounded-xl px-4 py-3 flex gap-2.5 items-start"
            style={{ backgroundColor: 'rgba(11,60,93,0.06)', border: '1px solid rgba(11,60,93,0.18)' }}>
            <Lock size={13} style={{ color: '#0B3C5D', marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: '11.5px', color: '#0B3C5D', lineHeight: 1.6 }}>
              This report is sanitised for teacher use — <strong>no sensitive personal data</strong> beyond name and grade is included. Shared under parental consent (DPDP Act 2023).
            </p>
          </div>

          {shareMode === 'options' ? (
            /* Action buttons */
            <div className="space-y-2.5">
              <button onClick={generateShareLink} disabled={generating}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200 hover:-translate-y-px disabled:opacity-50"
                style={{ background: '#0B3C5D', boxShadow: '0 4px 14px rgba(11,60,93,0.3)' }}>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <Link2 size={16} style={{ color: '#fff' }} />
                </div>
                <div className="flex-1 text-left">
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Generate Shareable Link</p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>Send to your child's teacher securely</p>
                </div>
                {generating && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              </button>

              <button onClick={handleDownload}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200 hover:-translate-y-px"
                style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EEF2FF' }}>
                  <Download size={16} style={{ color: '#0B3C5D' }} />
                </div>
                <div className="flex-1 text-left">
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>Download HTML Report</p>
                  <p style={{ fontSize: '11px', color: '#64748B' }}>Print-ready report for in-person handover</p>
                </div>
              </button>

              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: `${child.name}'s LBI Report — MetryxOne`, text: `${child.name} (Grade ${child.grade}) has completed their LBI assessment on MetryxOne. Average score: ${avgScore}%. Strong areas: ${insights.filter(i=>i.value>=80).map(i=>i.category).join(', ') || 'N/A'}.`, url: window.location.origin });
                  } else {
                    generateShareLink();
                  }
                }}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200 hover:-translate-y-px"
                style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
                  <Share2 size={16} style={{ color: '#4ECDC4' }} />
                </div>
                <div className="flex-1 text-left">
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>Share via Device</p>
                  <p style={{ fontSize: '11px', color: '#64748B' }}>WhatsApp, Email, Messages & more</p>
                </div>
              </button>
            </div>
          ) : (
            /* Link generated */
            <div className="space-y-3">
              <div className="rounded-xl p-3.5 flex items-center gap-2.5"
                style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
                <Link2 size={14} style={{ color: '#0B3C5D', flexShrink: 0 }} />
                <p className="flex-1 truncate" style={{ fontSize: '12px', color: '#0B3C5D', fontFamily: 'monospace' }}>{shareLink}</p>
                <button onClick={copyLink}
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                  style={{ backgroundColor: copied ? '#ECFDF5' : '#EEF2FF', border: `1px solid ${copied ? '#4ECDC4' : '#0B3C5D'}30` }}>
                  {copied ? <Check size={13} style={{ color: '#4ECDC4' }} /> : <Copy size={13} style={{ color: '#0B3C5D' }} />}
                </button>
              </div>

              <div className="rounded-xl px-4 py-3 flex gap-2 items-start"
                style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <Calendar size={13} style={{ color: '#D97706', marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: '11px', color: '#92400E', lineHeight: 1.55 }}>
                  This link expires in <strong>7 days</strong>. Only share with your child's teacher. The recipient does not need a MetryxOne account.
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setShareMode('options'); setShareLink(''); }}
                  className="flex-1 rounded-xl py-2.5 transition-all"
                  style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  ← Back
                </button>
                <button onClick={handleDownload}
                  className="flex-1 rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all"
                  style={{ fontSize: '12px', fontWeight: 700, color: '#0B3C5D', backgroundColor: '#EEF2FF', border: '1px solid #0B3C5D30' }}>
                  <Download size={13} /> Also Download
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 text-center" style={{ borderTop: '1px solid #f1f5f9', backgroundColor: '#F8FAFC' }}>
          <p style={{ fontSize: '10px', color: '#94a3b8' }}>
            Powered by MetryxOne · DPDP 2023 compliant · Behavioural data only
          </p>
        </div>
      </div>
    </>
  );
}
