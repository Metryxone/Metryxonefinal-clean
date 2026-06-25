import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect } from 'react';
import { Award, Share2, BadgeCheck, RefreshCw, Users, TrendingUp } from 'lucide-react';



function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PassportStatsPanel() {
  const [stats, setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/admin/passport/stats', { credentials: 'include' });
      if (r.status === 503) { setError('Career Passport flag is off (FF_CAREER_PASSPORT not set).'); return; }
      if (!r.ok) { setError(`HTTP ${r.status}`); return; }
      const d = await r.json();
      setStats(d.stats ?? {});
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award size={20} style={{ color: BRAND.primary }} />
          <h2 className="text-lg font-semibold text-gray-800">Career Passport Stats</h2>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5"
          style={{ borderColor: BRAND.border, color: BRAND.muted }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Total passports" value={stats.total_passports ?? 0} />
            <Stat label="Avg completeness" value={`${stats.avg_completeness ?? 0}%`} sub="across all users" />
            <Stat label="Avg strength" value={`${stats.avg_strength ?? 0}`} sub="out of 100" />
            <Stat label="Platform-verified assessments" value={stats.platform_verified_assessments ?? 0} sub="auto-synced from platform" />
            <Stat label="Active share links" value={stats.active_shares ?? 0} sub="non-expired, non-revoked" />
            <Stat label="Verifications received" value={stats.total_verifications ?? 0} sub="third-party attestations" />
          </div>

          <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: BRAND.border }}>
            <p className="font-semibold text-gray-700">Data Model — 12 tables</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
              {['cp_passport','cp_competencies','cp_assessments','cp_projects',
                'cp_achievements','cp_certifications','cp_experience','cp_learning_history',
                'cp_career_goals','cp_readiness_scores','cp_share_tokens','cp_verification_requests']
                .map(t => <span key={t} className="font-mono">{t}</span>)}
            </div>
          </div>

          <div className="rounded-xl border p-5 space-y-2 text-xs" style={{ borderColor: BRAND.border }}>
            <p className="font-semibold text-gray-700 mb-2">Permissions summary</p>
            {[
              ['Owner', 'Full CRUD — all 9 sections + settings'],
              ['Share viewer', 'Read-only — filtered by token sections array + section_visibility + is_visible'],
              ['Verifier', 'Attest one item via email token (14-day expiry)'],
              ['Platform', 'Auto-populate via /api/passport/sync — marks platform_verified=true'],
            ].map(([role, rule]) => (
              <div key={role} className="flex gap-3">
                <span className="font-semibold text-gray-600 w-24 shrink-0">{role}</span>
                <span className="text-gray-500">{rule}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border p-5 space-y-2 text-xs" style={{ borderColor: BRAND.border }}>
            <p className="font-semibold text-gray-700 mb-2">Privacy rules</p>
            {[
              ['Visibility levels', 'private (default) / connections / public — per section, owner-controlled'],
              ['Item level', 'is_visible boolean per item — owner-controlled'],
              ['PII', 'Contact details, salary — NEVER included in any shared view'],
              ['Scores', 'Only visible in shares when share_scores=true (passport-level flag)'],
              ['Default', 'All sections default to private until user explicitly changes visibility'],
            ].map(([rule, detail]) => (
              <div key={rule} className="flex gap-3">
                <span className="font-semibold text-gray-600 w-28 shrink-0">{rule}</span>
                <span className="text-gray-500">{detail}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border p-5 space-y-2 text-xs" style={{ borderColor: BRAND.border }}>
            <p className="font-semibold text-gray-700 mb-2">Verification framework</p>
            {[
              ['Self-declared', 'Default — user entered (gray badge in UI)'],
              ['Platform-verified', 'Auto-set by bridge sync from CAPADEX/FRP/competency (blue badge)'],
              ['Third-party verified', 'Email token flow — employer/issuer attests via link (green badge)'],
              ['Token expiry', '14 days — declined/expired requests do not block re-request'],
              ['Integrity hash', 'SHA-256(type:ref:userId) stored on platform-synced assessments'],
            ].map(([level, detail]) => (
              <div key={level} className="flex gap-3">
                <span className="font-semibold text-gray-600 w-32 shrink-0">{level}</span>
                <span className="text-gray-500">{detail}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border p-5 space-y-2 text-xs" style={{ borderColor: BRAND.border }}>
            <p className="font-semibold text-gray-700 mb-2">Analytics requirements</p>
            <p className="text-gray-500">Available via <code className="bg-gray-100 px-1 rounded">GET /api/passport/analytics</code> (owner-authenticated):</p>
            <ul className="list-disc list-inside text-gray-500 space-y-1 mt-1">
              <li>Completeness score (0–100, weighted per section)</li>
              <li>Strength score (0–100, verification rate × 40 + breadth × 30 + completeness × 30)</li>
              <li>Per-section item counts</li>
              <li>Verification breakdown (total / verified / platform-assessed / third-party)</li>
              <li>Sharing stats (active links, total views)</li>
              <li>Score trajectory (cp_readiness_scores history)</li>
              <li>Privacy rules declaration (programmatic reference)</li>
            </ul>
          </div>
        </>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
        </div>
      )}
    </div>
  );
}
