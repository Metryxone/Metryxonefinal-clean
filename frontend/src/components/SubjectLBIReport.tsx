import { useState } from 'react';
import { IntelligenceLayers } from './shared/IntelligenceLayers';
import { Brain, BookOpen, Share2, Download, Copy, CheckCircle } from 'lucide-react';

const BRAND = { primary: '#0B3C5D', teal: '#4ECDC4' };

interface Props {
  childName: string;
  childId: string;
  lbiData?: any;
  hasConsent: boolean;
}

const DOMAIN_SUBJECT_MAP: { domain: string; subjects: string[]; desc: string; strength: string; focus: string }[] = [
  {
    domain: 'Learning Efficiency',
    subjects: ['Mathematics', 'Physics', 'Chemistry'],
    desc: 'Determines how quickly new concepts are absorbed and retained in analytical subjects.',
    strength: 'High score → faster math problem-solving and formula retention',
    focus: 'Low score → use visual aids, spaced repetition for numerical subjects',
  },
  {
    domain: 'Conceptual Understanding',
    subjects: ['Science', 'Biology', 'Geography'],
    desc: 'Drives the ability to grasp and connect ideas across science and social subjects.',
    strength: 'High score → excels at diagram-based and application questions',
    focus: 'Low score → break concepts into smaller units, use mind maps',
  },
  {
    domain: 'Sustained Attention',
    subjects: ['English', 'History', 'Economics'],
    desc: 'Influences performance in reading-heavy and long-form answer subjects.',
    strength: 'High score → strong essay writing and comprehension',
    focus: 'Low score → use Pomodoro method, limit distraction during study',
  },
  {
    domain: 'Critical Thinking',
    subjects: ['Mathematics', 'Computer Science', 'Economics'],
    desc: 'Enables logical deduction, problem decomposition, and analytical reasoning.',
    strength: 'High score → strong in proof-based maths and logic problems',
    focus: 'Low score → practice argument mapping and case-based problems',
  },
  {
    domain: 'Emotional Regulation',
    subjects: ['All Exam Performance'],
    desc: 'Regulates exam anxiety, test performance consistency, and pressure handling.',
    strength: 'High score → performs consistently under exam conditions',
    focus: 'Low score → add mindfulness, practice timed mock tests to reduce anxiety',
  },
  {
    domain: 'Time Management',
    subjects: ['All Subjects'],
    desc: 'Governs study scheduling, assignment prioritisation, and exam time allocation.',
    strength: 'High score → completes syllabus ahead of schedule',
    focus: 'Low score → introduce weekly planners, break revision into daily goals',
  },
  {
    domain: 'Working Memory',
    subjects: ['Mathematics', 'Physics', 'Languages'],
    desc: 'Supports multi-step problem solving and holding information during calculation.',
    strength: 'High score → excels at mental arithmetic and multi-step proofs',
    focus: 'Low score → use written workings, chunking, and memory aids',
  },
  {
    domain: 'Effort Persistence',
    subjects: ['All Long-Form Subjects'],
    desc: 'Determines consistency of effort across challenging topics and exam preparation.',
    strength: 'High score → completes difficult chapters without giving up',
    focus: 'Low score → use short daily targets and reward milestones',
  },
];

