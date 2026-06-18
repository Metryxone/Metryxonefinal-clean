export type ThemePreset = { id: string; name: string; primary: string; secondary: string; sidebarBg: string };

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'metryx',   name: 'MetryxOne', primary: '#344E86', secondary: '#4ECDC4', sidebarBg: '#f8fafc' },
  { id: 'teal',     name: 'Teal',      primary: '#0F766E', secondary: '#2DD4BF', sidebarBg: '#f0fdfa' },
  { id: 'navy',     name: 'Navy',      primary: '#1e3a8a', secondary: '#60a5fa', sidebarBg: '#eff6ff' },
  { id: 'forest',   name: 'Forest',    primary: '#166534', secondary: '#86efac', sidebarBg: '#f0fdf4' },
  { id: 'violet',   name: 'Violet',    primary: '#6d28d9', secondary: '#c4b5fd', sidebarBg: '#faf5ff' },
  { id: 'crimson',  name: 'Crimson',   primary: '#9F1239', secondary: '#fda4af', sidebarBg: '#fff1f2' },
  { id: 'amber',    name: 'Amber',     primary: '#b45309', secondary: '#fcd34d', sidebarBg: '#fffbeb' },
  { id: 'slate',    name: 'Slate',     primary: '#334155', secondary: '#94a3b8', sidebarBg: '#f8fafc' },
  { id: 'rose',     name: 'Rose',      primary: '#be185d', secondary: '#f9a8d4', sidebarBg: '#fff1f2' },
  { id: 'ink',      name: 'Ink',       primary: '#111827', secondary: '#6b7280', sidebarBg: '#f3f4f6' },
];

export const FONT_FAMILIES = [
  { id: 'inter',        label: 'Inter (Modern)',       value: "'Inter', system-ui, -apple-system, sans-serif" },
  { id: 'georgia',      label: 'Georgia (Classic)',    value: "'Georgia', 'Times New Roman', serif" },
  { id: 'roboto',       label: 'Roboto (Clean)',       value: "'Roboto', system-ui, sans-serif" },
  { id: 'calibri',      label: 'Calibri (Friendly)',   value: "'Calibri', 'Segoe UI', sans-serif" },
  { id: 'merriweather', label: 'Merriweather (Print)', value: "'Merriweather', 'Georgia', serif" },
] as const;
export type FontFamilyId = typeof FONT_FAMILIES[number]['id'];

export const PAGE_SIZES = {
  a4:     { id: 'a4',     label: 'A4 (210 × 297mm)',    wMM: 210,   hMM: 297 },
  letter: { id: 'letter', label: 'US Letter (8.5 × 11)', wMM: 215.9, hMM: 279.4 },
} as const;
export type PageSizeId = keyof typeof PAGE_SIZES;

export const TEMPLATES = [
  { id: 'modern-sidebar', label: 'Sidebar',   desc: 'Two-tone with left rail' },
  { id: 'classic',        label: 'Classic',   desc: 'Serif, centered header' },
  { id: 'minimal',        label: 'Minimal',   desc: 'Whitespace + dates rail' },
  { id: 'executive',      label: 'Executive', desc: 'Bold caps, gravitas' },
  { id: 'creative',       label: 'Creative',  desc: 'Color block + accents' },
  { id: 'tech',           label: 'Tech',      desc: 'Mono accents, dense' },
  { id: 'academic',       label: 'Academic',  desc: 'Single column, citation feel' },
  { id: 'two-column',     label: 'Two-column',desc: 'Balanced grid' },
] as const;
export type TemplateId = typeof TEMPLATES[number]['id'];

