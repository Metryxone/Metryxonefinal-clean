import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  User, Mail, Phone, MapPin, Linkedin, Github, Globe, Plus, X, Trash2,
  ChevronDown, ChevronUp, Download, Eye, EyeOff, Edit3, RefreshCw,
  GripVertical, FileText, Briefcase, GraduationCap, Code, Wrench, Heart,
  Award, FolderOpen, Languages, Star, Sparkles, Save, Check, ArrowUp, ArrowDown,
  Palette, Type, FileDown, Wand2, Layout,
} from 'lucide-react';
import { THEME_PRESETS, FONT_FAMILIES, FontFamilyId, PAGE_SIZES, PageSizeId, TEMPLATES, TemplateId } from './resume/library';
import { NEW_TEMPLATE_RENDERERS, TemplateProps as NewTemplateProps } from './resume/templates';
import { AIBulletPicker, ATSCheckPanel, CoverLetterStudio } from './resume/addons';



/* ───────────────────────────── Types ───────────────────────────── */

type Personal = {
  name: string; title: string; email: string; phone: string;
  location: string; linkedin: string; github: string; website: string;
};
type ExpItem = { role: string; company: string; location: string; startDate: string; endDate: string; isCurrent: boolean; bullets: string[] };
type EduItem = { institution: string; degree: string; field: string; grade: string; startYear: string; endYear: string };
type ProjItem = { name: string; description: string; tech: string[]; link: string };
type CertItem = { name: string; issuer: string; year: string; link: string };
type AwardItem = { title: string; issuer: string; year: string };
type LanguageItem = { name: string; level: string };

type SectionKey =
  | 'summary' | 'experience' | 'education' | 'skills'
  | 'projects' | 'certifications' | 'awards' | 'languages';

type ResumeData = {
  personal: Personal;
  summary: string;
  experience: ExpItem[];
  education: EduItem[];
  skills: { technical: string[]; tools: string[]; soft: string[] };
  projects: ProjItem[];
  certifications: CertItem[];
  awards: AwardItem[];
  languages: LanguageItem[];
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
  template: TemplateId;
  accentColor: string;
  themeId?: string;
  fontFamilyId?: FontFamilyId;
  fontScale?: number;
  pageSize?: PageSizeId;
};

const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'awards', 'languages',
];

const SECTION_META: Record<SectionKey, { label: string; icon: React.ReactNode }> = {
  summary:        { label: 'Profile / Summary',  icon: <FileText size={14}/> },
  experience:     { label: 'Experience',         icon: <Briefcase size={14}/> },
  education:      { label: 'Education',          icon: <GraduationCap size={14}/> },
  skills:         { label: 'Skills',             icon: <Code size={14}/> },
  projects:       { label: 'Projects',           icon: <FolderOpen size={14}/> },
  certifications: { label: 'Certifications',     icon: <Award size={14}/> },
  awards:         { label: 'Awards & Honors',    icon: <Star size={14}/> },
  languages:      { label: 'Languages',          icon: <Languages size={14}/> },
};

/* ─────────────────────────── Profile seed ─────────────────────────── */

function seedFromProfile(profile: any): ResumeData {
  const p = profile?.personal || {};
  const exps = (profile?.experience || []).map((e: any) => ({
    role: e.role || '', company: e.company || '', location: e.location || '',
    startDate: e.startDate || '', endDate: e.endDate || '', isCurrent: !!e.isCurrent,
    bullets: e.description
      ? String(e.description).split(/\n|•/).map((s: string) => s.trim()).filter(Boolean)
      : [],
  }));
  const edus = (profile?.education || []).map((e: any) => ({
    institution: e.institution || '', degree: e.degree || '', field: e.field || '',
    grade: e.grade || '', startYear: String(e.startYear || ''), endYear: String(e.endYear || ''),
  }));
  const projs = (profile?.projects || []).map((p: any) => ({
    name: p.name || '', description: p.description || '',
    tech: Array.isArray(p.tech) ? p.tech : [], link: p.link || '',
  }));
  const certs = (profile?.certifications || []).map((c: any) => ({
    name: c.name || '', issuer: c.issuer || '', year: String(c.year || ''), link: c.link || '',
  }));
  const langs = (profile?.spokenLanguages || []).map((l: any) =>
    typeof l === 'string' ? { name: l, level: '' } : { name: l?.name || '', level: l?.level || '' }
  );
  return {
    personal: {
      name: p.name || '', title: exps[0]?.role || '',
      email: p.email || '', phone: p.phone || '', location: p.location || '',
      linkedin: p.linkedin || '', github: p.github || '', website: p.website || '',
    },
    summary: profile?.summary || '',
    experience: exps,
    education: edus,
    skills: {
      technical: profile?.skills?.technical || [],
      tools:     profile?.skills?.tools || [],
      soft:      profile?.skills?.soft || [],
    },
    projects: projs,
    certifications: certs,
    awards: [],
    languages: langs,
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    template: 'modern-sidebar',
    accentColor: BRAND.primary,
    themeId: 'metryx',
    fontFamilyId: 'inter',
    fontScale: 1,
    pageSize: 'a4',
  };
}

/* ─────────────────────────── Persistence ─────────────────────────── */

const lsKey = (userId: string) => `mx-resume-${userId || 'anon'}`;
const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;
function loadResume(userId: string, profile: any): ResumeData {
  if (!hasStorage()) return seedFromProfile(profile);
  try {
    const raw = window.localStorage.getItem(lsKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      const seed = seedFromProfile(profile);
      return {
        ...seed,
        ...parsed,
        personal: { ...seed.personal, ...(parsed.personal || {}) },
        skills:   { ...seed.skills,   ...(parsed.skills   || {}) },
        sectionOrder:    parsed.sectionOrder?.length    ? parsed.sectionOrder    : seed.sectionOrder,
        hiddenSections:  parsed.hiddenSections          ?? seed.hiddenSections,
      };
    }
  } catch {}
  return seedFromProfile(profile);
}
function saveResume(userId: string, data: ResumeData) {
  if (!hasStorage()) return;
  try { window.localStorage.setItem(lsKey(userId), JSON.stringify(data)); } catch {}
}

/* ─────────────────────────── Small inputs ─────────────────────────── */

const inputCls = 'w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none bg-white';

