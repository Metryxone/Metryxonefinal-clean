import React from 'react';
import { Mail, Phone, MapPin, Linkedin, Github, Globe } from 'lucide-react';

/* Structural type — kept loose on purpose so this file does not import ResumeStudio. */
export type AnyResume = {
  personal: { name: string; title: string; email: string; phone: string; location: string; linkedin: string; github: string; website: string };
  summary: string;
  experience: Array<{ role: string; company: string; location: string; startDate: string; endDate: string; isCurrent: boolean; bullets: string[] }>;
  education: Array<{ institution: string; degree: string; field: string; grade: string; startYear: string; endYear: string }>;
  skills: { technical: string[]; tools: string[]; soft: string[] };
  projects: Array<{ name: string; description: string; tech: string[]; link: string }>;
  certifications: Array<{ name: string; issuer: string; year: string; link: string }>;
  awards: Array<{ title: string; issuer: string; year: string }>;
  languages: Array<{ name: string; level: string }>;
  sectionOrder: string[];
  hiddenSections: string[];
  accentColor: string;
};

export type TemplateProps = {
  data: AnyResume;
  fontFamily: string;
  fontScale: number; // 0.9, 1.0, 1.1
  pageHmm: number;
};

const has = (d: AnyResume, k: string) => !d.hiddenSections.includes(k);

const fs = (px: number, s: number) => `${px * s}px`;