/* AI bullet library — role-keyed suggestions (use %x/%n/%m as placeholders the user fills in). */
export const AI_BULLET_LIBRARY: Array<{ role: string; keywords: string[]; bullets: string[] }> = [
  { role: 'Engineering', keywords: ['engineer','developer','software','sde','sre','backend','frontend','fullstack'], bullets: [
    'Built %x service handling 10M+ requests/day with p99 latency under 150ms.',
    'Migrated %x from monolith to microservices, reducing deploy time from 45m to 6m.',
    'Designed event-driven pipeline cutting end-to-end processing cost by 38%.',
    'Reduced bug rate 42% by introducing typed contracts and integration tests.',
    'Owned on-call rotation for tier-1 service with 99.99% availability SLA.',
    'Refactored legacy %x reducing memory footprint by 55% and freeing 2 GB per host.',
  ]},
  { role: 'Engineering Manager', keywords: ['manager','lead','head of engineering','director','vp'], bullets: [
    'Led team of %n engineers shipping %x to production each quarter.',
    'Defined OKRs across 3 squads, improving team-level delivery velocity by 28%.',
    'Coached 4 reports into senior roles within 18 months.',
    'Partnered with product + design to land flagship release driving 22% MAU lift.',
    'Reduced cycle time from 11d to 4d via WIP limits + trunk-based development.',
  ]},
  { role: 'Product', keywords: ['product','pm','product manager','owner'], bullets: [
    'Owned %x product line generating $%m ARR and 18% YoY growth.',
    'Shipped %n discovery cycles synthesising 60+ interviews into a unified roadmap.',
    'Cut activation funnel drop-off 24% through onboarding redesign.',
    'Defined pricing experiment yielding 14% conversion lift on Pro plan.',
    'Launched %x feature adopted by 38% of MAUs within first 30 days.',
  ]},
  { role: 'Design', keywords: ['designer','design','ux','ui','product design'], bullets: [
    'Redesigned %x flow improving task completion rate from 62% to 88%.',
    'Built and maintained design system used by 40+ engineers, cutting QA cycles 30%.',
    'Led generative + evaluative research with %n users to validate %x hypothesis.',
    'Shipped accessibility audit raising WCAG compliance from AA-partial to AAA.',
  ]},
  { role: 'Marketing', keywords: ['marketing','growth','demand','content','seo','brand'], bullets: [
    'Grew organic traffic 3.2× over 12 months via SEO-first content + technical fixes.',
    'Owned $%m paid spend across LinkedIn + Google with CPL down 28% YoY.',
    'Launched lifecycle program lifting trial-to-paid conversion 19%.',
    'Built brand campaign generating %n million impressions and 18% lift in aided recall.',
  ]},
  { role: 'Sales', keywords: ['sales','account executive','ae','bd','sdr','business development'], bullets: [
    'Closed $%m in new logo ARR, 142% of annual quota.',
    'Built outbound motion booking %n qualified meetings/month with 31% close rate.',
    'Led enterprise rollout to 12 Fortune-500 accounts spanning 3 verticals.',
    'Negotiated 7-figure renewal expanding seat count by 64%.',
  ]},
  { role: 'HR / People', keywords: ['hr','human resources','talent','people','recruit','recruitment','recruiter'], bullets: [
    'Built recruiting engine hiring %n roles in 12 months with 18-day average time-to-hire.',
    'Implemented competency framework adopted across 6 functions and 400+ employees.',
    'Reduced regrettable attrition 22% through manager enablement and stay interviews.',
    'Designed comp & benefits structure aligned to 75th-percentile market data.',
    'Led full HRIS migration (Workday/SuccessFactors) in record 90-day window.',
  ]},
  { role: 'Founder', keywords: ['founder','co-founder','ceo','entrepreneur','startup'], bullets: [
    'Founded %x; bootstrapped from concept to $%m ARR with 8-person team.',
    'Closed seed round of $%m from tier-1 investors against a 7-figure ARR milestone.',
    'Built and shipped MVP in 12 weeks, onboarding first 100 paying customers.',
    'Set company-wide strategy + OKRs across product, GTM, and operations.',
  ]},
  { role: 'Operations', keywords: ['operations','ops','program','project manager','pm ops'], bullets: [
    'Streamlined %x process cutting cycle time 41% and operating cost $%m annually.',
    'Implemented SOPs + dashboards giving leadership weekly visibility on 12 KPIs.',
    'Negotiated vendor contracts saving 18% over baseline.',
    'Stood up program governance reducing scope creep across 7 cross-functional initiatives.',
  ]},
  { role: 'Data / ML', keywords: ['data','analytics','scientist','ml','machine learning','ai'], bullets: [
    'Built %x ML model improving prediction accuracy from 71% to 88% F1.',
    'Designed analytics warehouse + dbt pipeline processing 200M events/day.',
    'Authored experimentation framework powering 60+ A/B tests across product.',
    'Shipped recommender lifting CTR 24% in production.',
  ]},
  { role: 'Finance', keywords: ['finance','accounting','controller','fp&a','cfo','treasury'], bullets: [
    'Closed monthly books in 4 business days, down from 11 days.',
    'Built FP&A model driving board-level scenario planning across 3 growth cases.',
    'Owned audit engagement with zero material findings two years running.',
  ]},
  { role: 'Customer Success', keywords: ['customer success','cs','support','account manager','csm'], bullets: [
    'Owned book of business worth $%m ARR with 124% net revenue retention.',
    'Reduced churn 6.2 → 3.1% via health-score model + proactive playbooks.',
    'Built onboarding program cutting time-to-first-value from 38 to 14 days.',
  ]},
];