function generateShareableHTML(childName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>LBI Report – ${childName}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 24px; color: #1e293b; }
  .header { background: #0B3C5D; color: white; border-radius: 16px; padding: 24px 28px; margin-bottom: 24px; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .notice { background: #FFF3CD; border: 1px solid #FFC107; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #856404; margin-bottom: 20px; }
  .domain { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .domain h3 { color: #0B3C5D; margin: 0 0 6px; font-size: 14px; }
  .domain p { margin: 0 0 8px; font-size: 12px; color: #475569; line-height: 1.5; }
  .tag { display: inline-block; background: rgba(11,60,93,0.08); color: #0B3C5D; border-radius: 20px; padding: 2px 10px; font-size: 11px; margin: 2px; }
  .tag.teal { background: rgba(78,205,196,0.1); color: #4ECDC4; }
  .insight { font-size: 11px; padding: 8px 12px; border-radius: 8px; margin-top: 8px; }
  .insight.strength { background: rgba(78,205,196,0.08); color: #4ECDC4; border-left: 3px solid #4ECDC4; }
  .insight.focus    { background: rgba(11,60,93,0.06); color: #0B3C5D; border-left: 3px solid #0B3C5D; }
  .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
</style>
</head>
<body>
<div class="header">
  <h1>Learning Behaviour Intelligence Report</h1>
  <p>${childName} · Shared from MetryxOne · ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
</div>
<div class="notice">
  ⚠️ This is a sanitised summary report for educational use. Detailed behavioral data is accessible only through the MetryxOne parent portal with explicit DPDP consent.
</div>
${DOMAIN_SUBJECT_MAP.map(d => `
<div class="domain">
  <h3>${d.domain}</h3>
  <p>${d.desc}</p>
  ${d.subjects.map(s => `<span class="tag">${s}</span>`).join('')}
  <div class="insight strength">Strength: ${d.strength}</div>
  <div class="insight focus">When low: ${d.focus}</div>
</div>`).join('')}
<div class="footer">MetryxOne · Behavioral Intelligence Platform · This report contains anonymised domain insights only. For full LBI data, request access via the parent portal.</div>
</body>
</html>`;
}

export function SubjectLBIReport({ childName, childId, lbiData, hasConsent }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const html = generateShareableHTML(childName);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MetryxOne_LBI_Report_${childName.replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = () => {
    const shareText = `MetryxOne LBI Insight Report for ${childName} — Shared on ${new Date().toLocaleDateString('en-IN')}. Access via MetryxOne parent portal.`;
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with share actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} style={{ color: BRAND.primary }} />
          <span className="text-sm font-semibold" style={{ color: BRAND.primary }}>Subject–LBI Intelligence Map</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'rgba(11,60,93,0.1)', color: BRAND.primary }}
          >
            {copied ? <><CheckCircle size={10} /> Copied</> : <><Copy size={10} /> Copy Link</>}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg text-white transition-opacity hover:opacity-80"
            style={{ background: BRAND.teal }}
          >
            <Share2 size={10} /> Share with Teacher
          </button>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Each LBI behavioral domain directly impacts performance in specific subjects. Use these insights to guide study strategies and mentor sessions.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {DOMAIN_SUBJECT_MAP.map(d => (
          <div
            key={d.domain}
            className="bg-white rounded-xl border p-3.5 cursor-pointer hover:shadow-sm transition-shadow"
            style={{ borderColor: expanded === d.domain ? `${BRAND.primary}40` : 'rgba(11,60,93,0.1)' }}
            onClick={() => setExpanded(e => e === d.domain ? null : d.domain)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain size={12} style={{ color: BRAND.primary }} />
                <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>{d.domain}</span>
              </div>
              <span className="text-[9px] text-gray-400">{expanded === d.domain ? '▲' : '▼'}</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1">
              {d.subjects.map(s => (
                <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(11,60,93,0.08)', color: BRAND.primary }}>
                  <BookOpen size={8} className="inline mr-0.5" />{s}
                </span>
              ))}
            </div>
            {expanded === d.domain && (
              <div className="mt-2 space-y-1.5 border-t pt-2" style={{ borderColor: 'rgba(11,60,93,0.08)' }}>
                <p className="text-[10px] text-gray-500 leading-relaxed">{d.desc}</p>
                <div className="text-[10px] px-2 py-1.5 rounded-lg leading-relaxed" style={{ background: 'rgba(78,205,196,0.08)', color: '#4ECDC4' }}>
                  <span className="font-semibold">When strong:</span> {d.strength}
                </div>
                <div className="text-[10px] px-2 py-1.5 rounded-lg leading-relaxed" style={{ background: 'rgba(11,60,93,0.06)', color: BRAND.primary }}>
                  <span className="font-semibold">When lower:</span> {d.focus}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Download full report */}
      <button
        onClick={handleDownload}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-80"
        style={{ borderColor: `${BRAND.primary}30`, color: BRAND.primary }}
      >
        <Download size={13} /> Download Full Report for Teacher
      </button>

      <IntelligenceLayers title="Learning Intelligence Layers" compact />
    </div>
  );
}
