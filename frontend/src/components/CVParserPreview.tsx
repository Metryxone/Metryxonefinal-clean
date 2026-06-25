import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { useState, useRef, type ReactNode } from 'react';
import {
  Upload, FileText, X, Loader2, CheckCircle, User, Mail, Phone,
  MapPin, Linkedin, Github, Globe, BookOpen, Briefcase, Award,
  Code, Wrench, Heart, Star, FolderOpen, Languages, AlertCircle,
  ChevronDown, ChevronUp, Sparkles, BarChart3, Camera, Plus
} from 'lucide-react';
import { ProfileCompletenessCard } from './ProfileCompletenessCard';



export interface ParsedCVProfile {
  personal: {
    name: string; email: string; phone: string; location: string;
    linkedin: string; github: string; website: string; portfolio: string;
  };
  summary: string;
  skills: { technical: string[]; soft: string[]; tools: string[]; languages: string[] };
  education: Array<{ institution: string; degree: string; field: string; startYear: string; endYear: string; grade: string }>;
  experience: Array<{ company: string; role: string; startDate: string; endDate: string; description: string; isCurrent: boolean }>;
  certifications: Array<{ name: string; issuer: string; year: string }>;
  projects: Array<{ name: string; description: string; tech: string[]; url: string }>;
  achievements: string[];
  spokenLanguages: string[];
  competencyProfile: { completeness: number; sectionsFilled: string[] };
}

interface Props {
  onProfileParsed: (profile: ParsedCVProfile, file: File) => void;
  onClear: () => void;
  parsed: ParsedCVProfile | null;
  photoDataUrl?: string | null;
  onPhotoChange?: (file: File | null, dataUrl: string | null) => void;
}

function Chip({ label, color = BRAND.accent }: { label: string; color?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium"
      style={{ backgroundColor: `${color}15`, color }}>
      {label}
    </span>
  );
}

function Section({ icon, title, children, defaultOpen = true }: { icon: ReactNode; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-2">
          <span style={{ color: BRAND.primary }}>{icon}</span>
          <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3 bg-white">{children}</div>}
    </div>
  );
}

