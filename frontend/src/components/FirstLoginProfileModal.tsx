import { useEffect, useState } from 'react';
import { X, Sparkles, ArrowRight, Clock } from 'lucide-react';
import { ProfileCompletenessCard } from './ProfileCompletenessCard';

const BRAND = { primary: '#0B3C5D', accent: '#4ECDC4', green: '#4ECDC4' };

const STORAGE_KEY = 'metryx_profile_setup';
const DISMISS_KEY = 'metryx_profile_setup_dismissed';
const SNOOZE_KEY = 'metryx_profile_setup_snoozed';

export interface ProfileSetupPayload {
  fullName?: string;
  sectionsFilled: string[];
  completeness: number;
  hasPhoto: boolean;
  source: 'registration' | 'login';
  ts: number;
}

export function saveProfileSetupFlag(payload: Omit<ProfileSetupPayload, 'ts'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, ts: Date.now() }));
    localStorage.removeItem(DISMISS_KEY);
    sessionStorage.removeItem(SNOOZE_KEY);
  } catch {}
}

export function clearProfileSetupFlag() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
    sessionStorage.removeItem(SNOOZE_KEY);
  } catch {}
}

function readPayload(): ProfileSetupPayload | null {
  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') return null;
    if (sessionStorage.getItem(SNOOZE_KEY) === '1') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProfileSetupPayload;
  } catch {
    return null;
  }
}

interface Props {
  onCompleteNow?: () => void;
}

export function FirstLoginProfileModal({ onCompleteNow }: Props) {
  const [payload, setPayload] = useState<ProfileSetupPayload | null>(null);

  useEffect(() => {
    const p = readPayload();
    if (p) {
      const displayed = Math.min(100, p.completeness + (p.hasPhoto ? 4 : 0));
      if (displayed < 100) setPayload(p);
    }
  }, []);

  if (!payload) return null;

  const displayed = Math.min(100, payload.completeness + (payload.hasPhoto ? 4 : 0));
  const firstName = (payload.fullName || '').split(' ')[0] || 'there';

  function dismiss() {
    clearProfileSetupFlag();
    setPayload(null);
  }

  function snooze() {
    try {
      sessionStorage.setItem(SNOOZE_KEY, '1');
    } catch {}
    setPayload(null);
  }

  function completeNow() {
    clearProfileSetupFlag();
    setPayload(null);
    onCompleteNow?.();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(11,60,93,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={snooze}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 flex items-center justify-between rounded-t-2xl"
          style={{ backgroundColor: `${BRAND.accent}10` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: BRAND.accent }}
            >
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-extrabold" style={{ color: BRAND.primary }}>
                Welcome to MetryxOne, {firstName}!
              </p>
              <p className="text-[10px] text-gray-500">
                You're {displayed}% there — let's get your aspirant profile to 100%
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={snooze}
            className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
            aria-label="Close"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Profile Completeness
              </span>
              <span className="text-sm font-extrabold" style={{ color: BRAND.accent }}>
                {displayed}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${displayed}%`, backgroundColor: BRAND.accent }}
              />
            </div>
          </div>

          <p className="text-[11px] text-gray-600 leading-relaxed">
            A complete profile gets you{' '}
            <span className="font-semibold" style={{ color: BRAND.primary }}>
              4× more visibility
            </span>{' '}
            to recruiters, sharper career recommendations, and unlocks every Metryx feature.
            Here's what's still pending:
          </p>

          <ProfileCompletenessCard
            sectionsFilled={payload.sectionsFilled}
            completeness={payload.completeness}
            hasPhoto={payload.hasPhoto}
            intro="Add these in the profile builder — most take less than 30 seconds:"
          />

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={completeNow}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: BRAND.accent }}
            >
              Complete my profile now
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={snooze}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              <Clock size={12} />
              Remind me later
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-[10px] text-gray-400 hover:text-gray-600 underline sm:self-center px-2"
            >
              Don't show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