function TextField({ label, value, onChange, placeholder, icon }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      {label && <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1 flex items-center gap-1">{icon}{label}</div>}
      <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/>
    </div>
  );
}
function TextArea({ label, value, onChange, placeholder, rows = 3 }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      {label && <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">{label}</div>}
      <textarea className={inputCls + ' resize-y leading-relaxed'} rows={rows}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/>
    </div>
  );
}
function TagList({ items, onChange, placeholder, color = BRAND.accent }: {
  items: string[]; onChange: (next: string[]) => void; placeholder: string; color?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim(); if (!v) return;
    if (!items.includes(v)) onChange([...items, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((t, i) => (
          <span key={t + i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md text-white"
            style={{ backgroundColor: color }}>
            {t}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="opacity-70 hover:opacity-100"><X size={10}/></button>
          </span>
        ))}
        {items.length === 0 && <span className="text-[10px] text-gray-400 italic">None added</span>}
      </div>
      <div className="flex gap-1.5">
        <input className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}/>
        <button onClick={add} className="text-[11px] px-2.5 py-1 rounded-lg text-white shrink-0" style={{ backgroundColor: color }}>Add</button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Section Card ─────────────────────────── */

function SectionPanel({
  k, open, onToggle, hidden, onToggleVisible, onMoveUp, onMoveDown, children, count,
}: {
  k: SectionKey; open: boolean; onToggle: () => void; hidden: boolean;
  onToggleVisible: () => void; onMoveUp?: () => void; onMoveDown?: () => void;
  children: React.ReactNode; count?: number;
}) {
  const meta = SECTION_META[k];
  return (
    <div className={`rounded-xl border ${hidden ? 'border-gray-100 bg-gray-50/60 opacity-70' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left">
          <span style={{ color: BRAND.primary }}>{meta.icon}</span>
          <span className="text-xs font-semibold text-gray-800">{meta.label}</span>
          {typeof count === 'number' && <span className="text-[10px] text-gray-400">({count})</span>}
        </button>
        <button onClick={onMoveUp} disabled={!onMoveUp} className="text-gray-400 hover:text-gray-600 disabled:opacity-20" title="Move up"><ArrowUp size={12}/></button>
        <button onClick={onMoveDown} disabled={!onMoveDown} className="text-gray-400 hover:text-gray-600 disabled:opacity-20" title="Move down"><ArrowDown size={12}/></button>
        <button onClick={onToggleVisible} className="text-gray-400 hover:text-gray-600" title={hidden ? 'Show on resume' : 'Hide from resume'}>
          {hidden ? <EyeOff size={12}/> : <Eye size={12}/>}
        </button>
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
          {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
      </div>
      {open && <div className="px-3 pb-3 space-y-2.5">{children}</div>}
    </div>
  );
}

/* ─────────────────────────── PREVIEW: Modern Sidebar ─────────────────────────── */

function ModernSidebarPreview({ data, fontFamily, pageHmm }: { data: ResumeData; fontFamily?: string; pageHmm?: number }) {
  const accent = data.accentColor || BRAND.primary;
  const visible = (k: SectionKey) => !data.hiddenSections.includes(k);

  const sidebarSections: SectionKey[] = ['skills', 'certifications', 'languages'];
  const mainSections: SectionKey[]    = data.sectionOrder.filter(s => !sidebarSections.includes(s));

  return (
    <div className="bg-white text-gray-900" style={{ fontFamily: fontFamily || "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", minHeight: `${pageHmm || 297}mm` }}>
      {/* Header bar */}
      <div className="px-10 py-7 text-white" style={{ backgroundColor: accent }}>
        <h2 className="text-[26px] font-bold leading-tight tracking-tight">{data.personal.name || 'Your Name'}</h2>
        {data.personal.title && <div className="text-sm opacity-90 mt-0.5">{data.personal.title}</div>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] opacity-90">
          {data.personal.email    && <span className="flex items-center gap-1"><Mail size={10}/>{data.personal.email}</span>}
          {data.personal.phone    && <span className="flex items-center gap-1"><Phone size={10}/>{data.personal.phone}</span>}
          {data.personal.location && <span className="flex items-center gap-1"><MapPin size={10}/>{data.personal.location}</span>}
          {data.personal.linkedin && <span className="flex items-center gap-1"><Linkedin size={10}/>{data.personal.linkedin}</span>}
          {data.personal.github   && <span className="flex items-center gap-1"><Github size={10}/>{data.personal.github}</span>}
          {data.personal.website  && <span className="flex items-center gap-1"><Globe size={10}/>{data.personal.website}</span>}
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 shrink-0 p-6 space-y-5" style={{ backgroundColor: '#f8fafc' }}>
          {visible('skills') && (data.skills.technical.length > 0 || data.skills.tools.length > 0 || data.skills.soft.length > 0) && (
            <>
              {data.skills.technical.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Technical</div>
                  <div className="space-y-1">{data.skills.technical.map(s => (
                    <div key={s} className="text-[11px] text-gray-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BRAND.accent }}/>{s}
                    </div>))}
                  </div>
                </div>)}
              {data.skills.tools.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Tools</div>
                  <div className="space-y-1">{data.skills.tools.map(s => (
                    <div key={s} className="text-[11px] text-gray-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#8b5cf6' }}/>{s}
                    </div>))}
                  </div>
                </div>)}
              {data.skills.soft.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Soft Skills</div>
                  <div className="space-y-1">{data.skills.soft.map(s => (
                    <div key={s} className="text-[11px] text-gray-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BRAND.green }}/>{s}
                    </div>))}
                  </div>
                </div>)}
            </>
          )}
          {visible('certifications') && data.certifications.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Certifications</div>
              <div className="space-y-1.5">{data.certifications.map((c, i) => (
                <div key={i} className="text-[11px] text-gray-700">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-gray-500 text-[10px]">{[c.issuer, c.year].filter(Boolean).join(' · ')}</div>
                </div>))}
              </div>
            </div>
          )}
          {visible('languages') && data.languages.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Languages</div>
              <div className="space-y-1">{data.languages.map((l, i) => (
                <div key={i} className="text-[11px] text-gray-700 flex justify-between gap-2">
                  <span>{l.name}</span>{l.level && <span className="text-gray-400 text-[10px]">{l.level}</span>}
                </div>))}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="flex-1 p-7 space-y-5 border-l border-gray-100">
          {mainSections.map(sec => {
            if (!visible(sec)) return null;
            switch (sec) {
              case 'summary': return data.summary ? (
                <section key={sec}>
                  <SectionHeading accent={accent} label="Profile"/>
                  <p className="text-[11.5px] text-gray-700 leading-relaxed">{data.summary}</p>
                </section>) : null;
              case 'experience': return data.experience.length > 0 ? (
                <section key={sec}>
                  <SectionHeading accent={accent} label="Experience"/>
                  <div className="space-y-3.5">
                    {data.experience.map((e, i) => (
                      <div key={i}>
                        <div className="flex items-baseline justify-between">
                          <div className="text-[12px] font-bold text-gray-900">{e.role}</div>
                          <div className="text-[10px] text-gray-500">{e.startDate} – {e.isCurrent ? 'Present' : e.endDate}</div>
                        </div>
                        <div className="text-[11px] text-gray-700">{[e.company, e.location].filter(Boolean).join(' · ')}</div>
                        {e.bullets.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {e.bullets.map((b, j) => (
                              <li key={j} className="text-[11px] text-gray-700 flex gap-1.5 leading-relaxed">
                                <span style={{ color: accent }}>▎</span>{b}
                              </li>))}
                          </ul>)}
                      </div>))}
                  </div>
                </section>) : null;
              case 'education': return data.education.length > 0 ? (
                <section key={sec}>
                  <SectionHeading accent={accent} label="Education"/>
                  <div className="space-y-2">{data.education.map((ed, i) => (
                    <div key={i}>
                      <div className="flex items-baseline justify-between">
                        <div className="text-[12px] font-bold text-gray-900">{ed.institution}</div>
                        <div className="text-[10px] text-gray-500">{ed.startYear} – {ed.endYear}</div>
                      </div>
                      <div className="text-[11px] text-gray-700">{[ed.degree, ed.field, ed.grade].filter(Boolean).join(' · ')}</div>
                    </div>))}
                  </div>
                </section>) : null;
              case 'projects': return data.projects.length > 0 ? (
                <section key={sec}>
                  <SectionHeading accent={accent} label="Projects"/>
                  <div className="space-y-2.5">{data.projects.map((pr, i) => (
                    <div key={i}>
                      <div className="text-[12px] font-bold text-gray-900">{pr.name}</div>
                      {pr.description && <p className="text-[11px] text-gray-700 leading-relaxed">{pr.description}</p>}
                      {pr.tech.length > 0 && <div className="text-[10px] text-gray-500 mt-0.5">{pr.tech.join(' · ')}</div>}
                    </div>))}
                  </div>
                </section>) : null;
              case 'awards': return data.awards.length > 0 ? (
                <section key={sec}>
                  <SectionHeading accent={accent} label="Awards & Honors"/>
                  <div className="space-y-1.5">{data.awards.map((a, i) => (
                    <div key={i} className="text-[11px] text-gray-700">
                      <span className="font-semibold">{a.title}</span>
                      {a.issuer && <span> · {a.issuer}</span>}
                      {a.year && <span className="text-gray-500"> · {a.year}</span>}
                    </div>))}
                  </div>
                </section>) : null;
              default: return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ accent, label }: { accent: string; label: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5 pb-1 border-b" style={{ color: accent, borderColor: accent }}>{label}</div>
  );
}

/* ─────────────────────────── PREVIEW: Classic ─────────────────────────── */

function ClassicPreview({ data, fontFamily, pageHmm }: { data: ResumeData; fontFamily?: string; pageHmm?: number }) {
  const accent = data.accentColor || BRAND.primary;
  const visible = (k: SectionKey) => !data.hiddenSections.includes(k);
  return (
    <div className="bg-white text-gray-900 px-10 py-8 space-y-4" style={{ fontFamily: fontFamily || "'Georgia', 'Times New Roman', serif", minHeight: `${pageHmm || 297}mm` }}>
      <header className="text-center pb-3 border-b-2" style={{ borderColor: accent }}>
        <h1 className="text-2xl font-bold tracking-wide" style={{ color: accent }}>{data.personal.name || 'Your Name'}</h1>
        {data.personal.title && <div className="text-sm text-gray-700 italic mt-0.5">{data.personal.title}</div>}
        <div className="text-[11px] text-gray-600 mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {data.personal.email}{data.personal.email && <span>·</span>}
          {data.personal.phone}{data.personal.phone && <span>·</span>}
          {data.personal.location}{data.personal.location && <span>·</span>}
          {data.personal.linkedin}
        </div>
      </header>
      {data.sectionOrder.map(sec => {
        if (!visible(sec)) return null;
        switch (sec) {
          case 'summary': return data.summary ? <section key={sec}><h2 className="text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: accent }}>Profile</h2><p className="text-[12px] leading-relaxed">{data.summary}</p></section> : null;
          case 'experience': return data.experience.length ? <section key={sec}>
            <h2 className="text-[12px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Experience</h2>
            <div className="space-y-3">{data.experience.map((e, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <div><span className="text-[12.5px] font-bold">{e.role}</span><span className="text-[12px] text-gray-700">{e.company && ` · ${e.company}`}</span></div>
                  <div className="text-[10.5px] text-gray-600 italic">{e.startDate} – {e.isCurrent ? 'Present' : e.endDate}</div>
                </div>
                {e.location && <div className="text-[10.5px] text-gray-600 italic">{e.location}</div>}
                {e.bullets.length > 0 && <ul className="list-disc ml-5 mt-1 space-y-0.5">{e.bullets.map((b, j) => <li key={j} className="text-[11.5px] leading-relaxed">{b}</li>)}</ul>}
              </div>))}</div></section> : null;
          case 'education': return data.education.length ? <section key={sec}>
            <h2 className="text-[12px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Education</h2>
            <div className="space-y-1.5">{data.education.map((ed, i) => (
              <div key={i} className="flex justify-between items-baseline">
                <div><span className="text-[12.5px] font-bold">{ed.institution}</span><span className="text-[11.5px]"> — {[ed.degree, ed.field].filter(Boolean).join(', ')}</span></div>
                <div className="text-[10.5px] text-gray-600 italic">{ed.startYear} – {ed.endYear}</div>
              </div>))}</div></section> : null;
          case 'skills': return (data.skills.technical.length || data.skills.tools.length || data.skills.soft.length) ? <section key={sec}>
            <h2 className="text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: accent }}>Skills</h2>
            <div className="text-[11.5px] space-y-0.5">
              {data.skills.technical.length > 0 && <div><span className="font-semibold">Technical: </span>{data.skills.technical.join(', ')}</div>}
              {data.skills.tools.length > 0     && <div><span className="font-semibold">Tools: </span>{data.skills.tools.join(', ')}</div>}
              {data.skills.soft.length > 0      && <div><span className="font-semibold">Soft: </span>{data.skills.soft.join(', ')}</div>}
            </div></section> : null;
          case 'projects': return data.projects.length ? <section key={sec}>
            <h2 className="text-[12px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Projects</h2>
            <div className="space-y-2">{data.projects.map((p, i) => (
              <div key={i}>
                <div className="text-[12px] font-bold">{p.name}</div>
                {p.description && <p className="text-[11.5px]">{p.description}</p>}
                {p.tech.length > 0 && <div className="text-[10.5px] text-gray-600 italic">{p.tech.join(' · ')}</div>}
              </div>))}</div></section> : null;
          case 'certifications': return data.certifications.length ? <section key={sec}>
            <h2 className="text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: accent }}>Certifications</h2>
            <ul className="text-[11.5px] list-disc ml-5">{data.certifications.map((c, i) => <li key={i}><span className="font-medium">{c.name}</span>{c.issuer && ` — ${c.issuer}`}{c.year && ` (${c.year})`}</li>)}</ul></section> : null;
          case 'awards': return data.awards.length ? <section key={sec}>
            <h2 className="text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: accent }}>Awards & Honors</h2>
            <ul className="text-[11.5px] list-disc ml-5">{data.awards.map((a, i) => <li key={i}><span className="font-medium">{a.title}</span>{a.issuer && ` — ${a.issuer}`}{a.year && ` (${a.year})`}</li>)}</ul></section> : null;
          case 'languages': return data.languages.length ? <section key={sec}>
            <h2 className="text-[12px] font-bold uppercase tracking-widest mb-1.5" style={{ color: accent }}>Languages</h2>
            <div className="text-[11.5px]">{data.languages.map((l, i) => <span key={i}>{i > 0 && ' · '}{l.name}{l.level ? ` (${l.level})` : ''}</span>)}</div></section> : null;
          default: return null;
        }
      })}
    </div>
  );
}

/* ─────────────────────────── PREVIEW: Minimal ─────────────────────────── */

function MinimalPreview({ data, fontFamily, pageHmm }: { data: ResumeData; fontFamily?: string; pageHmm?: number }) {
  const accent = data.accentColor || BRAND.primary;
  const visible = (k: SectionKey) => !data.hiddenSections.includes(k);
  return (
    <div className="bg-white text-gray-900 px-10 py-10 space-y-5" style={{ fontFamily: fontFamily || "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", minHeight: `${pageHmm || 297}mm` }}>
      <header>
        <h1 className="text-3xl font-light tracking-tight text-gray-900">{data.personal.name || 'Your Name'}</h1>
        {data.personal.title && <div className="text-sm text-gray-600 mt-1">{data.personal.title}</div>}
        <div className="text-[11px] text-gray-500 mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {[data.personal.email, data.personal.phone, data.personal.location, data.personal.linkedin, data.personal.github, data.personal.website].filter(Boolean).join(' · ')}
        </div>
      </header>
      {data.sectionOrder.map(sec => {
        if (!visible(sec)) return null;
        const heading = (l: string) => <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-400 mb-2">{l}</div>;
        switch (sec) {
          case 'summary': return data.summary ? <section key={sec}>{heading('About')}<p className="text-[12px] text-gray-700 leading-relaxed">{data.summary}</p></section> : null;
          case 'experience': return data.experience.length ? <section key={sec}>{heading('Experience')}<div className="space-y-3.5">{data.experience.map((e, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr] gap-4">
              <div className="text-[10.5px] text-gray-500">{e.startDate} – {e.isCurrent ? 'Present' : e.endDate}</div>
              <div>
                <div className="text-[12.5px] font-semibold text-gray-900">{e.role}</div>
                <div className="text-[11px] text-gray-600">{[e.company, e.location].filter(Boolean).join(' · ')}</div>
                {e.bullets.length > 0 && <ul className="mt-1 space-y-0.5">{e.bullets.map((b, j) => <li key={j} className="text-[11px] text-gray-700 leading-relaxed">— {b}</li>)}</ul>}
              </div>
            </div>))}</div></section> : null;
          case 'education': return data.education.length ? <section key={sec}>{heading('Education')}<div className="space-y-1.5">{data.education.map((ed, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr] gap-4">
              <div className="text-[10.5px] text-gray-500">{ed.startYear} – {ed.endYear}</div>
              <div className="text-[11.5px]"><span className="font-semibold">{ed.institution}</span> · {[ed.degree, ed.field].filter(Boolean).join(', ')}</div>
            </div>))}</div></section> : null;
          case 'skills': return (data.skills.technical.length || data.skills.tools.length || data.skills.soft.length) ? <section key={sec}>{heading('Skills')}<div className="text-[11.5px] text-gray-700 space-y-1">
            {data.skills.technical.length > 0 && <div><span className="text-gray-500">Technical · </span>{data.skills.technical.join(', ')}</div>}
            {data.skills.tools.length > 0 && <div><span className="text-gray-500">Tools · </span>{data.skills.tools.join(', ')}</div>}
            {data.skills.soft.length > 0 && <div><span className="text-gray-500">Soft · </span>{data.skills.soft.join(', ')}</div>}
          </div></section> : null;
          case 'projects': return data.projects.length ? <section key={sec}>{heading('Projects')}<div className="space-y-2">{data.projects.map((p, i) => (
            <div key={i}>
              <div className="text-[12px] font-semibold">{p.name}</div>
              {p.description && <p className="text-[11px] text-gray-700">{p.description}</p>}
              {p.tech.length > 0 && <div className="text-[10.5px] text-gray-500">{p.tech.join(' · ')}</div>}
            </div>))}</div></section> : null;
          case 'certifications': return data.certifications.length ? <section key={sec}>{heading('Certifications')}<ul className="text-[11.5px] text-gray-700 space-y-0.5">{data.certifications.map((c, i) => <li key={i}>{c.name}{c.issuer && ` · ${c.issuer}`}{c.year && ` · ${c.year}`}</li>)}</ul></section> : null;
          case 'awards': return data.awards.length ? <section key={sec}>{heading('Awards')}<ul className="text-[11.5px] text-gray-700 space-y-0.5">{data.awards.map((a, i) => <li key={i}>{a.title}{a.issuer && ` · ${a.issuer}`}{a.year && ` · ${a.year}`}</li>)}</ul></section> : null;
          case 'languages': return data.languages.length ? <section key={sec}>{heading('Languages')}<div className="text-[11.5px] text-gray-700">{data.languages.map((l, i) => <span key={i}>{i > 0 && ' · '}{l.name}{l.level ? ` (${l.level})` : ''}</span>)}</div></section> : null;
          default: return null;
        }
      })}
    </div>
  );
}

/* ─────────────────────────── Resume Quality scorer ─────────────────────────── */

function computeQuality(d: ResumeData): { score: number; tips: string[] } {
  const tips: string[] = [];
  let score = 0;
  // Contact 15
  const contactFields = [d.personal.name, d.personal.email, d.personal.phone, d.personal.location].filter(Boolean).length;
  score += Math.round((contactFields / 4) * 15);
  if (!d.personal.email) tips.push('Add an email address.');
  if (!d.personal.phone) tips.push('Add a phone number.');
  // Summary 10
  if (d.summary && d.summary.length >= 80) score += 10;
  else if (d.summary) score += 5;
  else tips.push('Write a 2–3 line summary at the top.');
  // Experience 30
  if (d.experience.length > 0) {
    score += Math.min(15, d.experience.length * 5);
    const bulletsTotal = d.experience.reduce((s, e) => s + e.bullets.length, 0);
    score += Math.min(15, bulletsTotal * 2);
    if (bulletsTotal < 3) tips.push('Add bullet points to your experience — quantify impact where possible.');
  } else tips.push('Add at least one experience or project entry.');
  // Skills 15
  const skillTotal = d.skills.technical.length + d.skills.tools.length + d.skills.soft.length;
  score += Math.min(15, skillTotal);
  if (skillTotal < 5) tips.push('Add at least 5 skills across technical / tools / soft.');
  // Education 10
  if (d.education.length > 0) score += 10;
  else tips.push('Add your education.');
  // Projects / Certs 10
  if (d.projects.length > 0) score += 5;
  if (d.certifications.length > 0) score += 5;
  if (!d.projects.length && !d.certifications.length) tips.push('Add a project or certification to differentiate.');
  // Length 10 (heuristic)
  const totalChars = (d.summary?.length || 0) + d.experience.reduce((s, e) => s + e.bullets.join(' ').length, 0);
  if (totalChars >= 600) score += 10; else if (totalChars >= 300) score += 6;
  if (totalChars < 300) tips.push('Resume content looks thin — expand experience descriptions.');
  return { score: Math.min(100, score), tips: tips.slice(0, 5) };
}

/* ─────────────────────────── Main ─────────────────────────── */

export default function ResumeStudio({ profile, userId }: { profile: any; userId: string }) {
  const [data, setData] = useState<ResumeData>(() => loadResume(userId, profile));
  const [openSection, setOpenSection] = useState<SectionKey | 'personal' | 'design' | null>('personal');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Re-hydrate when the user identity changes (prevents cross-user bleed of in-memory state into another user's storage key).
  const lastUserRef = useRef<string>(userId);
  useEffect(() => {
    if (lastUserRef.current !== userId) {
      lastUserRef.current = userId;
      setData(loadResume(userId, profile));
      setSavedAt(null);
    }
  }, [userId, profile]);

  // Autosave (debounced) — guarded so we never write before the user-switch rehydrate runs.
  useEffect(() => {
    if (lastUserRef.current !== userId) return;
    const t = setTimeout(() => { saveResume(userId, data); setSavedAt(Date.now()); }, 600);
    return () => clearTimeout(t);
  }, [data, userId]);

  const update = useCallback(<K extends keyof ResumeData>(key: K, value: ResumeData[K]) => {
    setData(d => ({ ...d, [key]: value }));
  }, []);

  const moveSection = (idx: number, dir: -1 | 1) => {
    setData(d => {
      const next = [...d.sectionOrder];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return d;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...d, sectionOrder: next };
    });
  };
  const toggleVisible = (k: SectionKey) => {
    setData(d => ({ ...d, hiddenSections: d.hiddenSections.includes(k) ? d.hiddenSections.filter(x => x !== k) : [...d.hiddenSections, k] }));
  };

  const quality = useMemo(() => computeQuality(data), [data]);

  const downloadPDF = async () => {
    if (!previewRef.current || typeof window === 'undefined') return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, html2canvas] = await Promise.all([
        import('jspdf'),
        import('html2canvas').then(m => m.default),
      ]);
      const sourceCanvas = await html2canvas(previewRef.current as HTMLElement, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
      });
      const fmt = (data.pageSize || 'a4') === 'letter' ? 'letter' : 'a4';
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: fmt });
      const pageWmm = PAGE_SIZES[(data.pageSize || 'a4') as PageSizeId].wMM;
      const pageHmm = PAGE_SIZES[(data.pageSize || 'a4') as PageSizeId].hMM;
      // Map page height in pixels at the source canvas scale.
      const pageHpx = Math.floor((pageHmm * sourceCanvas.width) / pageWmm);
      const totalPx = sourceCanvas.height;
      let renderedPx = 0;
      let pageIndex = 0;
      // Slice the source canvas into A4-height tiles and add each tile as its own page.
      // This avoids the "full-image with negative Y offset" trick that can produce duplicate or near-blank tail pages.
      while (renderedPx < totalPx - 1) {
        const sliceHpx = Math.min(pageHpx, totalPx - renderedPx);
        const slice = document.createElement('canvas');
        slice.width = sourceCanvas.width;
        slice.height = sliceHpx;
        const ctx = slice.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(sourceCanvas, 0, renderedPx, slice.width, sliceHpx, 0, 0, slice.width, sliceHpx);
        const sliceHmm = (sliceHpx * pageWmm) / sourceCanvas.width;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, pageWmm, sliceHmm);
        renderedPx += sliceHpx;
        pageIndex += 1;
        // Safety guard against any pathological loop.
        if (pageIndex > 20) break;
      }
      const name = (data.personal.name || 'resume').replace(/\s+/g, '_');
      pdf.save(`${name}.pdf`);
    } catch (e) {
      console.error(e);
      if (typeof window !== 'undefined') {
        window.alert('PDF export failed. You can also use Ctrl/Cmd + P → Save as PDF.');
      }
    } finally { setExporting(false); }
  };

  const resetFromProfile = () => {
    if (typeof window !== 'undefined' && !window.confirm('Reset resume from your profile? Your edits in Resume Studio will be lost.')) return;
    const fresh = seedFromProfile(profile);
    setData(fresh);
    saveResume(userId, fresh);
  };

  const fontFamilyValue = useMemo(() => FONT_FAMILIES.find(f => f.id === (data.fontFamilyId || 'inter'))?.value, [data.fontFamilyId]);
  const pageMeta = PAGE_SIZES[(data.pageSize || 'a4') as PageSizeId];
  const fontScale = data.fontScale ?? 1;

  const renderPreview = () => {
    const newRenderer = NEW_TEMPLATE_RENDERERS[data.template];
    if (newRenderer) {
      const props: NewTemplateProps = {
        data: data as any,
        fontFamily: fontFamilyValue || "'Inter', sans-serif",
        fontScale,
        pageHmm: pageMeta.hMM,
      };
      return newRenderer(props);
    }
    // Legacy templates: apply fontScale via CSS zoom on a wrapper (preserves layout geometry while
    // scaling typography uniformly, since legacy templates use hard-coded tailwind text-[Xpx]).
    const Inner = data.template === 'classic'
      ? <ClassicPreview data={data} fontFamily={fontFamilyValue} pageHmm={pageMeta.hMM}/>
      : data.template === 'minimal'
        ? <MinimalPreview data={data} fontFamily={fontFamilyValue} pageHmm={pageMeta.hMM}/>
        : <ModernSidebarPreview data={data} fontFamily={fontFamilyValue} pageHmm={pageMeta.hMM}/>;
    return fontScale !== 1
      ? <div style={{ zoom: fontScale as any }}>{Inner}</div>
      : Inner;
  };

  // Build a flat text blob for ATS scoring.
  const resumeText = useMemo(() => {
    return [
      data.personal.name, data.personal.title, data.summary,
      ...data.experience.flatMap(e => [e.role, e.company, e.location, ...e.bullets]),
      ...data.education.flatMap(e => [e.institution, e.degree, e.field]),
      ...data.skills.technical, ...data.skills.tools, ...data.skills.soft,
      ...data.projects.flatMap(p => [p.name, p.description, ...p.tech]),
      ...data.certifications.flatMap(c => [c.name, c.issuer]),
      ...data.awards.flatMap(a => [a.title, a.issuer]),
    ].filter(Boolean).join(' ');
  }, [data]);

  const [mode, setMode] = useState<'resume' | 'cover-letter'>('resume');
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [zoom, setZoom] = useState<'fit' | number>('fit');

  // Measure preview viewport so we can auto-fit the A4 page width.
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportW, setViewportW] = useState(0);
  useEffect(() => {
    const el = previewViewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      setViewportW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, editorCollapsed]);

  // Measure UNSCALED preview content height (template-dependent) so the scaled wrapper reserves correct space.
  // Use offsetHeight (transform-unaware) — getBoundingClientRect() would return the already-scaled height
  // because previewRef sits inside the transformed wrapper, causing a double-scale layout bug.
  const [contentH, setContentH] = useState(0);
  useEffect(() => {
    const el = previewRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setContentH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [data.template, mode]);

  const PX_PER_MM = 3.7795275591;
  const nativeWpx = pageMeta.wMM * PX_PER_MM;
  const fitScale = viewportW > 0 ? Math.min(1.25, Math.max(0.45, (viewportW - 32) / nativeWpx)) : 1;
  const previewScale = zoom === 'fit' ? fitScale : zoom;
  const zoomPct = Math.round(previewScale * 100);

  const downloadDOCX = () => {
    if (!previewRef.current || typeof window === 'undefined') return;
    try {
      const html = previewRef.current.outerHTML;
      const wrapper = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${data.personal.name || 'resume'}</title><style>body{font-family:${fontFamilyValue || 'Calibri,sans-serif'};} *{box-sizing:border-box}</style></head><body>${html}</body></html>`;
      const blob = new Blob(['\ufeff', wrapper], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(data.personal.name || 'resume').replace(/\s+/g, '_')}.doc`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      window.alert('DOCX export failed.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Resume Studio</h1>
          <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
            Edit, design, and export a polished PDF.
            {savedAt && <span className="text-[10px] text-green-600 flex items-center gap-0.5"><Check size={10}/>Saved</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
            <button onClick={() => setMode('resume')}
              className={`text-[11px] px-3 py-1.5 rounded-lg font-medium ${mode === 'resume' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
              Resume
            </button>
            <button onClick={() => setMode('cover-letter')}
              className={`text-[11px] px-3 py-1.5 rounded-lg font-medium ${mode === 'cover-letter' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
              Cover Letter
            </button>
          </div>
          {mode === 'resume' && <>
            <button onClick={resetFromProfile}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-300 text-gray-600">
              <RefreshCw size={12}/> Reset from profile
            </button>
            <button onClick={downloadDOCX}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-300 text-gray-700">
              <FileDown size={12}/> Word (.doc)
            </button>
            <button onClick={downloadPDF} disabled={exporting}
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm disabled:opacity-60"
              style={{ backgroundColor: BRAND.primary }}>
              <Download size={13}/> {exporting ? 'Generating…' : 'Download PDF'}
            </button>
          </>}
        </div>
      </div>

      {mode === 'cover-letter' && (
        <CoverLetterStudio userId={userId}
          personal={{ name: data.personal.name, email: data.personal.email, phone: data.personal.phone, location: data.personal.location, linkedin: data.personal.linkedin }}
          fontFamily={fontFamilyValue || "'Inter', sans-serif"}
          accent={data.accentColor || BRAND.primary}/>
      )}
      {mode === 'cover-letter' ? null : (

      <div className={`grid grid-cols-1 gap-4 ${editorCollapsed ? '' : 'lg:grid-cols-[360px_1fr]'}`}>
        {/* ─── EDITOR ─── */}
        {/* Collapse only on lg+ — mobile/tablet always see the editor since the focus toggle isn't reachable below lg. */}
        <div className={`space-y-2.5 ${editorCollapsed ? 'lg:hidden' : ''}`}>
          {/* Quality card */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2"><Sparkles size={13} style={{ color: BRAND.primary }}/>
                <span className="text-xs font-semibold text-gray-800">Resume quality</span>
              </div>
              <span className="text-xs font-bold" style={{ color: quality.score >= 70 ? BRAND.green : quality.score >= 40 ? BRAND.primary : '#f4a261' }}>{quality.score}/100</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all" style={{ width: `${quality.score}%`, backgroundColor: quality.score >= 70 ? BRAND.green : quality.score >= 40 ? BRAND.primary : '#f4a261' }}/>
            </div>
            {quality.tips.length > 0 && (
              <ul className="space-y-0.5 mt-1">
                {quality.tips.map((t, i) => <li key={i} className="text-[10.5px] text-gray-600 flex gap-1"><span className="text-gray-400">•</span>{t}</li>)}
              </ul>)}
          </div>

          {/* Design panel */}
          <div className={`rounded-xl border ${openSection === 'design' ? 'border-gray-200 bg-white' : 'border-gray-200 bg-white'}`}>
            <button onClick={() => setOpenSection(openSection === 'design' ? null : 'design')} className="w-full flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold text-gray-800 flex items-center gap-2"><Sparkles size={13} style={{ color: BRAND.primary }}/>Design & Template</span>
              {openSection === 'design' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            {openSection === 'design' && (
              <div className="px-3 pb-3 space-y-3.5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5 flex items-center gap-1"><Layout size={10}/>Template</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => update('template', t.id)} title={t.desc}
                        className={`text-[10px] px-1.5 py-2 rounded-lg border text-center leading-tight ${data.template === t.id ? 'border-gray-800 text-gray-900 font-semibold bg-gray-50' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {t.label}
                      </button>))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5 flex items-center gap-1"><Palette size={10}/>Theme presets</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {THEME_PRESETS.map(th => (
                      <button key={th.id} title={th.name} onClick={() => { update('themeId', th.id); update('accentColor', th.primary); }}
                        className={`flex flex-col items-center justify-center rounded-lg border px-1 py-1.5 ${data.themeId === th.id ? 'border-gray-800' : 'border-gray-200'}`}>
                        <div className="flex gap-0.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: th.primary }}/><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: th.secondary }}/></div>
                        <span className="text-[9px] text-gray-600 mt-1">{th.name}</span>
                      </button>))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Accent color</div>
                  <div className="flex gap-2 flex-wrap">
                    {['#344E86', '#4ECDC4', '#2A9D8F', '#e63946', '#f4a261', '#7c3aed', '#0ea5e9', '#111827', '#be185d', '#0F766E'].map(c => (
                      <button key={c} onClick={() => update('accentColor', c)}
                        className={`w-6 h-6 rounded-full border-2 ${data.accentColor === c ? 'border-gray-900' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} title={c}/>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5 flex items-center gap-1"><Type size={10}/>Font family</div>
                  <select value={data.fontFamilyId || 'inter'} onChange={e => update('fontFamilyId', e.target.value as FontFamilyId)} className={inputCls}>
                    {FONT_FAMILIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Text size</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: 0.9, label: 'Compact' },
                      { id: 1.0, label: 'Default' },
                      { id: 1.1, label: 'Spacious' },
                    ] as const).map(s => (
                      <button key={s.id} onClick={() => update('fontScale', s.id)}
                        className={`text-[10.5px] px-2 py-1.5 rounded-lg border ${(data.fontScale ?? 1) === s.id ? 'border-gray-800 text-gray-900 font-semibold' : 'border-gray-200 text-gray-600'}`}>
                        {s.label}
                      </button>))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Page size</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['a4', 'letter'] as PageSizeId[]).map(p => (
                      <button key={p} onClick={() => update('pageSize', p)}
                        className={`text-[10.5px] px-2 py-1.5 rounded-lg border ${(data.pageSize || 'a4') === p ? 'border-gray-800 text-gray-900 font-semibold' : 'border-gray-200 text-gray-600'}`}>
                        {PAGE_SIZES[p].label}
                      </button>))}
                  </div>
                </div>
              </div>)}
          </div>

          {/* ATS check panel */}
          <ATSCheckPanel resumeText={resumeText}/>

          {/* Personal */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <button onClick={() => setOpenSection(openSection === 'personal' ? null : 'personal')} className="w-full flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold text-gray-800 flex items-center gap-2"><User size={13} style={{ color: BRAND.primary }}/>Personal info</span>
              {openSection === 'personal' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            {openSection === 'personal' && (
              <div className="px-3 pb-3 grid grid-cols-2 gap-2.5">
                <div className="col-span-2"><TextField label="Full name" value={data.personal.name} onChange={v => update('personal', { ...data.personal, name: v })}/></div>
                <div className="col-span-2"><TextField label="Headline / Title" value={data.personal.title} onChange={v => update('personal', { ...data.personal, title: v })} placeholder="e.g. Startup Founder"/></div>
                <TextField label="Email" value={data.personal.email} onChange={v => update('personal', { ...data.personal, email: v })} icon={<Mail size={9}/>}/>
                <TextField label="Phone" value={data.personal.phone} onChange={v => update('personal', { ...data.personal, phone: v })} icon={<Phone size={9}/>}/>
                <TextField label="Location" value={data.personal.location} onChange={v => update('personal', { ...data.personal, location: v })} icon={<MapPin size={9}/>}/>
                <TextField label="LinkedIn" value={data.personal.linkedin} onChange={v => update('personal', { ...data.personal, linkedin: v })} icon={<Linkedin size={9}/>}/>
                <TextField label="GitHub" value={data.personal.github} onChange={v => update('personal', { ...data.personal, github: v })} icon={<Github size={9}/>}/>
                <TextField label="Website" value={data.personal.website} onChange={v => update('personal', { ...data.personal, website: v })} icon={<Globe size={9}/>}/>
              </div>)}
          </div>

          {/* Dynamic sections in order */}
          {data.sectionOrder.map((k, idx) => {
            const isOpen = openSection === k;
            const hidden = data.hiddenSections.includes(k);
            const count =
              k === 'experience' ? data.experience.length :
              k === 'education' ? data.education.length :
              k === 'projects' ? data.projects.length :
              k === 'certifications' ? data.certifications.length :
              k === 'awards' ? data.awards.length :
              k === 'languages' ? data.languages.length :
              k === 'skills' ? data.skills.technical.length + data.skills.tools.length + data.skills.soft.length :
              undefined;
            return (
              <SectionPanel key={k} k={k} open={isOpen} onToggle={() => setOpenSection(isOpen ? null : k)}
                hidden={hidden} onToggleVisible={() => toggleVisible(k)}
                onMoveUp={idx > 0 ? () => moveSection(idx, -1) : undefined}
                onMoveDown={idx < data.sectionOrder.length - 1 ? () => moveSection(idx, 1) : undefined}
                count={count}>
                {k === 'summary' && (
                  <TextArea value={data.summary} onChange={v => update('summary', v)} rows={5}
                    placeholder="A 2–3 line professional summary highlighting your experience, expertise and what you bring."/>
                )}
                {k === 'experience' && (
                  <ExperienceEditor items={data.experience} onChange={v => update('experience', v)}/>
                )}
                {k === 'education' && (
                  <EducationEditor items={data.education} onChange={v => update('education', v)}/>
                )}
                {k === 'skills' && (
                  <div className="space-y-3">
                    <div><div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Technical</div>
                      <TagList items={data.skills.technical} placeholder="e.g. Python, React" color={BRAND.accent}
                        onChange={v => update('skills', { ...data.skills, technical: v })}/></div>
                    <div><div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Tools</div>
                      <TagList items={data.skills.tools} placeholder="e.g. Figma, Jira, AWS" color="#8b5cf6"
                        onChange={v => update('skills', { ...data.skills, tools: v })}/></div>
                    <div><div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Soft</div>
                      <TagList items={data.skills.soft} placeholder="e.g. Communication, Ownership" color={BRAND.green}
                        onChange={v => update('skills', { ...data.skills, soft: v })}/></div>
                  </div>
                )}
                {k === 'projects' && (
                  <ProjectsEditor items={data.projects} onChange={v => update('projects', v)}/>
                )}
                {k === 'certifications' && (
                  <CertsEditor items={data.certifications} onChange={v => update('certifications', v)}/>
                )}
                {k === 'awards' && (
                  <AwardsEditor items={data.awards} onChange={v => update('awards', v)}/>
                )}
                {k === 'languages' && (
                  <LanguagesEditor items={data.languages} onChange={v => update('languages', v)}/>
                )}
              </SectionPanel>
            );
          })}
        </div>

        {/* ─── PREVIEW ─── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
              <Eye size={11}/> Live preview · {pageMeta.label}
            </div>
            <span className="text-[10px] text-gray-400 normal-case tracking-normal">
              {TEMPLATES.find(t => t.id === data.template)?.label || data.template} template
            </span>
            <div className="ml-auto flex items-center gap-1">
              {/* Zoom controls */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setZoom(z => typeof z === 'number' ? Math.max(0.5, +(z - 0.1).toFixed(2)) : Math.max(0.5, +(fitScale - 0.1).toFixed(2)))}
                  className="text-[11px] px-1.5 py-0.5 rounded text-gray-600 hover:text-gray-900" title="Zoom out" aria-label="Zoom out">−</button>
                <button onClick={() => setZoom('fit')}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium ${zoom === 'fit' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                  title="Fit to width">Fit · {zoomPct}%</button>
                <button onClick={() => setZoom(1)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium ${zoom === 1 ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                  title="Actual size">100%</button>
                <button onClick={() => setZoom(z => typeof z === 'number' ? Math.min(1.25, +(z + 0.1).toFixed(2)) : Math.min(1.25, +(fitScale + 0.1).toFixed(2)))}
                  className="text-[11px] px-1.5 py-0.5 rounded text-gray-600 hover:text-gray-900" title="Zoom in" aria-label="Zoom in">+</button>
              </div>
              {/* Focus / collapse editor */}
              <button onClick={() => setEditorCollapsed(c => !c)}
                className="hidden lg:flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400"
                title={editorCollapsed ? 'Show editor panel' : 'Hide editor — preview full width'}>
                {editorCollapsed ? '◧ Show editor' : '◨ Focus preview'}
              </button>
            </div>
          </div>
          <div ref={previewViewportRef}
            className="overflow-auto rounded-xl border border-gray-200 shadow-lg bg-gray-100 p-4"
            style={{ maxHeight: 'calc(100vh - 180px)' }}>
            {/* Scaled placeholder: outer reserves layout space (nativeWpx × contentH × scale).
                Inner is transformed visually but previewRef stays at native mm so html2canvas captures full-quality. */}
            <div className="mx-auto" style={{
              width: `${nativeWpx * previewScale}px`,
              height: contentH > 0 ? `${contentH * previewScale}px` : undefined,
              position: 'relative',
            }}>
              <div style={{
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
                width: `${pageMeta.wMM}mm`,
                position: contentH > 0 ? 'absolute' : 'static',
                top: 0, left: 0,
              }}>
                <div ref={previewRef} className="bg-white shadow-md" style={{ width: `${pageMeta.wMM}mm` }}>
                  {renderPreview()}
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-400">PDF is generated at native A4/Letter resolution — zoom only affects on-screen preview.</p>
        </div>
      </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Sub-editors ─────────────────────────── */

function ItemCard({ children, onDelete, onMoveUp, onMoveDown }: { children: React.ReactNode; onDelete: () => void; onMoveUp?: () => void; onMoveDown?: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-2.5 space-y-2">
      <div className="flex items-center gap-1 justify-end">
        {onMoveUp && <button onClick={onMoveUp} className="text-gray-400 hover:text-gray-600"><ArrowUp size={11}/></button>}
        {onMoveDown && <button onClick={onMoveDown} className="text-gray-400 hover:text-gray-600"><ArrowDown size={11}/></button>}
        <button onClick={onDelete} className="text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
      </div>
      {children}
    </div>
  );
}

function ExperienceEditor({ items, onChange }: { items: ExpItem[]; onChange: (v: ExpItem[]) => void }) {
  /* eslint-disable @typescript-eslint/no-use-before-define */
  const upd = (i: number, patch: Partial<ExpItem>) => onChange(items.map((e, j) => j === i ? { ...e, ...patch } : e));
  const move = (i: number, d: -1 | 1) => { const n = [...items]; const k = i + d; if (k < 0 || k >= n.length) return; [n[i], n[k]] = [n[k], n[i]]; onChange(n); };
  return (
    <div className="space-y-2">
      {items.map((e, i) => (
        <ItemCard key={i} onDelete={() => onChange(items.filter((_, j) => j !== i))}
          onMoveUp={i > 0 ? () => move(i, -1) : undefined}
          onMoveDown={i < items.length - 1 ? () => move(i, 1) : undefined}>
          <TextField label="Role / Title" value={e.role} onChange={v => upd(i, { role: v })}/>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Company" value={e.company} onChange={v => upd(i, { company: v })}/>
            <TextField label="Location" value={e.location} onChange={v => upd(i, { location: v })}/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Start (MM/YYYY)" value={e.startDate} onChange={v => upd(i, { startDate: v })} placeholder="01/2023"/>
            <TextField label="End" value={e.endDate} onChange={v => upd(i, { endDate: v })} placeholder="Present"/>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <input type="checkbox" checked={e.isCurrent} onChange={ev => upd(i, { isCurrent: ev.target.checked })}/> Currently working here
          </label>
          <BulletEditor roleHint={e.role} bullets={e.bullets} onChange={b => upd(i, { bullets: b })}/>
        </ItemCard>))}
      <button onClick={() => onChange([...items, { role: '', company: '', location: '', startDate: '', endDate: '', isCurrent: false, bullets: [] }])}
        className="w-full text-[11px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 flex items-center justify-center gap-1 hover:border-gray-400">
        <Plus size={11}/> Add experience
      </button>
    </div>
  );
}

function BulletEditor({ bullets, onChange, roleHint }: { bullets: string[]; onChange: (b: string[]) => void; roleHint?: string }) {
  const [draft, setDraft] = useState('');
  const [picker, setPicker] = useState(false);
  const add = () => { const v = draft.trim(); if (!v) return; onChange([...bullets, v]); setDraft(''); };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Bullets / Highlights</span>
        <button onClick={() => setPicker(true)} className="text-[10px] px-1.5 py-0.5 rounded-md border border-gray-200 text-gray-600 hover:border-gray-400 flex items-center gap-1">
          <Wand2 size={10} style={{ color: BRAND.primary }}/> AI suggest
        </button>
      </div>
      <div className="space-y-1.5">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="text-gray-400 text-[11px] mt-1.5">•</span>
            <textarea className={inputCls + ' resize-y leading-relaxed'} rows={2} value={b} spellCheck
              onChange={e => onChange(bullets.map((x, j) => j === i ? e.target.value : x))}/>
            <button onClick={() => onChange(bullets.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 mt-1.5"><X size={11}/></button>
          </div>))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        <input className={inputCls} value={draft} onChange={e => setDraft(e.target.value)} spellCheck
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Quantified achievement, e.g. Reduced churn by 18%…"/>
        <button onClick={add} className="text-[11px] px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>Add</button>
      </div>
      {picker && <AIBulletPicker roleHint={roleHint || ''} onClose={() => setPicker(false)} onPick={(b) => { onChange([...bullets, b]); setPicker(false); }}/>}
    </div>
  );
}

function EducationEditor({ items, onChange }: { items: EduItem[]; onChange: (v: EduItem[]) => void }) {
  const upd = (i: number, patch: Partial<EduItem>) => onChange(items.map((e, j) => j === i ? { ...e, ...patch } : e));
  const move = (i: number, d: -1 | 1) => { const n = [...items]; const k = i + d; if (k < 0 || k >= n.length) return; [n[i], n[k]] = [n[k], n[i]]; onChange(n); };
  return (
    <div className="space-y-2">
      {items.map((e, i) => (
        <ItemCard key={i} onDelete={() => onChange(items.filter((_, j) => j !== i))}
          onMoveUp={i > 0 ? () => move(i, -1) : undefined}
          onMoveDown={i < items.length - 1 ? () => move(i, 1) : undefined}>
          <TextField label="Institution" value={e.institution} onChange={v => upd(i, { institution: v })}/>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Degree" value={e.degree} onChange={v => upd(i, { degree: v })} placeholder="B.Tech"/>
            <TextField label="Field" value={e.field} onChange={v => upd(i, { field: v })} placeholder="Computer Science"/>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <TextField label="Start year" value={e.startYear} onChange={v => upd(i, { startYear: v })}/>
            <TextField label="End year" value={e.endYear} onChange={v => upd(i, { endYear: v })}/>
            <TextField label="Grade" value={e.grade} onChange={v => upd(i, { grade: v })} placeholder="8.5 CGPA"/>
          </div>
        </ItemCard>))}
      <button onClick={() => onChange([...items, { institution: '', degree: '', field: '', grade: '', startYear: '', endYear: '' }])}
        className="w-full text-[11px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 flex items-center justify-center gap-1 hover:border-gray-400">
        <Plus size={11}/> Add education
      </button>
    </div>
  );
}

function ProjectsEditor({ items, onChange }: { items: ProjItem[]; onChange: (v: ProjItem[]) => void }) {
  const upd = (i: number, patch: Partial<ProjItem>) => onChange(items.map((p, j) => j === i ? { ...p, ...patch } : p));
  return (
    <div className="space-y-2">
      {items.map((p, i) => (
        <ItemCard key={i} onDelete={() => onChange(items.filter((_, j) => j !== i))}>
          <TextField label="Name" value={p.name} onChange={v => upd(i, { name: v })}/>
          <TextArea label="Description" value={p.description} onChange={v => upd(i, { description: v })} rows={2}/>
          <TextField label="Link" value={p.link} onChange={v => upd(i, { link: v })} placeholder="https://…"/>
          <div><div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Tech stack</div>
            <TagList items={p.tech} placeholder="e.g. React" onChange={v => upd(i, { tech: v })}/></div>
        </ItemCard>))}
      <button onClick={() => onChange([...items, { name: '', description: '', tech: [], link: '' }])}
        className="w-full text-[11px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 flex items-center justify-center gap-1 hover:border-gray-400">
        <Plus size={11}/> Add project
      </button>
    </div>
  );
}

function CertsEditor({ items, onChange }: { items: CertItem[]; onChange: (v: CertItem[]) => void }) {
  const upd = (i: number, patch: Partial<CertItem>) => onChange(items.map((c, j) => j === i ? { ...c, ...patch } : c));
  return (
    <div className="space-y-2">
      {items.map((c, i) => (
        <ItemCard key={i} onDelete={() => onChange(items.filter((_, j) => j !== i))}>
          <TextField label="Certification name" value={c.name} onChange={v => upd(i, { name: v })}/>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Issuer" value={c.issuer} onChange={v => upd(i, { issuer: v })}/>
            <TextField label="Year" value={c.year} onChange={v => upd(i, { year: v })}/>
          </div>
          <TextField label="Credential link" value={c.link} onChange={v => upd(i, { link: v })} placeholder="https://…"/>
        </ItemCard>))}
      <button onClick={() => onChange([...items, { name: '', issuer: '', year: '', link: '' }])}
        className="w-full text-[11px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 flex items-center justify-center gap-1 hover:border-gray-400">
        <Plus size={11}/> Add certification
      </button>
    </div>
  );
}

function AwardsEditor({ items, onChange }: { items: AwardItem[]; onChange: (v: AwardItem[]) => void }) {
  const upd = (i: number, patch: Partial<AwardItem>) => onChange(items.map((a, j) => j === i ? { ...a, ...patch } : a));
  return (
    <div className="space-y-2">
      {items.map((a, i) => (
        <ItemCard key={i} onDelete={() => onChange(items.filter((_, j) => j !== i))}>
          <TextField label="Title" value={a.title} onChange={v => upd(i, { title: v })}/>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Issuer" value={a.issuer} onChange={v => upd(i, { issuer: v })}/>
            <TextField label="Year" value={a.year} onChange={v => upd(i, { year: v })}/>
          </div>
        </ItemCard>))}
      <button onClick={() => onChange([...items, { title: '', issuer: '', year: '' }])}
        className="w-full text-[11px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 flex items-center justify-center gap-1 hover:border-gray-400">
        <Plus size={11}/> Add award
      </button>
    </div>
  );
}

function LanguagesEditor({ items, onChange }: { items: LanguageItem[]; onChange: (v: LanguageItem[]) => void }) {
  const upd = (i: number, patch: Partial<LanguageItem>) => onChange(items.map((l, j) => j === i ? { ...l, ...patch } : l));
  return (
    <div className="space-y-2">
      {items.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={inputCls} placeholder="Language" value={l.name} onChange={e => upd(i, { name: e.target.value })}/>
          <select className={inputCls + ' max-w-[140px]'} value={l.level} onChange={e => upd(i, { level: e.target.value })}>
            <option value="">Level</option>
            <option>Native</option><option>Fluent</option><option>Professional</option><option>Conversational</option><option>Basic</option>
          </select>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X size={12}/></button>
        </div>))}
      <button onClick={() => onChange([...items, { name: '', level: '' }])}
        className="w-full text-[11px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 flex items-center justify-center gap-1 hover:border-gray-400">
        <Plus size={11}/> Add language
      </button>
    </div>
  );
}
