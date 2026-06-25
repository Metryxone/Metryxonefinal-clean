import { BRAND } from '@/design-system/tokens';
import { useEffect, useState } from 'react';
import { Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react';



type Status = 'loading' | 'approved' | 'already_approved' | 'invalid' | 'error';

export function ParentConsentApprovePage() {
  const [status, setStatus] = useState<Status>('loading');
  const [approvedAt, setApprovedAt] = useState<string | null>(null);

  useEffect(() => {
    const token = window.location.pathname.split('/parent-consent/')[1];
    if (!token) { setStatus('invalid'); return; }

    fetch(`/api/auth/parent-consent/approve/${token}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.alreadyApproved) {
          setStatus('already_approved');
        } else if (data.approved) {
          setStatus('approved');
          setApprovedAt(data.approvedAt);
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${BRAND.primary}15` }}>
            <Shield size={32} style={{ color: BRAND.primary }} />
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-800 mb-2">MetryxOne</h1>
        <p className="text-sm text-gray-500 mb-8">Parent / Guardian Consent Portal</p>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin" style={{ color: BRAND.accent }} />
            <p className="text-gray-600">Verifying your consent link&hellip;</p>
          </div>
        )}

        {status === 'approved' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle size={48} className="text-teal-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Consent Approved!</h2>
              <p className="text-sm text-gray-500">
                Thank you. Your child&rsquo;s MetryxOne account is now fully active and they can begin their learning journey.
              </p>
              {approvedAt && (
                <p className="text-xs text-gray-400 mt-3">
                  Approved on {new Date(approvedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="w-full bg-teal-50 border border-teal-100 rounded-xl p-4 text-left mt-2">
              <p className="text-xs font-semibold text-teal-800 mb-1">What happens next?</p>
              <ul className="text-xs text-teal-700 space-y-1 list-disc list-inside">
                <li>Your child can now log in and access all features</li>
                <li>You can monitor their progress from the Parent Portal</li>
                <li>All data is protected under DPDP Act 2023 &amp; COPPA</li>
              </ul>
            </div>
          </div>
        )}

        {status === 'already_approved' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle size={48} className="text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Already Approved</h2>
              <p className="text-sm text-gray-500">
                This consent was already given. Your child&rsquo;s account is active.
              </p>
            </div>
          </div>
        )}

        {(status === 'invalid' || status === 'error') && (
          <div className="flex flex-col items-center gap-4">
            <XCircle size={48} className="text-red-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Invalid Link</h2>
              <p className="text-sm text-gray-500">
                This consent link is invalid or has expired. Please ask your child to resend the consent request from their account.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-[10px] text-gray-400">
            MetryxOne &mdash; AI-Powered Behavioral Intelligence Platform<br />
            Data protected under DPDP Act 2023, COPPA &amp; GDPR
          </p>
        </div>
      </div>
    </div>
  );
}
