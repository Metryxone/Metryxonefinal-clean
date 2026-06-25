import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useRef } from 'react';



const DOC_LABELS: Record<string, string> = {
  registration_certificate: 'Registration Certificate',
  pan_card: 'PAN Card',
  gst_certificate: 'GST Certificate',
  address_proof: 'Address Proof',
  identity_proof: 'Identity Proof (Aadhaar / Passport)',
  authorization_letter: 'Authorization Letter',
  bank_details: 'Bank Account Details',
  qualification_certificate: 'Qualification Certificate',
  experience_letter: 'Experience Letter',
  police_clearance: 'Police Clearance Certificate',
  ngo_registration: 'NGO Registration Certificate',
  fcra_certificate: 'FCRA Certificate',
};

interface UploadInfo {
  entityName: string;
  entityEmail: string;
  entityType: string;
  requestedDocs: string[];
  customMessage?: string;
  expiresAt: string;
  uploadedDocs: Array<{ document_type: string; status: string; file_url?: string }>;
}

interface Props {
  onNavigate?: (screen: string) => void;
}

export default function DocumentUploadPage({ onNavigate }: Props) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const pathParts = window.location.pathname.split('/');
  const onboardingId = pathParts[2] || '';

  const [info, setInfo] = useState<UploadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadedTypes, setUploadedTypes] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!onboardingId || !token) {
      setError('Invalid upload link. Please check the link in your email.');
      setLoading(false);
      return;
    }
    fetch(`/api/upload/${onboardingId}/info?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.message) {
          setError(data.message);
        } else {
          setInfo(data);
          const alreadyUploaded = new Set<string>(
            (data.uploadedDocs || []).map((d: any) => d.document_type)
          );
          setUploadedTypes(alreadyUploaded);
        }
      })
      .catch(() => setError('Failed to load upload request. Please try again.'))
      .finally(() => setLoading(false));
  }, [onboardingId, token]);

  const handleFileChange = (docType: string, file: File | null) => {
    setFiles(prev => ({ ...prev, [docType]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toUpload = Object.entries(files).filter(([, f]) => f !== null);
    if (toUpload.length === 0) {
      alert('Please select at least one file to upload.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      toUpload.forEach(([docType, file]) => {
        formData.append('files', file!);
        formData.append('documentTypes', docType);
      });

      const res = await fetch(`/api/upload/${onboardingId}/documents?token=${token}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message || 'Upload failed. Please try again.');
        return;
      }

      setDone(true);
    } catch {
      alert('Upload failed. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const pendingDocs = (info?.requestedDocs || []).filter(d => !uploadedTypes.has(d));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
          <p className="text-gray-500">Validating your upload link…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <p className="text-sm text-gray-400">
            Contact us at{' '}
            <a href="mailto:support@metryx.app" className="underline" style={{ color: BRAND.primary }}>
              support@metryx.app
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${BRAND.accent}20` }}>
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: BRAND.primary }}>Documents Uploaded!</h2>
          <p className="text-gray-500 mb-4">
            Thank you, <strong>{info?.entityName}</strong>. Your documents have been received and are under review.
            Our team will verify them and update you via email.
          </p>
          <p className="text-sm text-gray-400">
            Questions? Email{' '}
            <a href="mailto:support@metryx.app" className="underline" style={{ color: BRAND.primary }}>
              support@metryx.app
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b shadow-sm" style={{ borderColor: BRAND.border }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: BRAND.primary }}>M</div>
          <div>
            <div className="font-bold text-sm" style={{ color: BRAND.primary }}>MetryxOne</div>
            <div className="text-xs text-gray-400">Secure Document Upload</div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6" style={{ borderColor: BRAND.border }}>
          <h1 className="text-xl font-bold mb-1" style={{ color: BRAND.primary }}>Document Submission</h1>
          <p className="text-gray-500 text-sm mb-4">
            Hello <strong>{info?.entityName}</strong>, please upload the required documents below.
          </p>
          {info?.customMessage && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700 mb-4">
              "{info.customMessage}"
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>🔒 Secure &amp; encrypted</span>
            <span>·</span>
            <span>Expires {new Date(info?.expiresAt || '').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Already uploaded */}
        {uploadedTypes.size > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-teal-700 mb-2">✅ Already uploaded:</p>
            <ul className="space-y-1">
              {Array.from(uploadedTypes).map(dt => (
                <li key={dt} className="text-sm text-teal-600">• {DOC_LABELS[dt] || dt.replace(/_/g, ' ')}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Upload Form */}
        {pendingDocs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center" style={{ borderColor: BRAND.border }}>
            <span className="text-4xl">🎉</span>
            <h3 className="font-semibold text-gray-800 mt-3 mb-1">All documents submitted</h3>
            <p className="text-gray-500 text-sm">All requested documents have already been uploaded. Our team will review them shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border p-6" style={{ borderColor: BRAND.border }}>
              <h2 className="font-semibold text-gray-800 mb-4">Required Documents ({pendingDocs.length})</h2>
              <div className="space-y-5">
                {pendingDocs.map(docType => (
                  <div key={docType} className="border rounded-xl p-4" style={{ borderColor: BRAND.border }}>
                    <p className="font-medium text-sm mb-1" style={{ color: BRAND.text }}>
                      {DOC_LABELS[docType] || docType.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-400 mb-3">PDF, JPG, PNG, DOC or DOCX · Max 10 MB</p>

                    {files[docType] ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <span className="text-blue-600">📄</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-700 truncate">{files[docType]!.name}</p>
                          <p className="text-xs text-blue-500">{(files[docType]!.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-red-500 hover:text-red-700"
                          onClick={() => handleFileChange(docType, null)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="w-full border-2 border-dashed rounded-xl p-4 text-center hover:bg-gray-50 transition-colors"
                        style={{ borderColor: BRAND.border }}
                        onClick={() => fileRefs.current[docType]?.click()}
                      >
                        <span className="text-2xl block mb-1">📤</span>
                        <span className="text-sm text-gray-500">Click to select file</span>
                      </button>
                    )}

                    <input
                      ref={el => { fileRefs.current[docType] = el; }}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={e => handleFileChange(docType, e.target.files?.[0] || null)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || Object.values(files).every(f => f === null)}
              className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: BRAND.primary }}
            >
              {uploading ? 'Uploading…' : `Submit Documents (${Object.values(files).filter(Boolean).length} selected)`}
            </button>

            <p className="text-center text-xs text-gray-400">
              🔒 Your files are transmitted securely and stored encrypted.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
