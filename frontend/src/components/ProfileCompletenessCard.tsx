import { Sparkles } from 'lucide-react';

const BRAND = { primary: '#0B3C5D', accent: '#4ECDC4' };

export const PROFILE_SECTION_META: Array<{
  key: string;
  label: string;
  points: number;
  tier: 'core' | 'bonus';
}> = [
  { key: 'personal', label: 'Full name', points: 12, tier: 'core' },
  { key: 'email', label: 'Email address', points: 12, tier: 'core' },
  { key: 'phone', label: 'Phone number', points: 8, tier: 'core' },
  { key: 'summary', label: 'Professional summary', points: 12, tier: 'core' },
  { key: 'education', label: 'Education history', points: 14, tier: 'core' },
  { key: 'experience', label: 'Work experience', points: 18, tier: 'core' },
  { key: 'technical_skills', label: 'Technical skills', points: 10, tier: 'core' },
  { key: 'soft_skills', label: 'Soft skills', points: 8, tier: 'core' },
  { key: 'photo', label: 'Profile photo', points: 4, tier: 'bonus' },
  { key: 'linkedin', label: 'LinkedIn profile URL', points: 4, tier: 'bonus' },
  { key: 'projects', label: 'Projects / portfolio', points: 4, tier: 'bonus' },
  { key: 'certifications', label: 'Certifications', points: 4, tier: 'bonus' },
  { key: 'achievements', label: 'Achievements / awards', points: 3, tier: 'bonus' },
  { key: 'tools', label: 'Tools & platforms', points: 3, tier: 'bonus' },
  { key: 'github', label: 'GitHub profile URL', points: 3, tier: 'bonus' },
  { key: 'languages', label: 'Spoken languages', points: 3, tier: 'bonus' },
];

interface Props {
  sectionsFilled: string[];
  completeness: number;
  hasPhoto?: boolean;
  title?: string;
  intro?: string;
  compact?: boolean;
}

export function ProfileCompletenessCard({
  sectionsFilled,
  completeness,
  hasPhoto = false,
  title = 'Make your profile 100%',
  intro = 'Add these to your CV (or fill them in below) to strengthen your aspirant profile:',
  compact = false,
}: Props) {
  const effectiveFilled = hasPhoto ? [...sectionsFilled, 'photo'] : sectionsFilled;
  const filledSet = new Set(effectiveFilled);
  const displayedCompleteness = Math.min(100, completeness + (hasPhoto ? 4 : 0));
  const missing = PROFILE_SECTION_META.filter(m => !filledSet.has(m.key));
  const totalRemainingPoints = missing.reduce((s, m) => s + m.points, 0);
  const pointsToHundred = Math.max(0, 100 - displayedCompleteness);

  if (displayedCompleteness >= 100 || missing.length === 0) return null;

  return (
    <div
      className={`rounded-xl border ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}
      style={{ borderColor: `${BRAND.primary}20`, backgroundColor: `${BRAND.primary}06` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={compact ? 13 : 15} style={{ color: BRAND.primary }} />
          <span
            className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold`}
            style={{ color: BRAND.primary }}
          >
            {title}
          </span>
        </div>
        <span
          className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}
        >
          +{Math.min(totalRemainingPoints, pointsToHundred)} pts available
        </span>
      </div>
      <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-gray-500 mb-2.5`}>{intro}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
        {missing.map(m => (
          <div key={m.key} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: m.tier === 'core' ? '#f59e0b' : '#d1d5db' }}
              />
              <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-gray-600 truncate`}>
                {m.label}
              </span>
              {m.tier === 'core' && (
                <span className="text-[8px] font-semibold uppercase text-amber-600 flex-shrink-0">
                  core
                </span>
              )}
            </div>
            <span
              className="text-[9px] font-semibold flex-shrink-0"
              style={{ color: BRAND.accent }}
            >
              +{m.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
