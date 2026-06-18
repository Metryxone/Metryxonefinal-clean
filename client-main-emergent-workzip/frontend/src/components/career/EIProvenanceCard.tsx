/**
 * EIProvenanceCard — Phase 2 explainability surface.
 *
 * Additive UI card that renders the server-resolved canonical entities with
 * their provenance (source authority, URL, ranking/accreditation evidence,
 * confidence). Designed to sit next to the existing EIGauge / breakdown
 * without altering them.
 */
import React from 'react';
import { SectionCard } from './SectionCard';
import type { OfficialEIClient, ResolutionClient, TrustClient, ConfidenceClient, VersionQuadClient } from '@/lib/hooks/useHybridEI';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', amber: '#F59E0B', red: '#EF4444', muted: '#6B7280' };

function confColor(c: number) {
  if (c >= 0.85) return '#10B981';
  if (c >= 0.55) return BRAND.accent;
  if (c > 0)     return BRAND.amber;
  return BRAND.red;
}

function ConfidencePill({ value, via }: { value: number; via?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: `${confColor(value)}22`, color: confColor(value),
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: confColor(value) }} />
      {Math.round(value * 100)}%{via ? ` · ${via.replace('exact_', '').replace('_', ' ')}` : ''}
    </span>
  );
}

function EvidenceList({ evidence }: { evidence: Array<{ label: string; source?: string | null; source_url?: string | null }> }) {
  if (!evidence?.length) return null;
  return (
    <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {evidence.slice(0, 4).map((e, i) => (
        <li key={i} style={{ fontSize: 12, color: BRAND.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: BRAND.accent, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{e.label}</span>
          {e.source_url ? (
            <a href={e.source_url} target="_blank" rel="noopener noreferrer"
               style={{ color: BRAND.primary, fontSize: 11, textDecoration: 'underline' }}>
              source
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export interface EIProvenanceCardProps {
  resolution:   ResolutionClient | null;
  official:     OfficialEIClient | null;
  trusted?:     OfficialEIClient | null;
  trust?:       TrustClient | null;
  isOfficial:   boolean;
  isLoading:    boolean;
  fallbackUsed: boolean;
  previewScore: number;
  /** Phase 4 — composite confidence + uncertainty flags. Optional/back-compat. */
  confidenceDetail?: ConfidenceClient | null;
  /** Phase 4 — version quad for reproducibility footer. Optional/back-compat. */
  versions?:    VersionQuadClient | null;
}

/** Lookup verified credentials by subject_canonical (case-insensitive) for badge merging. */
function buildVerifiedIndex(trust?: TrustClient | null) {
  const idx = new Map<string, TrustClient['components'][number]>();
  if (!trust) return idx;
  for (const c of trust.components) {
    if (c.status === 'verified' && c.subject_canonical) {
      idx.set(`${c.subject_type}::${c.subject_canonical.toLowerCase()}`, c);
    }
  }
  return idx;
}

function VerifiedBadge({ provider, url }: { provider: string | null; url?: string | null }) {
  const inner = (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      background: '#10B98122', color: '#047857', border: '1px solid #10B98155',
      marginLeft: 4,
    }} title={`Verified via ${provider || 'authority'}`}>
      ✓ {provider || 'Verified'}
    </span>
  );
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>
    : inner;
}

export function EIProvenanceCard({ resolution, official, trusted, trust, isOfficial, isLoading, fallbackUsed, previewScore, confidenceDetail, versions }: EIProvenanceCardProps) {
  const verifiedIdx = buildVerifiedIndex(trust);
  const isVerified = (type: string, canonical?: string | null) =>
    canonical ? verifiedIdx.get(`${type}::${canonical.toLowerCase()}`) || null : null;
  const hasAny = !!resolution && (
    resolution.institution?.matched ||
    resolution.qualification?.matched ||
    resolution.skills.some(s => s.matched) ||
    resolution.certifications.some(c => c.matched)
  );

  const unresolvedCount =
    (resolution?.unresolved?.institution ? 1 : 0) +
    (resolution?.unresolved?.qualification ? 1 : 0) +
    (resolution?.unresolved?.skills?.length || 0) +
    (resolution?.unresolved?.certifications?.length || 0);

  const headerBadge = isLoading
    ? { text: 'Verifying…', color: BRAND.muted }
    : fallbackUsed
      ? { text: 'Preview mode', color: BRAND.amber }
      : isOfficial
        ? { text: 'Verified by MetryxOne', color: '#10B981' }
        : { text: 'Awaiting verification', color: BRAND.muted };

  return (
    <SectionCard
      title="Reference Intelligence — canonical resolution & provenance"
      action={
        <span style={{
          padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: `${headerBadge.color}22`, color: headerBadge.color,
        }}>{headerBadge.text}</span>
      }
    >
      {/* Score sync banner */}
      {official && !fallbackUsed && (
        <div style={{
          padding: 12, borderRadius: 10, background: '#F0F9FF', border: '1px solid #BAE6FD',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
        }}>
          <div>
            <div style={{ fontSize: 12, color: BRAND.muted }}>Employability Index™</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: BRAND.primary }}>{previewScore}</div>
          </div>
          <div style={{ fontSize: 24, color: BRAND.muted }}>→</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: BRAND.muted }}>Capability EI · {official.band}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#10B981' }}>{official.score}</div>
          </div>
          {trusted && trust && (
            <>
              <div style={{ fontSize: 24, color: BRAND.muted }}>·</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: BRAND.muted }}>Trusted EI · {trusted.band}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#047857' }}>{trusted.score}</div>
                <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 1 }}>
                  ×{trust.trust_multiplier.toFixed(3)} · trust {trust.trust_score}
                </div>
              </div>
            </>
          )}
          <div style={{ textAlign: 'right', borderLeft: '1px solid #BAE6FD', paddingLeft: 12, marginLeft: 12 }}>
            <div style={{ fontSize: 12, color: BRAND.muted }}>Profile confidence</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: confColor(official.profile_confidence_score / 100) }}>
              {official.profile_confidence_score}%
            </div>
          </div>
        </div>
      )}

      {/* Trust strip: verified / pending / revoked counts */}
      {trust && (trust.verified_count + trust.pending_count + trust.revoked_count) > 0 && (
        <div style={{
          padding: '8px 12px', borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0',
          fontSize: 12, color: '#065F46', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <strong>Verification status:</strong>
          <span>✓ {trust.verified_count} verified</span>
          {trust.pending_count > 0 && <span style={{ color: '#92400E' }}>⏳ {trust.pending_count} pending</span>}
          {trust.revoked_count > 0 && <span style={{ color: '#991B1B' }}>⊘ {trust.revoked_count} revoked</span>}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: BRAND.muted }}>
            Capability vs Trust are scored independently — verifications uplift Trust only.
          </span>
        </div>
      )}

      {!hasAny && !isLoading && (
        <div style={{ padding: 16, textAlign: 'center', color: BRAND.muted, fontSize: 13 }}>
          Add your institution, degree, skills, or certifications to enable reference verification.
        </div>
      )}

      {/* Institution */}
      {resolution?.institution?.matched && (
        <div style={{ padding: 12, borderRadius: 10, background: '#F9FAFB', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Institution</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: BRAND.primary }}>
                {resolution.institution.canonical_name}
                {(() => { const v = isVerified('institution', resolution.institution?.canonical_name); return v ? <VerifiedBadge provider={v.provider_code} url={v.external_url} /> : null; })()}
              </div>
              {resolution.institution.meta?.tier_computed && (
                <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>
                  Tier <strong style={{ color: BRAND.primary }}>{resolution.institution.meta.tier_computed}</strong>
                  {resolution.institution.meta.tier_overridden ? ' (admin-overridden)' : ''}
                </div>
              )}
            </div>
            <ConfidencePill value={resolution.institution.confidence} via={resolution.institution.matched_via} />
          </div>
          {/* Institution evidence pulled from official.signals */}
          {official?.signals.filter(s => s.type === 'institution').map((s, i) => (
            <EvidenceList key={i} evidence={s.evidence} />
          ))}
        </div>
      )}

      {/* Qualification */}
      {resolution?.qualification?.matched && (
        <div style={{ padding: 12, borderRadius: 10, background: '#F9FAFB', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Qualification</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: BRAND.primary }}>
                {resolution.qualification.canonical_name}
                {(() => { const v = isVerified('qualification', resolution.qualification?.canonical_name); return v ? <VerifiedBadge provider={v.provider_code} url={v.external_url} /> : null; })()}
              </div>
              <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>
                {resolution.qualification.meta?.qualification_type ?? ''}
                {resolution.qualification.meta?.nsqf_level ? ` · NSQF L${resolution.qualification.meta.nsqf_level}` : ''}
                {resolution.qualification.meta?.regulator ? ` · ${resolution.qualification.meta.regulator}` : ''}
              </div>
            </div>
            <ConfidencePill value={resolution.qualification.confidence} via={resolution.qualification.matched_via} />
          </div>
          {official?.signals.filter(s => s.type === 'qualification').map((s, i) => (
            <EvidenceList key={i} evidence={s.evidence} />
          ))}
        </div>
      )}

      {/* Skills + certs compact rows */}
      {resolution && (resolution.skills.some(s => s.matched) || resolution.certifications.some(c => c.matched)) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          {resolution.skills.some(s => s.matched) && (
            <div style={{ padding: 10, borderRadius: 10, background: '#F9FAFB' }}>
              <div style={{ fontSize: 11, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Skills · {resolution.skills.filter(s => s.matched).length} verified
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {resolution.skills.filter(s => s.matched).slice(0, 10).map((s, i) => (
                  <span key={i} title={`${s.matched_via} · ${Math.round(s.confidence * 100)}%`}
                    style={{
                      padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                      background: `${confColor(s.confidence)}22`, color: confColor(s.confidence),
                      border: `1px solid ${confColor(s.confidence)}44`,
                    }}>
                    {s.canonical_name}
                    {s.meta?.market_demand_score ? <span style={{ opacity: 0.7, marginLeft: 4 }}>· {s.meta.market_demand_score}</span> : null}
                  </span>
                ))}
              </div>
            </div>
          )}
          {resolution.certifications.some(c => c.matched) && (
            <div style={{ padding: 10, borderRadius: 10, background: '#F9FAFB' }}>
              <div style={{ fontSize: 11, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Certifications · {resolution.certifications.filter(c => c.matched).length} verified
              </div>
              {resolution.certifications.filter(c => c.matched).slice(0, 6).map((c, i) => {
                const v = isVerified('certification', c.canonical_name);
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: i < 5 ? '1px solid #F3F4F6' : 'none' }}>
                    <span style={{ color: BRAND.primary, fontWeight: 500 }}>
                      {c.canonical_name}
                      {v ? <VerifiedBadge provider={v.provider_code} url={v.external_url} /> : null}
                    </span>
                    <span style={{ fontSize: 10, color: BRAND.muted }}>
                      {c.meta?.tier ? String(c.meta.tier).replace('tier_', 'T') : '—'}
                      {c.meta?.issuer_name ? ` · ${c.meta.issuer_name}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Phase 4 — Confidence + uncertainty flags */}
      {confidenceDetail && (
        <div style={{
          padding: 10, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0',
          fontSize: 12, color: BRAND.muted, marginBottom: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ color: BRAND.primary }}>Scoring confidence</strong>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span>Profile <strong style={{ color: confColor(confidenceDetail.profile_confidence_score / 100) }}>{confidenceDetail.profile_confidence_score}%</strong></span>
              <span>Evidence <strong style={{ color: confColor(confidenceDetail.evidence_quality_score / 100) }}>{confidenceDetail.evidence_quality_score}%</strong></span>
              <span>Composite <strong style={{ color: confColor(confidenceDetail.composite_confidence / 100) }}>{confidenceDetail.composite_confidence}%</strong></span>
            </div>
          </div>
          {confidenceDetail.uncertainty_flags.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {confidenceDetail.uncertainty_flags.map((f, i) => {
                const sev = f.severity === 'high' ? { bg: '#FEE2E2', fg: '#991B1B' }
                          : f.severity === 'medium' ? { bg: '#FEF3C7', fg: '#92400E' }
                          : { bg: '#E0F2FE', fg: '#075985' };
                return (
                  <span key={i} title={f.basis} style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: sev.bg, color: sev.fg,
                  }}>⚠ {f.flag.replace(/_/g, ' ')}</span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Unresolved */}
      {unresolvedCount > 0 && (
        <div style={{
          padding: 10, borderRadius: 10, background: '#FEF3C7', border: '1px solid #FCD34D',
          fontSize: 12, color: '#92400E',
        }}>
          <strong>{unresolvedCount} item{unresolvedCount === 1 ? '' : 's'} sent to admin review</strong> — couldn't auto-match to the canonical reference library.
          {resolution?.unresolved.institution && <div style={{ marginTop: 4 }}>· Institution: {resolution.unresolved.institution}</div>}
          {resolution?.unresolved.qualification && <div>· Qualification: {resolution.unresolved.qualification}</div>}
          {resolution?.unresolved.skills?.length ? <div>· Skills: {resolution.unresolved.skills.slice(0, 5).join(', ')}{resolution.unresolved.skills.length > 5 ? '…' : ''}</div> : null}
          {resolution?.unresolved.certifications?.length ? <div>· Certifications: {resolution.unresolved.certifications.slice(0, 5).join(', ')}{resolution.unresolved.certifications.length > 5 ? '…' : ''}</div> : null}
        </div>
      )}

      {/* Phase 4 — Version reproducibility footer */}
      {versions && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #E5E7EB',
          fontSize: 10, color: BRAND.muted, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
          <span>EI engine <strong>v{versions.ei_version}</strong></span>
          <span>Ruleset <strong>v{versions.ruleset_version}</strong></span>
          {versions.taxonomy_version &&            <span>Taxonomy <strong>{versions.taxonomy_version}</strong></span>}
          {versions.institution_dataset_version && <span>Institutions <strong>{versions.institution_dataset_version}</strong></span>}
          {versions.confidence_model_version &&    <span>Confidence model <strong>v{versions.confidence_model_version}</strong></span>}
        </div>
      )}
    </SectionCard>
  );
}
