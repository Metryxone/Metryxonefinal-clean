import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import { Briefcase, MapPin, Clock, DollarSign, Send, CheckCircle, AlertCircle, Building2, ChevronDown, ChevronUp, Paperclip, X } from 'lucide-react';



const RESUME_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_EXTS = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
type ResumePick = { filename: string; mime: string; dataBase64: string } | null;

interface PublicJob {
  _id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  experience: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  perks: string[];
  deadline: string;
  companyName: string;
  companyLogo: string;
  companyWebsite: string;
}

interface Props {
  token: string;
}

type Step = 'loading' | 'error' | 'form' | 'success';

export default function PublicJobApplicationPage({ token }: Props) {
  const [step, setStep] = useState<Step>('loading');
  const [job, setJob] = useState<PublicJob | null>(null);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', location: '',
    currentRole: '', experience: '', linkedinUrl: '',
    coverLetter: '', skills: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resume, setResume] = useState<ResumePick>(null);
  const [resumeErr, setResumeErr] = useState('');

  const onResumePick = (file: File | undefined) => {
    setResumeErr('');
    if (!file) { setResume(null); return; }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!RESUME_EXTS.includes(ext)) { setResumeErr(`Unsupported type. Allowed: ${RESUME_EXTS.join(', ')}`); return; }
    if (file.size > RESUME_MAX_BYTES) { setResumeErr('File exceeds the 5 MB limit'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setResume({ filename: file.name, mime: file.type || 'application/octet-stream', dataBase64: base64 });
    };
    reader.onerror = () => setResumeErr('Could not read the file. Please try again.');
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetch(`/api/employer/public/jobs/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.job) { setJob(d.job); setStep('form'); }
        else setStep('error');
      })
      .catch(() => setStep('error'));
  }, [token]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employer/public/jobs/${token}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, resume }),
      });
      if (res.ok) setStep('success');
      else { const d = await res.json(); alert(d.error ?? 'Submission failed. Please try again.'); }
    } catch { alert('Network error. Please try again.'); }
    setSubmitting(false);
  };

  const fld = (key: keyof typeof form, label: string, type = 'text', required = false) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setErrors(er => ({ ...er, [key]: '' })); }}
        className={`w-full h-10 px-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all ${errors[key] ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
      />
      {errors[key] && <p className="text-[10px] text-red-500 mt-0.5">{errors[key]}</p>}
    </div>
  );

  const fmtSalary = (min: number, max: number, currency = 'INR') => {
    const sym = currency === 'INR' ? '₹' : '$';
    const fmt = (n: number) => n >= 100000 ? `${sym}${(n / 100000).toFixed(0)}L` : `${sym}${(n / 1000).toFixed(0)}K`;
    if (!min && !max) return null;
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    return fmt(min || max);
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin mx-auto mb-3"/>
          <p className="text-sm text-gray-400">Loading job details…</p>
        </div>
      </div>
    );
  }

  if (step === 'error' || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
            <AlertCircle size={28} className="text-red-400"/>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Job Not Found</h2>
          <p className="text-sm text-gray-400">This job posting is no longer active or the link has expired.</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: `${BRAND.green}15` }}>
            <CheckCircle size={32} style={{ color: BRAND.green }}/>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Application Submitted!</h2>
          <p className="text-sm text-gray-500 mb-1">Thank you for applying to <strong>{job.title}</strong>.</p>
          <p className="text-sm text-gray-400">We'll review your application and get back to you shortly.</p>
        </div>
      </div>
    );
  }

  const salary = fmtSalary(job.salaryMin, job.salaryMax, job.currency);
  const DESC_LIMIT = 300;
  const shortDesc = job.description.length > DESC_LIMIT;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <div className="text-white py-8 px-4" style={{ background: `linear-gradient(135deg, ${BRAND.primary} 0%, #4a6eb8 100%)` }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-4">
            {job.companyLogo ? (
              <img src={job.companyLogo} alt={job.companyName} className="w-14 h-14 rounded-xl bg-white object-contain p-1 shrink-0"/>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Building2 size={24} className="text-white/80"/>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-white/70 text-xs font-semibold mb-0.5">{job.companyName || 'Company'}</div>
              <h1 className="text-xl font-bold leading-tight">{job.title}</h1>
              <div className="flex flex-wrap gap-3 mt-2 text-white/80 text-xs">
                {job.department && <span className="flex items-center gap-1"><Briefcase size={11}/>{job.department}</span>}
                {job.location && <span className="flex items-center gap-1"><MapPin size={11}/>{job.location}</span>}
                {job.type && <span className="flex items-center gap-1"><Clock size={11}/>{job.type}</span>}
                {salary && <span className="flex items-center gap-1"><DollarSign size={11}/>{salary}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Job details */}
        {job.description && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-800 mb-3">About the Role</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {showFullDesc || !shortDesc ? job.description : `${job.description.slice(0, DESC_LIMIT)}…`}
            </p>
            {shortDesc && (
              <button onClick={() => setShowFullDesc(v => !v)}
                className="mt-2 text-xs font-medium flex items-center gap-1" style={{ color: BRAND.primary }}>
                {showFullDesc ? <><ChevronUp size={12}/>Show less</> : <><ChevronDown size={12}/>Read more</>}
              </button>
            )}
          </div>
        )}

        {job.requirements?.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-800 mb-3">Requirements</h2>
            <ul className="space-y-1.5">
              {job.requirements.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BRAND.primary }}/>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {job.perks?.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-800 mb-3">Perks & Benefits</h2>
            <div className="flex flex-wrap gap-2">
              {job.perks.map((p, i) => (
                <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full border" style={{ borderColor: `${BRAND.accent}40`, color: BRAND.green, backgroundColor: `${BRAND.accent}10` }}>{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Application form */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 mb-1">Apply Now</h2>
          <p className="text-xs text-gray-400 mb-5">Fill in your details below. Fields marked <span className="text-red-400">*</span> are required.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fld('name', 'Full Name', 'text', true)}
              {fld('email', 'Email Address', 'email', true)}
              {fld('phone', 'Phone Number', 'tel')}
              {fld('location', 'Current Location')}
              {fld('currentRole', 'Current Role / Title')}
              {fld('experience', 'Total Experience (e.g. 3 years)')}
              {fld('linkedinUrl', 'LinkedIn Profile URL', 'url')}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Key Skills</label>
              <input
                value={form.skills}
                onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
                placeholder="e.g. React, TypeScript, Node.js (comma-separated)"
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Résumé / CV <span className="text-gray-300 font-normal">(optional)</span></label>
              {resume ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
                  <span className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                    <Paperclip size={14} className="shrink-0" style={{ color: BRAND.primary }}/>
                    <span className="truncate">{resume.filename}</span>
                  </span>
                  <button type="button" onClick={() => { setResume(null); setResumeErr(''); }}
                    className="shrink-0 text-gray-400 hover:text-red-500 transition-colors" aria-label="Remove résumé">
                    <X size={15}/>
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 transition-colors text-sm text-gray-500">
                  <Paperclip size={14}/>
                  <span>Attach your résumé (PDF, DOC, DOCX, TXT, RTF, ODT — max 5 MB)</span>
                  <input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt" className="hidden"
                    onChange={e => onResumePick(e.target.files?.[0])}/>
                </label>
              )}
              {resumeErr && <p className="text-[10px] text-red-500 mt-0.5">{resumeErr}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cover Note <span className="text-gray-300 font-normal">(optional)</span></label>
              <textarea
                value={form.coverLetter}
                onChange={e => setForm(f => ({ ...f, coverLetter: e.target.value }))}
                rows={4}
                placeholder="Tell us why you're a great fit for this role…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: BRAND.primary }}>
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Submitting…</>
              ) : (
                <><Send size={14}/>Submit Application</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-gray-400 pb-4">
          Powered by <span className="font-semibold">MetryxOne</span> Employer Intelligence
        </p>
      </div>
    </div>
  );
}