export function CVParserPreview({ onProfileParsed, onClear, parsed, photoDataUrl, onPhotoChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseStep, setParseStep] = useState('');

  function handlePhotoUpload(f: File | null) {
    if (!f) { onPhotoChange?.(null, null); return; }
    if (!f.type.startsWith('image/')) return;
    if (f.size > 4 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => onPhotoChange?.(f, String(reader.result));
    reader.readAsDataURL(f);
  }

  const STEPS = [
    'Extracting text from document…',
    'Identifying personal information…',
    'Analysing skills & competencies…',
    'Mapping education history…',
    'Processing work experience…',
    'Detecting certifications & projects…',
    'Computing completeness score…',
    'Building your aspirant profile…',
  ];

  async function parseFile(f: File) {
    setFile(f);
    setParsing(true);
    setError('');
    setParseStep(STEPS[0]);

    let stepIdx = 0;
    const stepper = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, STEPS.length - 1);
      setParseStep(STEPS[stepIdx]);
    }, 600);

    try {
      const form = new FormData();
      form.append('cv', f);

      const res = await fetch('/api/cv/parse', { method: 'POST', body: form });
      clearInterval(stepper);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Parsing failed');
      }

      const data = await res.json();
      setParseStep('Done!');
      setTimeout(() => {
        setParsing(false);
        onProfileParsed(data.profile as ParsedCVProfile, f);
      }, 400);
    } catch (e: any) {
      clearInterval(stepper);
      setParsing(false);
      setError(e.message || 'Could not parse CV. Please try again.');
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    parseFile(files[0]);
  }

  function clearAll() {
    setFile(null);
    setError('');
    setParsing(false);
    setParseStep('');
    onClear();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Upload zone ──────────────────────────────────────────────────────────
  if (!file && !parsed) {
    return (
      <div>
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
          onChange={e => handleFiles(e.target.files)} />
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed p-5 flex flex-col items-center gap-2 transition-all"
          style={{ borderColor: dragOver ? BRAND.accent : '#d1d5db', backgroundColor: dragOver ? `${BRAND.accent}08` : '#fafafa' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${BRAND.accent}15` }}>
            <Upload size={20} style={{ color: BRAND.accent }} strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              Drag & drop your CV, or <span style={{ color: BRAND.accent }}>browse</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">PDF, DOC, DOCX · Max 5 MB</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full text-[10px] font-medium"
            style={{ backgroundColor: `${BRAND.primary}08`, color: BRAND.primary }}>
            <Sparkles size={11} />
            AI-powered extraction — 9 profile sections in seconds
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Upload your CV to auto-fill your aspirant profile. You can also upload later from your dashboard.
        </p>
      </div>
    );
  }

  // ── Parsing animation ────────────────────────────────────────────────────
  if (parsing) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col items-center gap-3">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full animate-spin border-2 border-transparent"
            style={{ borderTopColor: BRAND.accent }} />
          <div className="absolute inset-1.5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${BRAND.accent}15` }}>
            <FileText size={16} style={{ color: BRAND.accent }} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>Parsing your CV…</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{parseStep}</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div className="h-full rounded-full animate-pulse" style={{ backgroundColor: BRAND.accent, width: '60%' }} />
        </div>
        <p className="text-[9px] text-gray-300">{file?.name}</p>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle size={15} />
          <span className="text-xs font-semibold">Parsing failed</span>
        </div>
        <p className="text-[10px] text-red-500">{error}</p>
        <button type="button" onClick={clearAll} className="text-[10px] underline text-red-400 self-start">
          Try again with a different file
        </button>
      </div>
    );
  }

  // ── Parsed profile preview ───────────────────────────────────────────────
  if (!parsed) return null;

  const { personal, summary, skills, education, experience, certifications, projects, achievements, spokenLanguages, competencyProfile } = parsed;
  const hasPhoto = !!photoDataUrl;
  const effectiveFilled = hasPhoto ? [...competencyProfile.sectionsFilled, 'photo'] : competencyProfile.sectionsFilled;
  const displayedCompleteness = Math.min(100, competencyProfile.completeness + (hasPhoto ? 4 : 0));

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-xl px-4 py-2.5 border"
        style={{ borderColor: `${BRAND.green}30`, backgroundColor: `${BRAND.green}08` }}>
        <div className="flex items-center gap-2.5">
          <CheckCircle size={16} style={{ color: BRAND.green }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>CV Parsed Successfully</p>
            <p className="text-[10px] text-gray-500">{file?.name} · {competencyProfile.sectionsFilled.length}/9 sections extracted</p>
          </div>
        </div>
        <button type="button" onClick={clearAll}
          className="p-1 rounded-lg hover:bg-white transition-colors" title="Remove CV">
          <X size={14} className="text-gray-400" />
        </button>
      </div>

      {/* Photo + Completeness card */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
        <div className="flex items-start gap-3">
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => handlePhotoUpload(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => photoInputRef.current?.click()}
            className="relative w-16 h-16 rounded-full border-2 border-dashed flex-shrink-0 flex items-center justify-center overflow-hidden transition-all hover:border-solid"
            style={{ borderColor: hasPhoto ? BRAND.accent : '#d1d5db', backgroundColor: hasPhoto ? 'transparent' : `${BRAND.accent}08` }}
            title={hasPhoto ? 'Replace photo' : 'Add profile photo'}>
            {hasPhoto ? (
              <img src={photoDataUrl!} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <Camera size={16} style={{ color: BRAND.accent }} strokeWidth={1.5} />
                <span className="text-[8px] font-semibold" style={{ color: BRAND.accent }}>Add Photo</span>
              </div>
            )}
            {hasPhoto && (
              <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: BRAND.accent }}>
                <Plus size={11} className="text-white" />
              </span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <BarChart3 size={13} style={{ color: BRAND.accent }} />
                <span className="text-[10px] font-semibold" style={{ color: BRAND.primary }}>Profile Completeness</span>
              </div>
              <span className="text-sm font-extrabold" style={{ color: BRAND.accent }}>{displayedCompleteness}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${displayedCompleteness}%`, backgroundColor: BRAND.accent }} />
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {effectiveFilled.map(s => (
                <span key={s} className="text-[9px] px-1.5 py-0.5 rounded capitalize"
                  style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>
                  ✓ {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            {hasPhoto && (
              <button type="button" onClick={() => handlePhotoUpload(null)}
                className="text-[9px] text-gray-400 hover:text-red-500 mt-1.5 underline">
                Remove photo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Make it 100% — missing items */}
      <ProfileCompletenessCard
        sectionsFilled={competencyProfile.sectionsFilled}
        completeness={competencyProfile.completeness}
        hasPhoto={hasPhoto}
        compact
      />

      {/* ── Sections ── */}

      {/* Personal */}
      {(personal.name || personal.email || personal.phone || personal.location) && (
        <Section icon={<User size={14} strokeWidth={1.5} />} title="Personal Information">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {personal.name     && <div className="flex items-center gap-1.5 text-[11px] text-gray-600"><User size={11} className="flex-shrink-0 text-gray-400" />{personal.name}</div>}
            {personal.email    && <div className="flex items-center gap-1.5 text-[11px] text-gray-600"><Mail size={11} className="flex-shrink-0 text-gray-400" />{personal.email}</div>}
            {personal.phone    && <div className="flex items-center gap-1.5 text-[11px] text-gray-600"><Phone size={11} className="flex-shrink-0 text-gray-400" />{personal.phone}</div>}
            {personal.location && <div className="flex items-center gap-1.5 text-[11px] text-gray-600"><MapPin size={11} className="flex-shrink-0 text-gray-400" />{personal.location}</div>}
            {personal.linkedin && <div className="flex items-center gap-1.5 text-[11px] text-gray-600 col-span-2 truncate"><Linkedin size={11} className="flex-shrink-0 text-gray-400" />{personal.linkedin}</div>}
            {personal.github   && <div className="flex items-center gap-1.5 text-[11px] text-gray-600 col-span-2 truncate"><Github size={11} className="flex-shrink-0 text-gray-400" />{personal.github}</div>}
          </div>
        </Section>
      )}

      {/* Summary */}
      {summary && (
        <Section icon={<Sparkles size={14} strokeWidth={1.5} />} title="Professional Summary">
          <p className="text-[11px] text-gray-600 leading-relaxed">{summary}</p>
        </Section>
      )}

      {/* Skills */}
      {(skills.technical.length > 0 || skills.tools.length > 0 || skills.soft.length > 0) && (
        <Section icon={<Code size={14} strokeWidth={1.5} />} title="Skills & Competencies">
          <div className="space-y-2">
            {skills.technical.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Technical</p>
                <div className="flex flex-wrap gap-1">
                  {skills.technical.map(s => <Chip key={s} label={s} color={BRAND.primary} />)}
                </div>
              </div>
            )}
            {skills.tools.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Tools & Platforms</p>
                <div className="flex flex-wrap gap-1">
                  {skills.tools.map(s => <Chip key={s} label={s} color={BRAND.accent} />)}
                </div>
              </div>
            )}
            {skills.soft.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Soft Skills</p>
                <div className="flex flex-wrap gap-1">
                  {skills.soft.map(s => <Chip key={s} label={s} color={BRAND.green} />)}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Education */}
      {education.length > 0 && (
        <Section icon={<BookOpen size={14} strokeWidth={1.5} />} title={`Education (${education.length})`}>
          <div className="space-y-2.5">
            {education.map((e, i) => (
              <div key={i} className="border-l-2 pl-3 py-0.5" style={{ borderColor: BRAND.accent }}>
                <p className="text-[11px] font-semibold text-gray-800">{e.degree || 'Degree'}</p>
                {e.institution && <p className="text-[10px] text-gray-500">{e.institution}</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  {(e.startYear || e.endYear) && <span className="text-[9px] text-gray-400">{e.startYear}{e.endYear && e.endYear !== e.startYear ? ` – ${e.endYear}` : ''}</span>}
                  {e.grade && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>{e.grade}</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <Section icon={<Briefcase size={14} strokeWidth={1.5} />} title={`Work Experience (${experience.length})`}>
          <div className="space-y-3">
            {experience.map((e, i) => (
              <div key={i} className="border-l-2 pl-3 py-0.5" style={{ borderColor: `${BRAND.primary}50` }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-800">{e.role || 'Role'}</p>
                    {e.company && <p className="text-[10px] text-gray-500">{e.company}</p>}
                  </div>
                  {e.isCurrent && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>Current</span>
                  )}
                </div>
                {(e.startDate || e.endDate) && (
                  <p className="text-[9px] text-gray-400 mt-0.5">{e.startDate}{e.endDate ? ` – ${e.endDate}` : ''}</p>
                )}
                {e.description && <p className="text-[10px] text-gray-500 mt-1 leading-relaxed line-clamp-3">{e.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <Section icon={<Award size={14} strokeWidth={1.5} />} title={`Certifications (${certifications.length})`} defaultOpen={false}>
          <div className="space-y-1.5">
            {certifications.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: BRAND.accent }} />
                <div>
                  <p className="text-[11px] text-gray-700">{c.name}</p>
                  {(c.issuer || c.year) && <p className="text-[9px] text-gray-400">{c.issuer}{c.issuer && c.year ? ' · ' : ''}{c.year}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <Section icon={<FolderOpen size={14} strokeWidth={1.5} />} title={`Projects (${projects.length})`} defaultOpen={false}>
          <div className="space-y-2.5">
            {projects.map((p, i) => (
              <div key={i}>
                <p className="text-[11px] font-semibold text-gray-800">{p.name}</p>
                {p.description && <p className="text-[10px] text-gray-500 leading-relaxed">{p.description}</p>}
                {p.tech.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.tech.map(t => <Chip key={t} label={t} color={BRAND.primary} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <Section icon={<Star size={14} strokeWidth={1.5} />} title="Achievements & Awards" defaultOpen={false}>
          <ul className="space-y-1">
            {achievements.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-gray-600">
                <span className="mt-0.5 flex-shrink-0" style={{ color: BRAND.accent }}>✦</span>
                {a}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Languages */}
      {spokenLanguages.length > 0 && (
        <Section icon={<Languages size={14} strokeWidth={1.5} />} title="Languages" defaultOpen={false}>
          <div className="flex flex-wrap gap-1">
            {spokenLanguages.map(l => <Chip key={l} label={l} color={BRAND.green} />)}
          </div>
        </Section>
      )}

      <p className="text-[9px] text-gray-400 text-center leading-relaxed">
        All extracted data is saved to your MetryxOne Aspirant Profile. You can edit any section from your dashboard.
      </p>
    </div>
  );
}