/* ─────────────────────────── EXECUTIVE ─────────────────────────── */
export function ExecutivePreview({ data, fontFamily, fontScale, pageHmm }: TemplateProps) {
  const accent = data.accentColor || '#0f172a';
  return (
    <div className="bg-white text-gray-900 px-12 py-10 space-y-5" style={{ fontFamily, minHeight: `${pageHmm}mm` }}>
      <header className="pb-4 border-b-4" style={{ borderColor: accent }}>
        <h1 className="font-bold uppercase tracking-[0.18em]" style={{ fontSize: fs(22, fontScale), color: accent }}>{data.personal.name || 'Your Name'}</h1>
        {data.personal.title && <div className="uppercase tracking-[0.32em] text-gray-600 mt-1" style={{ fontSize: fs(10, fontScale) }}>{data.personal.title}</div>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-gray-700" style={{ fontSize: fs(10.5, fontScale) }}>
          {data.personal.email    && <span>{data.personal.email}</span>}
          {data.personal.phone    && <span>{data.personal.phone}</span>}
          {data.personal.location && <span>{data.personal.location}</span>}
          {data.personal.linkedin && <span>{data.personal.linkedin}</span>}
        </div>
      </header>
      {data.sectionOrder.map(sec => {
        if (!has(data, sec)) return null;
        const H = (l: string) => <div className="uppercase tracking-[0.22em] font-bold mb-2" style={{ color: accent, fontSize: fs(11, fontScale) }}>{l}</div>;
        switch (sec) {
          case 'summary': return data.summary ? <section key={sec}>{H('Executive Summary')}<p className="leading-relaxed" style={{ fontSize: fs(12, fontScale) }}>{data.summary}</p></section> : null;
          case 'experience': return data.experience.length ? <section key={sec}>{H('Professional Experience')}<div className="space-y-3.5">{data.experience.map((e, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline">
                <div className="font-bold uppercase tracking-wide" style={{ fontSize: fs(12, fontScale) }}>{e.role}</div>
                <div className="text-gray-600" style={{ fontSize: fs(10.5, fontScale) }}>{e.startDate} – {e.isCurrent ? 'Present' : e.endDate}</div>
              </div>
              <div className="italic text-gray-700" style={{ fontSize: fs(11, fontScale) }}>{[e.company, e.location].filter(Boolean).join(' · ')}</div>
              {e.bullets.length > 0 && <ul className="mt-1.5 ml-4 list-disc space-y-0.5">{e.bullets.map((b, j) => <li key={j} className="leading-relaxed" style={{ fontSize: fs(11.5, fontScale) }}>{b}</li>)}</ul>}
            </div>))}</div></section> : null;
          case 'education': return data.education.length ? <section key={sec}>{H('Education')}<div className="space-y-1.5">{data.education.map((ed, i) => (
            <div key={i} className="flex justify-between items-baseline">
              <div><span className="font-bold uppercase tracking-wide" style={{ fontSize: fs(11.5, fontScale) }}>{ed.institution}</span><span className="ml-2" style={{ fontSize: fs(11, fontScale) }}>— {[ed.degree, ed.field].filter(Boolean).join(', ')}</span></div>
              <div className="text-gray-600" style={{ fontSize: fs(10.5, fontScale) }}>{ed.startYear} – {ed.endYear}</div>
            </div>))}</div></section> : null;
          case 'skills': {
            const all = [...data.skills.technical, ...data.skills.tools, ...data.skills.soft];
            return all.length ? <section key={sec}>{H('Core Competencies')}<div className="grid grid-cols-3 gap-x-4 gap-y-0.5">{all.map(s => <div key={s} className="text-gray-700 uppercase tracking-wide" style={{ fontSize: fs(10.5, fontScale) }}>▸ {s}</div>)}</div></section> : null;
          }
          case 'certifications': return data.certifications.length ? <section key={sec}>{H('Credentials')}<ul className="ml-4 list-disc space-y-0.5" style={{ fontSize: fs(11, fontScale) }}>{data.certifications.map((c, i) => <li key={i}><span className="font-semibold">{c.name}</span>{c.issuer && ` — ${c.issuer}`}{c.year && ` (${c.year})`}</li>)}</ul></section> : null;
          case 'awards': return data.awards.length ? <section key={sec}>{H('Recognition')}<ul className="ml-4 list-disc space-y-0.5" style={{ fontSize: fs(11, fontScale) }}>{data.awards.map((a, i) => <li key={i}><span className="font-semibold">{a.title}</span>{a.issuer && ` · ${a.issuer}`}{a.year && ` · ${a.year}`}</li>)}</ul></section> : null;
          default: return null;
        }
      })}
    </div>
  );
}

/* ─────────────────────────── CREATIVE ─────────────────────────── */
export function CreativePreview({ data, fontFamily, fontScale, pageHmm }: TemplateProps) {
  const accent = data.accentColor || '#7c3aed';
  return (
    <div className="bg-white text-gray-900" style={{ fontFamily, minHeight: `${pageHmm}mm` }}>
      <div className="grid grid-cols-[1fr_auto] items-stretch">
        <div className="px-10 py-8">
          <h1 className="font-black leading-none" style={{ fontSize: fs(30, fontScale), color: accent }}>{(data.personal.name || 'Your Name').split(' ')[0]}</h1>
          <h1 className="font-black leading-none text-gray-900" style={{ fontSize: fs(30, fontScale) }}>{(data.personal.name || ' ').split(' ').slice(1).join(' ') || 'Surname'}</h1>
          {data.personal.title && <div className="mt-1 font-medium" style={{ color: accent, fontSize: fs(13, fontScale) }}>{data.personal.title}</div>}
        </div>
        <div className="px-8 py-8 text-white" style={{ backgroundColor: accent }}>
          <div className="space-y-1.5" style={{ fontSize: fs(10.5, fontScale) }}>
            {data.personal.email    && <div className="flex items-center gap-1.5"><Mail size={10}/>{data.personal.email}</div>}
            {data.personal.phone    && <div className="flex items-center gap-1.5"><Phone size={10}/>{data.personal.phone}</div>}
            {data.personal.location && <div className="flex items-center gap-1.5"><MapPin size={10}/>{data.personal.location}</div>}
            {data.personal.linkedin && <div className="flex items-center gap-1.5"><Linkedin size={10}/>{data.personal.linkedin}</div>}
            {data.personal.github   && <div className="flex items-center gap-1.5"><Github size={10}/>{data.personal.github}</div>}
            {data.personal.website  && <div className="flex items-center gap-1.5"><Globe size={10}/>{data.personal.website}</div>}
          </div>
        </div>
      </div>
      <div className="px-10 pb-10 pt-2 space-y-5">
        {data.sectionOrder.map(sec => {
          if (!has(data, sec)) return null;
          const H = (l: string) => (
            <div className="flex items-center gap-2 mb-2"><span className="inline-block h-3 w-1 rounded" style={{ backgroundColor: accent }}/><span className="font-bold uppercase tracking-wide" style={{ color: accent, fontSize: fs(12, fontScale) }}>{l}</span></div>
          );
          switch (sec) {
            case 'summary': return data.summary ? <section key={sec}>{H('Hello')}<p className="leading-relaxed text-gray-700" style={{ fontSize: fs(12, fontScale) }}>{data.summary}</p></section> : null;
            case 'experience': return data.experience.length ? <section key={sec}>{H('Experience')}<div className="space-y-3">{data.experience.map((e, i) => (
              <div key={i}>
                <div className="font-bold text-gray-900" style={{ fontSize: fs(12.5, fontScale) }}>{e.role} <span className="font-normal text-gray-500" style={{ fontSize: fs(11, fontScale) }}>· {e.startDate} – {e.isCurrent ? 'Present' : e.endDate}</span></div>
                <div className="text-gray-600" style={{ fontSize: fs(11, fontScale) }}>{[e.company, e.location].filter(Boolean).join(' · ')}</div>
                {e.bullets.length > 0 && <ul className="mt-1 space-y-0.5">{e.bullets.map((b, j) => <li key={j} className="flex gap-1.5 leading-relaxed text-gray-700" style={{ fontSize: fs(11, fontScale) }}><span style={{ color: accent }}>✦</span>{b}</li>)}</ul>}
              </div>))}</div></section> : null;
            case 'skills': return (data.skills.technical.length || data.skills.tools.length || data.skills.soft.length) ? <section key={sec}>{H('Skills')}<div className="flex flex-wrap gap-1.5">{[...data.skills.technical, ...data.skills.tools, ...data.skills.soft].map(s => (
              <span key={s} className="px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: accent, fontSize: fs(10.5, fontScale) }}>{s}</span>))}</div></section> : null;
            case 'education': return data.education.length ? <section key={sec}>{H('Education')}<div className="space-y-1.5">{data.education.map((ed, i) => (
              <div key={i}><span className="font-semibold" style={{ fontSize: fs(11.5, fontScale) }}>{ed.institution}</span><span className="text-gray-600 ml-1" style={{ fontSize: fs(11, fontScale) }}>· {[ed.degree, ed.field].filter(Boolean).join(', ')} ({ed.startYear}–{ed.endYear})</span></div>))}</div></section> : null;
            case 'projects': return data.projects.length ? <section key={sec}>{H('Projects')}<div className="grid grid-cols-2 gap-2.5">{data.projects.map((p, i) => (
              <div key={i} className="rounded-lg p-2.5 border" style={{ borderColor: accent + '40' }}>
                <div className="font-bold" style={{ color: accent, fontSize: fs(12, fontScale) }}>{p.name}</div>
                {p.description && <p className="text-gray-700 mt-0.5" style={{ fontSize: fs(11, fontScale) }}>{p.description}</p>}
                {p.tech.length > 0 && <div className="text-gray-500 mt-1" style={{ fontSize: fs(10, fontScale) }}>{p.tech.join(' · ')}</div>}
              </div>))}</div></section> : null;
            case 'certifications': return data.certifications.length ? <section key={sec}>{H('Certifications')}<ul className="space-y-0.5" style={{ fontSize: fs(11, fontScale) }}>{data.certifications.map((c, i) => <li key={i}>★ {c.name}{c.issuer && ` — ${c.issuer}`}{c.year && ` (${c.year})`}</li>)}</ul></section> : null;
            case 'languages': return data.languages.length ? <section key={sec}>{H('Languages')}<div className="flex flex-wrap gap-2" style={{ fontSize: fs(11, fontScale) }}>{data.languages.map((l, i) => <span key={i}>{l.name}{l.level ? ` (${l.level})` : ''}</span>)}</div></section> : null;
            default: return null;
          }
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── TECH ─────────────────────────── */
export function TechPreview({ data, fontFamily, fontScale, pageHmm }: TemplateProps) {
  const accent = data.accentColor || '#0F766E';
  const mono = "'JetBrains Mono', 'Fira Code', ui-monospace, monospace";
  return (
    <div className="bg-white text-gray-900 px-10 py-8 space-y-4" style={{ fontFamily, minHeight: `${pageHmm}mm` }}>
      <header className="pb-3 border-b" style={{ borderColor: accent }}>
        <div className="flex items-baseline gap-2">
          <span style={{ color: accent, fontFamily: mono, fontSize: fs(13, fontScale) }}>$</span>
          <h1 className="font-bold" style={{ fontSize: fs(20, fontScale) }}>{data.personal.name || 'Your Name'}</h1>
          {data.personal.title && <span className="ml-1 text-gray-600" style={{ fontFamily: mono, fontSize: fs(11, fontScale) }}>// {data.personal.title}</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-gray-700" style={{ fontFamily: mono, fontSize: fs(10.5, fontScale) }}>
          {data.personal.email    && <span>email: {data.personal.email}</span>}
          {data.personal.phone    && <span>phone: {data.personal.phone}</span>}
          {data.personal.location && <span>loc: {data.personal.location}</span>}
          {data.personal.github   && <span>github: {data.personal.github}</span>}
          {data.personal.linkedin && <span>linkedin: {data.personal.linkedin}</span>}
        </div>
      </header>
      {data.sectionOrder.map(sec => {
        if (!has(data, sec)) return null;
        const H = (l: string) => <div className="mb-2 font-bold" style={{ color: accent, fontFamily: mono, fontSize: fs(12, fontScale) }}># {l}</div>;
        switch (sec) {
          case 'summary': return data.summary ? <section key={sec}>{H('about')}<p className="leading-relaxed text-gray-700" style={{ fontSize: fs(11.5, fontScale) }}>{data.summary}</p></section> : null;
          case 'experience': return data.experience.length ? <section key={sec}>{H('experience')}<div className="space-y-3">{data.experience.map((e, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline">
                <div><span className="font-bold" style={{ fontSize: fs(12, fontScale) }}>{e.role}</span><span className="text-gray-600 ml-1.5" style={{ fontSize: fs(11, fontScale) }}>@ {e.company}</span></div>
                <div className="text-gray-500" style={{ fontFamily: mono, fontSize: fs(10.5, fontScale) }}>{e.startDate} → {e.isCurrent ? 'present' : e.endDate}</div>
              </div>
              {e.bullets.length > 0 && <ul className="mt-1 space-y-0.5">{e.bullets.map((b, j) => <li key={j} className="flex gap-1.5 leading-relaxed text-gray-700" style={{ fontSize: fs(11, fontScale) }}><span style={{ color: accent, fontFamily: mono }}>›</span>{b}</li>)}</ul>}
            </div>))}</div></section> : null;
          case 'skills': return (data.skills.technical.length || data.skills.tools.length || data.skills.soft.length) ? <section key={sec}>{H('skills')}<div className="space-y-1" style={{ fontFamily: mono, fontSize: fs(11, fontScale) }}>
            {data.skills.technical.length > 0 && <div><span style={{ color: accent }}>const</span> technical = [<span className="text-gray-700">{data.skills.technical.map(s => `'${s}'`).join(', ')}</span>];</div>}
            {data.skills.tools.length > 0 && <div><span style={{ color: accent }}>const</span> tools = [<span className="text-gray-700">{data.skills.tools.map(s => `'${s}'`).join(', ')}</span>];</div>}
            {data.skills.soft.length > 0 && <div><span style={{ color: accent }}>const</span> soft = [<span className="text-gray-700">{data.skills.soft.map(s => `'${s}'`).join(', ')}</span>];</div>}
          </div></section> : null;
          case 'projects': return data.projects.length ? <section key={sec}>{H('projects')}<div className="space-y-2">{data.projects.map((p, i) => (
            <div key={i}>
              <div className="font-bold" style={{ fontSize: fs(12, fontScale) }}>{p.name}{p.link && <span className="text-gray-500 ml-1" style={{ fontFamily: mono, fontSize: fs(10, fontScale) }}> {p.link}</span>}</div>
              {p.description && <p className="text-gray-700" style={{ fontSize: fs(11, fontScale) }}>{p.description}</p>}
              {p.tech.length > 0 && <div className="text-gray-500" style={{ fontFamily: mono, fontSize: fs(10, fontScale) }}>[{p.tech.join(', ')}]</div>}
            </div>))}</div></section> : null;
          case 'education': return data.education.length ? <section key={sec}>{H('education')}<div className="space-y-1">{data.education.map((ed, i) => (
            <div key={i}><span className="font-semibold" style={{ fontSize: fs(11.5, fontScale) }}>{ed.institution}</span><span className="text-gray-600 ml-1" style={{ fontSize: fs(11, fontScale) }}>· {[ed.degree, ed.field].filter(Boolean).join(', ')} ({ed.startYear}–{ed.endYear})</span></div>))}</div></section> : null;
          case 'certifications': return data.certifications.length ? <section key={sec}>{H('certs')}<ul className="space-y-0.5" style={{ fontSize: fs(11, fontScale) }}>{data.certifications.map((c, i) => <li key={i}>• {c.name}{c.issuer && ` — ${c.issuer}`}{c.year && ` (${c.year})`}</li>)}</ul></section> : null;
          default: return null;
        }
      })}
    </div>
  );
}

/* ─────────────────────────── ACADEMIC ─────────────────────────── */
export function AcademicPreview({ data, fontFamily, fontScale, pageHmm }: TemplateProps) {
  const accent = data.accentColor || '#1f2937';
  const f = fontFamily || "'Merriweather', 'Georgia', serif";
  return (
    <div className="bg-white text-gray-900 px-14 py-10 space-y-5" style={{ fontFamily: f, minHeight: `${pageHmm}mm` }}>
      <header className="text-center">
        <h1 className="font-semibold" style={{ fontSize: fs(22, fontScale), color: accent }}>{data.personal.name || 'Your Name'}</h1>
        {data.personal.title && <div className="text-gray-700 italic mt-1" style={{ fontSize: fs(12, fontScale) }}>{data.personal.title}</div>}
        <div className="text-gray-600 mt-2" style={{ fontSize: fs(10.5, fontScale) }}>
          {[data.personal.email, data.personal.phone, data.personal.location, data.personal.linkedin, data.personal.website].filter(Boolean).join(' · ')}
        </div>
      </header>
      {data.sectionOrder.map(sec => {
        if (!has(data, sec)) return null;
        const H = (l: string) => <h2 className="font-semibold border-b mb-2 pb-0.5" style={{ borderColor: accent, color: accent, fontSize: fs(13, fontScale) }}>{l}</h2>;
        switch (sec) {
          case 'summary': return data.summary ? <section key={sec}>{H('Research Statement')}<p className="leading-relaxed text-justify" style={{ fontSize: fs(12, fontScale) }}>{data.summary}</p></section> : null;
          case 'education': return data.education.length ? <section key={sec}>{H('Education')}<div className="space-y-1.5">{data.education.map((ed, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline"><span className="italic" style={{ fontSize: fs(12, fontScale) }}>{ed.institution}</span><span className="text-gray-600" style={{ fontSize: fs(11, fontScale) }}>{ed.startYear} – {ed.endYear}</span></div>
              <div className="text-gray-700" style={{ fontSize: fs(11.5, fontScale) }}>{[ed.degree, ed.field, ed.grade && `Grade: ${ed.grade}`].filter(Boolean).join('. ')}</div>
            </div>))}</div></section> : null;
          case 'experience': return data.experience.length ? <section key={sec}>{H('Appointments')}<div className="space-y-3">{data.experience.map((e, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline"><span className="italic font-semibold" style={{ fontSize: fs(12, fontScale) }}>{e.role}, {e.company}</span><span className="text-gray-600" style={{ fontSize: fs(11, fontScale) }}>{e.startDate} – {e.isCurrent ? 'Present' : e.endDate}</span></div>
              {e.bullets.length > 0 && <ul className="ml-5 list-disc mt-1 space-y-0.5">{e.bullets.map((b, j) => <li key={j} className="leading-relaxed text-justify" style={{ fontSize: fs(11.5, fontScale) }}>{b}</li>)}</ul>}
            </div>))}</div></section> : null;
          case 'projects': return data.projects.length ? <section key={sec}>{H('Selected Projects')}<ol className="ml-5 list-decimal space-y-1">{data.projects.map((p, i) => (
            <li key={i} style={{ fontSize: fs(11.5, fontScale) }}><span className="font-semibold">{p.name}.</span>{p.description && ` ${p.description}`}{p.tech.length > 0 && <span className="italic text-gray-600"> [{p.tech.join(', ')}]</span>}</li>))}</ol></section> : null;
          case 'certifications': return data.certifications.length ? <section key={sec}>{H('Certifications')}<ul className="ml-5 list-disc space-y-0.5" style={{ fontSize: fs(11.5, fontScale) }}>{data.certifications.map((c, i) => <li key={i}>{c.name}{c.issuer && `, ${c.issuer}`}{c.year && ` (${c.year})`}</li>)}</ul></section> : null;
          case 'awards': return data.awards.length ? <section key={sec}>{H('Honors & Awards')}<ul className="ml-5 list-disc space-y-0.5" style={{ fontSize: fs(11.5, fontScale) }}>{data.awards.map((a, i) => <li key={i}>{a.title}{a.issuer && `, ${a.issuer}`}{a.year && ` (${a.year})`}</li>)}</ul></section> : null;
          case 'skills': {
            const all = [...data.skills.technical, ...data.skills.tools, ...data.skills.soft];
            return all.length ? <section key={sec}>{H('Skills')}<p style={{ fontSize: fs(11.5, fontScale) }}>{all.join(', ')}.</p></section> : null;
          }
          case 'languages': return data.languages.length ? <section key={sec}>{H('Languages')}<p style={{ fontSize: fs(11.5, fontScale) }}>{data.languages.map(l => l.name + (l.level ? ` (${l.level})` : '')).join('; ')}.</p></section> : null;
          default: return null;
        }
      })}
    </div>
  );
}

/* ─────────────────────────── TWO-COLUMN ─────────────────────────── */
export function TwoColumnPreview({ data, fontFamily, fontScale, pageHmm }: TemplateProps) {
  const accent = data.accentColor || '#1e3a8a';
  const right: string[] = ['skills', 'certifications', 'languages', 'awards'];
  const left = data.sectionOrder.filter(s => !right.includes(s));
  const H = (l: string) => <div className="font-bold uppercase tracking-wider mb-1.5 pb-0.5 border-b" style={{ color: accent, borderColor: accent + '60', fontSize: fs(11, fontScale) }}>{l}</div>;
  return (
    <div className="bg-white text-gray-900 px-8 py-8" style={{ fontFamily, minHeight: `${pageHmm}mm` }}>
      <header className="mb-5">
        <h1 className="font-bold" style={{ color: accent, fontSize: fs(24, fontScale) }}>{data.personal.name || 'Your Name'}</h1>
        {data.personal.title && <div className="text-gray-700 mt-0.5" style={{ fontSize: fs(13, fontScale) }}>{data.personal.title}</div>}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-gray-600" style={{ fontSize: fs(10.5, fontScale) }}>
          {[data.personal.email, data.personal.phone, data.personal.location, data.personal.linkedin, data.personal.github, data.personal.website].filter(Boolean).join(' · ')}
        </div>
      </header>
      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div className="space-y-4">
          {left.map(sec => {
            if (!has(data, sec)) return null;
            switch (sec) {
              case 'summary': return data.summary ? <section key={sec}>{H('Profile')}<p className="leading-relaxed text-gray-700" style={{ fontSize: fs(11.5, fontScale) }}>{data.summary}</p></section> : null;
              case 'experience': return data.experience.length ? <section key={sec}>{H('Experience')}<div className="space-y-2.5">{data.experience.map((e, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline"><span className="font-bold" style={{ fontSize: fs(12, fontScale) }}>{e.role}</span><span className="text-gray-500" style={{ fontSize: fs(10.5, fontScale) }}>{e.startDate} – {e.isCurrent ? 'Present' : e.endDate}</span></div>
                  <div className="text-gray-700" style={{ fontSize: fs(11, fontScale) }}>{[e.company, e.location].filter(Boolean).join(' · ')}</div>
                  {e.bullets.length > 0 && <ul className="mt-1 space-y-0.5">{e.bullets.map((b, j) => <li key={j} className="flex gap-1.5 leading-relaxed text-gray-700" style={{ fontSize: fs(11, fontScale) }}><span style={{ color: accent }}>•</span>{b}</li>)}</ul>}
                </div>))}</div></section> : null;
              case 'education': return data.education.length ? <section key={sec}>{H('Education')}<div className="space-y-1">{data.education.map((ed, i) => (
                <div key={i}><div className="font-semibold" style={{ fontSize: fs(11.5, fontScale) }}>{ed.institution}</div><div className="text-gray-700" style={{ fontSize: fs(11, fontScale) }}>{[ed.degree, ed.field].filter(Boolean).join(', ')} <span className="text-gray-500">· {ed.startYear} – {ed.endYear}</span></div></div>))}</div></section> : null;
              case 'projects': return data.projects.length ? <section key={sec}>{H('Projects')}<div className="space-y-1.5">{data.projects.map((p, i) => (
                <div key={i}><div className="font-semibold" style={{ fontSize: fs(11.5, fontScale) }}>{p.name}</div>{p.description && <p className="text-gray-700" style={{ fontSize: fs(11, fontScale) }}>{p.description}</p>}{p.tech.length > 0 && <div className="text-gray-500" style={{ fontSize: fs(10.5, fontScale) }}>{p.tech.join(' · ')}</div>}</div>))}</div></section> : null;
              default: return null;
            }
          })}
        </div>
        <div className="space-y-4">
          {right.map(sec => {
            if (!has(data, sec)) return null;
            switch (sec) {
              case 'skills': return (data.skills.technical.length || data.skills.tools.length || data.skills.soft.length) ? <section key={sec}>{H('Skills')}<div className="space-y-2">
                {data.skills.technical.length > 0 && <div><div className="font-semibold mb-0.5" style={{ fontSize: fs(10.5, fontScale) }}>Technical</div><div className="flex flex-wrap gap-1">{data.skills.technical.map(s => <span key={s} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700" style={{ fontSize: fs(10, fontScale) }}>{s}</span>)}</div></div>}
                {data.skills.tools.length > 0 && <div><div className="font-semibold mb-0.5" style={{ fontSize: fs(10.5, fontScale) }}>Tools</div><div className="flex flex-wrap gap-1">{data.skills.tools.map(s => <span key={s} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700" style={{ fontSize: fs(10, fontScale) }}>{s}</span>)}</div></div>}
                {data.skills.soft.length > 0 && <div><div className="font-semibold mb-0.5" style={{ fontSize: fs(10.5, fontScale) }}>Soft</div><div className="flex flex-wrap gap-1">{data.skills.soft.map(s => <span key={s} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700" style={{ fontSize: fs(10, fontScale) }}>{s}</span>)}</div></div>}
              </div></section> : null;
              case 'certifications': return data.certifications.length ? <section key={sec}>{H('Certifications')}<ul className="space-y-1" style={{ fontSize: fs(11, fontScale) }}>{data.certifications.map((c, i) => <li key={i}><span className="font-medium">{c.name}</span><div className="text-gray-500" style={{ fontSize: fs(10, fontScale) }}>{[c.issuer, c.year].filter(Boolean).join(' · ')}</div></li>)}</ul></section> : null;
              case 'languages': return data.languages.length ? <section key={sec}>{H('Languages')}<ul className="space-y-0.5" style={{ fontSize: fs(11, fontScale) }}>{data.languages.map((l, i) => <li key={i} className="flex justify-between"><span>{l.name}</span><span className="text-gray-500">{l.level}</span></li>)}</ul></section> : null;
              case 'awards': return data.awards.length ? <section key={sec}>{H('Awards')}<ul className="space-y-0.5" style={{ fontSize: fs(11, fontScale) }}>{data.awards.map((a, i) => <li key={i}><span className="font-medium">{a.title}</span><div className="text-gray-500" style={{ fontSize: fs(10, fontScale) }}>{[a.issuer, a.year].filter(Boolean).join(' · ')}</div></li>)}</ul></section> : null;
              default: return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}

export const NEW_TEMPLATE_RENDERERS: Record<string, (p: TemplateProps) => React.JSX.Element> = {
  executive: ExecutivePreview,
  creative:  CreativePreview,
  tech:      TechPreview,
  academic:  AcademicPreview,
  'two-column': TwoColumnPreview,
};
