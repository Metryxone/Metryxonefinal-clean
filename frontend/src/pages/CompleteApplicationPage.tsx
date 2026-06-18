import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Building2, Send, Paperclip, X, ShieldCheck } from 'lucide-react';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', green: '#2A9D8F', red: '#e63946' };

const RESUME_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_EXTS = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
type ResumePick = { filename: string; mime: string; dataBase64: string } | null;

interface Props { token: string; }

type Step = 'loading' | 'error' | 'form' | 'success';

interface CompletionData {
  firstName: string;
  company: string;
  jobTitle: string;
  email: string;
  values: {
    phone: string; location: string; linkedinUrl: string;
    currentRole: string; experience: string; education: string; skills: string[];
  };
  hasResume: boolean;
  missing: { key: string; label: string }[];
}

export default function CompleteApplicationPage({ token }: Props) {
  const [step, setStep] = useState<Step>('loading');
  const [data, setData] = useState<CompletionData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    phone: '', location: '', linkedinUrl: '',
    currentRole: '', experience: '', education: '', skills: '',
  });
  const [resume, setResume] = useState<ResumePick>(null);
  const [resumeErr, setResumeErr] = useState('');

  useEffect(() => {
    fetch(`/api/employer/public/complete/${token}`)
      .then(async r => (r.ok ? r.json() : Promise.reject()))
      .then((d: CompletionData) => {
        setData(d);
        setForm({
          phone: d.values.phone || '', location: d.values.location || '',
          linkedinUrl: d.values.linkedinUrl || '', currentRole: d.values.currentRole || '',
          experience: d.values.experience || '', education: d.values.education || '',
          skills: (d.values.skills || []).join(', '),
        });
        setStep('form');
      })
      .catch(() => setStep('error'));
  }, [token]);

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

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employer/public/complete/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, resume }),
      });
      if (res.ok) setStep('success');
      else { const d = await res.json().catch(() => ({})); alert(d.message ?? 'Submission failed. Please try again.'); }
    } catch { alert('Network error. Please try again.'); }
    setSubmitting(false);
  };

  const fld = (key: keyof typeof form, label: string, type = 'text', placeholder = '') => {
    const isMissing = data?.missing.some(m =>
      (key === 'currentRole' && m.key === 'currentRole') ||
      (key === 'skills' && m.key === 'skills') ||
      m.key === key);
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          {label}{isMissing && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: BRAND.primary, backgroundColor: `${BRAND.primary}12` }}>Needed</span>}
        </label>
        <input
          type={type}
          value={form[key]}
          placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>
    );
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin mx-auto mb-3"/>
          <p className="text-sm text-gray-400">Loading your application…</p>
        </div>
      </div>
    );
  }

  if (step === 'error' || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
            <AlertCircle size={28} className="text-red-400"/>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Link Invalid or Expired</h2>
          <p className="text-sm text-gray-400">This completion link is no longer valid. Please contact the company that invited you for a fresh link.</p>
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
          <h2 className="text-xl font-bold text-gray-800 mb-2">Application Updated!</h2>
          <p className="text-sm text-gray-500 mb-1">Thank you{data.firstName ? `, ${data.firstName}` : ''}. Your details have been sent to <strong>{data.company || 'the hiring team'}</strong>.</p>
          <p className="text-sm text-gray-400">You can close this page now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="text-white py-8 px-4" style={{ background: `linear-gradient(135deg, ${BRAND.primary} 0%, #4a6eb8 100%)` }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Building2 size={24} className="text-white/80"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white/70 text-xs font-semibold mb-0.5">{data.company || 'Company'}</div>
              <h1 className="text-xl font-bold leading-tight">Complete your application</h1>
              {data.jobTitle && <div className="text-white/80 text-xs mt-1">for {data.jobTitle}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {data.missing.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-800 mb-2">A few things to add</h2>
            <p className="text-xs text-gray-400 mb-3">The hiring team asked you to complete these items:</p>
            <div className="flex flex-wrap gap-2">
              {data.missing.map(m => (
                <span key={m.key} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: BRAND.primary, backgroundColor: `${BRAND.primary}10` }}>{m.label}</span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
              <input value={data.email} disabled readOnly
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"/>
              <p className="text-[10px] text-gray-400 mt-0.5">This is your application identity and can't be changed here.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fld('phone', 'Phone Number', 'tel')}
              {fld('location', 'Current Location')}
              {fld('currentRole', 'Current Role / Title')}
              {fld('experience', 'Total Experience', 'text', 'e.g. 3 years')}
              {fld('linkedinUrl', 'LinkedIn Profile URL', 'url')}
              {fld('education', 'Education')}
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
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Résumé / CV {data.hasResume && <span className="text-gray-300 font-normal">(one already on file — upload to replace)</span>}
              </label>
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
            <button type="submit" disabled={submitting}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: BRAND.primary }}>
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Submitting…</>
              ) : (
                <><Send size={14}/>Submit</>
              )}
            </button>
          </form>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-gray-400 pb-4">
          <ShieldCheck size={12}/> Secure link · Powered by <span className="font-semibold">MetryxOne</span>
        </p>
      </div>
    </div>
  );
}