export const ATS_STOPWORDS = new Set([
  'the','and','or','of','in','to','a','an','for','on','with','as','at','by','from','is','are','be','this','that','these','those','it','its','we','our','you','your','they','their','will','can','have','has','was','were','been','but','not','if','than','then','also','when','where','what','how','which','about','into','any','all','some','more','most','very','just','one','two','three','role','team','work','company','position','candidate','experience','years','plus','strong','etc','please','required','preferred','responsibilities','requirements','qualifications','must','should','able','ability','including','include','well','using','use','within','across','other','new','make','help','build','helping','looking','etc.','i','me','my','his','her','him','she','he',
]);

/* Cover letter defaults */
export type CoverLetterData = {
  recipientName: string;
  recipientTitle: string;
  recipientCompany: string;
  recipientAddress: string;
  dateLine: string;
  subject: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
  signatureName: string;
};

export const COVER_LETTER_DEFAULT: CoverLetterData = {
  recipientName: '',
  recipientTitle: 'Hiring Manager',
  recipientCompany: '',
  recipientAddress: '',
  dateLine: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  subject: 'Application for the [Role] position',
  greeting: 'Dear Hiring Manager,',
  paragraphs: [
    'I am writing to express my interest in the [Role] position at [Company]. With [N] years of experience in [field/domain], I have a track record of [key achievement] that I believe maps directly to the outcomes you are looking for.',
    'In my most recent role at [Current Company], I [headline accomplishment with metric]. I am particularly excited about [Company] because [specific reason — product, mission, market position] and I see a strong fit between your [team/initiative] and where I want to take the next step in my career.',
    'I would welcome the chance to discuss how I can contribute to your team. Thank you for considering my application — I have attached my resume for your review and look forward to hearing from you.',
  ],
  closing: 'Sincerely,',
  signatureName: '',
};

/* ATS scoring */
export function tokenizeForATS(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#./\-\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.replace(/^[-.]+|[-.]+$/g, ''))
    .filter(t => t.length > 2 && !ATS_STOPWORDS.has(t));
}

export function topKeywords(text: string, n = 30): Array<{ word: string; count: number }> {
  const freq = new Map<string, number>();
  for (const t of tokenizeForATS(text)) freq.set(t, (freq.get(t) || 0) + 1);
  return Array.from(freq.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export function atsScore(jobDescription: string, resumeText: string): {
  score: number; matched: string[]; missing: string[]; total: number;
} {
  const jdTop = topKeywords(jobDescription, 25);
  if (jdTop.length === 0) return { score: 0, matched: [], missing: [], total: 0 };
  const resumeSet = new Set(tokenizeForATS(resumeText));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of jdTop) {
    if (resumeSet.has(k.word)) matched.push(k.word); else missing.push(k.word);
  }
  const score = Math.round((matched.length / jdTop.length) * 100);
  return { score, matched, missing, total: jdTop.length };
}
