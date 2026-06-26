/**
 * useHybridEI — Phase 2 hybrid realtime EI hook.
 *
 * Flow:
 *   1. Client preview engine runs synchronously on every profile change
 *      (instant, optimistic, never blocks UI).
 *   2. Profile change is debounced; once stable, POST /api/ei/resolve fetches
 *      the server-authoritative official EI + canonical resolution + provenance.
 *   3. Once the server responds, hook exposes `official` alongside `preview`;
 *      consumers can show the verified score and provenance metadata.
 *
 * Failures of the server call are silent — the preview score remains valid.
 * The endpoint itself also has a deterministic fallback, so even when the
 * resolver fails internally the response shape is stable.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CareerProfile } from '@/lib/careerIntelligence';
import { runEmployabilityEngine, type EIOutput } from '@/lib/engines/employabilityEngine';

export interface ResolvedEntityClient {
  input:           string;
  matched:         boolean;
  canonical_id?:   string;
  canonical_name?: string;
  short_name?:     string | null;
  confidence:      number;
  matched_via:     'exact_canonical' | 'exact_alias' | 'fuzzy' | 'unresolved';
  meta?:           Record<string, any>;
  provenance?:     Array<{ source_authority: string; source_url?: string | null; confidence_score?: number | null; snapshot_date?: string | null; extracted_value?: any }>;
}

export interface ResolutionClient {
  institution?:    ResolvedEntityClient;
  qualification?:  ResolvedEntityClient;
  skills:          ResolvedEntityClient[];
  certifications:  ResolvedEntityClient[];
  occupation?:     ResolvedEntityClient;
  unresolved: {
    institution?: string; qualification?: string; occupation?: string;
    skills: string[]; certifications: string[];
  };
  profile_confidence_score: number;
  resolved_at: string;
}

export interface TrustComponentClient {
  subject_type: 'institution' | 'qualification' | 'skill' | 'certification' | 'occupation';
  subject_canonical: string | null;
  provider_code: string | null;
  status: 'verified' | 'pending' | 'failed' | 'revoked' | 'unverified';
  confidence: number;
  trust_weight: number;
  contribution: number;
  external_url?: string | null;
  verified_at?: string | null;
}
export interface TrustClient {
  trust_score: number;            // 0..100
  trust_multiplier: number;       // 0.5..1.3
  capability_score: number;       // raw capability EI (pre-trust)
  verified_count: number;
  pending_count: number;
  revoked_count: number;
  components: TrustComponentClient[];
  computed_at: string;
}

export interface OfficialEIClient {
  score:    number;
  band:     string;
  breakdown:{ completenessScore: number; technicalScore: number; softScore: number; experienceScore: number; certScore: number; projectScore: number };
  signals:  Array<{
    type: 'institution' | 'qualification' | 'skill' | 'certification' | 'occupation';
    canonical_name: string;
    matched_via: string;
    confidence: number;
    weight_contribution: number;
    evidence: Array<{ label: string; source?: string | null; source_url?: string | null; value?: any }>;
  }>;
  profile_confidence_score: number;
  fallback_used: boolean;
}

export interface ConfidenceClient {
  profile_confidence_score: number;
  evidence_quality_score:   number;
  composite_confidence:     number;
  uncertainty_flags:        Array<{ flag: string; severity: 'low'|'medium'|'high'; basis: string }>;
  model_version:            string;
}
export interface VersionQuadClient {
  ei_version:                  string;
  ruleset_version:             string;
  taxonomy_version:            string | null;
  institution_dataset_version: string | null;
  confidence_model_version:    string | null;
}

export interface HybridEIState {
  preview:        EIOutput;                  // client-side, instant
  official:       OfficialEIClient | null;   // server-side, debounced (capability)
  trusted:        OfficialEIClient | null;   // server-side, trust-weighted (Phase 3)
  trust:          TrustClient | null;        // null when no user context / no verifications
  resolution:     ResolutionClient | null;
  confidence:     number;                    // 0..100 (composite when available, falls back to resolver)
  confidenceDetail: ConfidenceClient | null; // Phase 4 — composite + uncertainty flags
  versions:       VersionQuadClient | null;  // Phase 4 — reproducibility quad
  isLoading:      boolean;                   // server in flight
  isOfficial:     boolean;                   // last successful server response received
  fallbackUsed:   boolean;
  lastSyncedAt:   number | null;
  refresh:        () => void;                // force-resync ignoring debounce
}

const DEBOUNCE_MS = 600;

function extractInput(p: CareerProfile | null | undefined) {
  if (!p) return null;
  const edu = Array.isArray(p.education) && p.education.length ? (p.education[0] as any) : null;
  const certs = (p.certifications || []).map((c: any) => typeof c === 'string' ? c : (c?.name || c?.title || '')).filter(Boolean);
  return {
    institution:    edu?.institution || edu?.school || null,
    qualification:  edu?.degree || edu?.qualification || null,
    skills:         p.skills?.technical || [],
    certifications: certs,
    soft_skill_count: (p.skills?.soft || []).length,
    completeness:     (p as any)?.competencyProfile?.completeness ?? 0,
    experience_count: (p.experience || []).length,
    project_count:    ((p as any)?.projects || []).length,
  };
}

function shallowKey(p: CareerProfile | null | undefined): string {
  const i = extractInput(p);
  if (!i) return '';
  return JSON.stringify([
    i.institution, i.qualification,
    (i.skills || []).slice().sort(),
    (i.certifications || []).slice().sort(),
    i.completeness, i.experience_count, i.project_count, i.soft_skill_count,
  ]);
}

export function useHybridEI(profile: CareerProfile | null | undefined): HybridEIState {
  const preview = useMemo(() => runEmployabilityEngine({ profile }), [profile]);

  const [official, setOfficial] = useState<OfficialEIClient | null>(null);
  const [trusted, setTrusted] = useState<OfficialEIClient | null>(null);
  const [trust, setTrust] = useState<TrustClient | null>(null);
  const [resolution, setResolution] = useState<ResolutionClient | null>(null);
  const [confidenceDetail, setConfidenceDetail] = useState<ConfidenceClient | null>(null);
  const [versions, setVersions] = useState<VersionQuadClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // for refresh()

  const inputKey = useMemo(() => shallowKey(profile), [profile]);
  const inflight = useRef<AbortController | null>(null);
  const reqSeq   = useRef(0);          // monotonic sequence — only latest commits state
  const latestCommitted = useRef(0);   // last sequence whose response committed state

  useEffect(() => {
    if (!profile || !inputKey) { setOfficial(null); setTrusted(null); setTrust(null); setResolution(null); setConfidenceDetail(null); setVersions(null); return; }
    const i = extractInput(profile);
    if (!i) return;

    const mySeq = ++reqSeq.current;
    let ac: AbortController | null = null;

    const t = setTimeout(async () => {
      // Abort any prior in-flight request before issuing this one.
      inflight.current?.abort();
      ac = new AbortController();
      inflight.current = ac;
      setIsLoading(true);
      try {
        // Identity is established server-side from the authenticated session/token.
        // We never send a client-supplied X-User-Id header (it is ignored and would
        // be a spoofable identity vector).
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const r = await fetch('/api/ei/resolve', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            institution: i.institution,
            qualification: i.qualification,
            skills: i.skills,
            certifications: i.certifications,
            completeness: i.completeness,
            soft_skill_count: i.soft_skill_count,
            experience_count: i.experience_count,
            project_count: i.project_count,
          }),
          signal: ac.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        // Sequence guard: only commit if this is still the most recent request
        // AND a later response hasn't already committed (out-of-order responses).
        if (mySeq === reqSeq.current && mySeq > latestCommitted.current && !ac.signal.aborted) {
          latestCommitted.current = mySeq;
          setResolution(data.resolution || null);
          setOfficial(data.official_ei || null);
          setTrusted(data.trusted_ei || null);
          setTrust(data.trust || null);
          setConfidenceDetail(data.confidence || null);
          setVersions(data.versions || null);
          setLastSyncedAt(Date.now());
        }
      } catch (e) {
        if ((e as any)?.name !== 'AbortError') {
          // silent — preview stays
          console.warn('[useHybridEI] sync failed', e);
        }
      } finally {
        if (inflight.current === ac) { setIsLoading(false); inflight.current = null; }
      }
    }, DEBOUNCE_MS);

    // Cleanup runs immediately on dependency change: cancel BOTH the pending
    // debounce timer AND any in-flight fetch to eliminate the stale-response race.
    return () => {
      clearTimeout(t);
      if (ac) ac.abort();
      else inflight.current?.abort();
    };
  }, [inputKey, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    preview,
    official,
    trusted,
    trust,
    resolution,
    confidence: confidenceDetail?.composite_confidence ?? resolution?.profile_confidence_score ?? 0,
    confidenceDetail,
    versions,
    isLoading,
    isOfficial: !!official && !official.fallback_used,
    fallbackUsed: !!official?.fallback_used,
    lastSyncedAt,
    refresh: () => setTick(t => t + 1),
  };
}
