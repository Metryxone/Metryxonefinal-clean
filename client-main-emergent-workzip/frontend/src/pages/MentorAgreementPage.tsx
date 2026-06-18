import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CheckCircle, Upload, AlertCircle, FileText, Loader2, ShieldCheck } from 'lucide-react';

interface AgreementInfo {
  mentorCode: string;
  displayName: string;
  mentorType: string;
  roleTitle: string;
  agreementStatus: string;
  scope: string;
  responsibilities: string;
  kpis: string;
  alreadyCompleted?: boolean;
}

const BRAND_BLUE = '#344E86';

export default function MentorAgreementPage({ onNavigate }: { onNavigate: (s: string) => void }) {
  const pathParts = window.location.pathname.split('/');
  const mentorCode = pathParts[2] || '';
  const token = new URLSearchParams(window.location.search).get('token') || '';

  const [info, setInfo] = useState<AgreementInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!mentorCode || !token) {
      setError('Invalid agreement link. Please check your email for the correct link.');
      setLoading(false);
      return;
    }
    fetch(`/api/mentor-agreement/${mentorCode}/info?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.message) { setError(data.message); return; }
        setInfo(data);
      })
      .catch(() => setError('Could not load agreement. Please try again later.'))
      .finally(() => setLoading(false));
  }, [mentorCode, token]);

  const handleSubmit = async () => {
    if (!acknowledged) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('token', token);
      form.append('acknowledged', 'true');
      if (file) form.append('signedAgreement', file);

      const res = await fetch(`/api/mentor-agreement/${mentorCode}/submit`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND_BLUE }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Link Error</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (info?.alreadyCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
          <CheckCircle className="h-14 w-14 text-teal-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Agreement Already Completed</h2>
          <p className="text-gray-500 mb-4">Your agreement has been submitted. Your mentor profile is <strong>active</strong> on the MetryxOne Marketplace.</p>
          <Badge className="bg-teal-100 text-teal-700 text-sm px-3 py-1">{info.mentorCode}</Badge>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
          <CheckCircle className="h-14 w-14 text-teal-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Agreement Submitted!</h2>
          <p className="text-gray-600 mb-1">
            {file
              ? 'Your signed agreement has been received. Your mentor profile is now active on the MetryxOne Marketplace.'
              : 'Your acknowledgement has been recorded. Please upload your signed agreement copy to complete activation.'}
          </p>
          <p className="text-sm text-gray-400 mt-4">Mentor ID: <strong style={{ color: BRAND_BLUE }}>{mentorCode}</strong></p>
          <p className="text-xs text-gray-400 mt-2">You will receive a confirmation email shortly.</p>
        </div>
      </div>
    );
  }

  const responsibilityLines = (info?.responsibilities || '').split('\n').filter(Boolean);
  const kpiLines = (info?.kpis || '').split('\n').filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="py-6 px-4 text-center" style={{ background: `#4ECDC4` }}>
        <img src="/logo.png" alt="MetryxOne" className="h-8 mx-auto mb-3 hidden" />
        <div className="text-white font-bold text-xl tracking-wide mb-1">MetryxOne</div>
        <p className="text-white/80 text-sm">Mentor Service Agreement</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Identity card */}
        <div className="bg-white rounded-2xl shadow-sm border p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Mentor</p>
              <h1 className="text-xl font-bold text-gray-800">{info?.displayName}</h1>
              <p className="text-gray-500 mt-0.5">{info?.roleTitle}</p>
            </div>
            <div className="text-right">
              <Badge className="text-xs px-2 py-1 mb-1" style={{ backgroundColor: `${BRAND_BLUE}15`, color: BRAND_BLUE }}>
                {mentorCode}
              </Badge>
              <p className="text-xs text-gray-400">Mentor ID</p>
            </div>
          </div>
        </div>

        {/* Agreement document */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ backgroundColor: `${BRAND_BLUE}08` }}>
            <FileText className="h-4 w-4" style={{ color: BRAND_BLUE }} />
            <h2 className="font-semibold text-gray-800">Service Agreement — {info?.roleTitle}</h2>
          </div>
          <div className="p-5 space-y-5 text-sm text-gray-700">
            {/* Preamble */}
            <p>
              This Service Agreement ("<strong>Agreement</strong>") is entered into between <strong>MetryxOne Technologies Pvt. Ltd.</strong> ("<strong>Platform</strong>") and the mentor named above ("<strong>Mentor</strong>"), effective from the date of acknowledgement below.
            </p>

            {/* Scope */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">1. Scope of Engagement</h3>
              <p className="leading-relaxed">{info?.scope}</p>
            </div>

            {/* Responsibilities */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">2. Key Responsibilities</h3>
              <ul className="space-y-1">
                {responsibilityLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-teal-500 mt-0.5 shrink-0">✓</span>
                    <span>{line.replace(/^[•\-]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* KPIs */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">3. Key Performance Indicators</h3>
              <ul className="space-y-1">
                {kpiLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span style={{ color: BRAND_BLUE }} className="mt-0.5 shrink-0">▸</span>
                    <span>{line.replace(/^[•\-]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Standard clauses */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">4. Confidentiality</h3>
              <p className="leading-relaxed text-gray-600">The Mentor agrees to maintain strict confidentiality of all student information, session records, assessment data, and platform materials. Breach of confidentiality shall result in immediate termination and may attract legal action.</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-1">5. Code of Conduct</h3>
              <p className="leading-relaxed text-gray-600">The Mentor shall conduct themselves professionally at all times, refrain from soliciting students for off-platform engagement, and adhere to MetryxOne's Safeguarding and Ethics Policy. Any violation shall be grounds for immediate suspension.</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-1">6. Intellectual Property</h3>
              <p className="leading-relaxed text-gray-600">All materials, assessments, reports, and content created by the Mentor within the MetryxOne platform shall remain the joint property of the Mentor and MetryxOne Technologies Pvt. Ltd.</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-1">7. Termination</h3>
              <p className="leading-relaxed text-gray-600">Either party may terminate this agreement with 30 days' written notice. MetryxOne reserves the right to suspend or terminate the Mentor's profile immediately in cases of misconduct, breach of confidentiality, or non-performance.</p>
            </div>

            <div className="p-3 rounded-lg text-xs text-gray-500 border border-dashed">
              By acknowledging this agreement, you confirm that you have read, understood, and agree to be bound by all terms stated above. This digital acknowledgement carries the same legal weight as a physical signature.
            </div>
          </div>
        </div>

        {/* Acknowledgement + Upload */}
        <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-5">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="ack"
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              className="mt-1 w-4 h-4 cursor-pointer"
              style={{ accentColor: BRAND_BLUE }}
            />
            <label htmlFor="ack" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
              I, <strong>{info?.displayName}</strong>, confirm that I have read and fully understood the MetryxOne Mentor Service Agreement for the role of <strong>{info?.roleTitle}</strong>. I agree to abide by all terms, responsibilities, and KPIs stated above.
            </label>
          </div>

          {/* File upload */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Upload Signed Agreement Copy <span className="text-gray-400 font-normal">(recommended — PDF, JPG, PNG, DOC)</span>
            </p>
            <input
              type="file"
              ref={fileRef}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-teal-200 bg-teal-50">
                <FileText className="h-4 w-4 text-teal-600" />
                <span className="text-sm text-teal-700 font-medium flex-1 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">Click to upload signed copy</span>
              </button>
            )}
          </div>

          {/* Submit */}
          <Button
            className="w-full h-12 text-base font-semibold"
            style={{ backgroundColor: acknowledged ? BRAND_BLUE : '#9CA3AF' }}
            disabled={!acknowledged || submitting}
            onClick={handleSubmit}
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</>
              : <><ShieldCheck className="h-4 w-4 mr-2" /> {file ? 'Submit Acknowledgement & Signed Copy' : 'Submit Acknowledgement'}</>
            }
          </Button>
          {!file && acknowledged && (
            <p className="text-xs text-center text-amber-600">You can proceed without uploading, but your profile will only fully activate once the signed copy is received.</p>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-6">
          Questions? Contact <a href="mailto:support@metryxone.com" className="underline">support@metryxone.com</a>
        </p>
      </div>
    </div>
  );
}
