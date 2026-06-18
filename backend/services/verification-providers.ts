/**
 * Verification Provider Adapters — Phase 3
 *
 * Each adapter implements the contract:
 *   beginVerification(input) → { provider_url?, pending_id, status }
 *   completeVerification(payload) → { external_id, evidence, confidence_score, trust_weight, status, external_url }
 *
 * Adapters here are architectural stubs that establish:
 *   - OAuth flow shape (Credly / Accredible)
 *   - Document-locker readiness shape (DigiLocker / NAD)
 *   - ID-lookup shape (ICAI / ICSI / ICMAI)
 *   - Manual admin override (always available)
 *
 * Real credentials/secrets are NEVER stored in `verification_providers.config`
 * — only the public endpoint + scopes. Live OAuth client secrets live in
 * environment variables (e.g. CREDLY_CLIENT_SECRET) and are loaded at call
 * time. The stub returns `status: 'readiness'` for non-live providers so the
 * audit trail records the intent without faking a verification.
 */

export interface BeginInput {
  user_id:         string;
  subject_type:    string;
  subject_id?:     string | null;
  subject_canonical?: string | null;
  raw_input?:      string;
  membership_number?: string;
  redirect_uri?:   string;
}

export interface BeginOutput {
  status:        'redirect' | 'pending' | 'readiness' | 'noop';
  provider_url?: string;             // OAuth authorisation URL (when status='redirect')
  pending_id?:   string;             // provider-side correlation id
  message?:      string;
}

export interface CompleteInput {
  user_id:        string;
  callback_payload?: Record<string, unknown>;   // OAuth callback (?code=…)
  external_id?:   string;            // manual or lookup-supplied id
  evidence?:      Record<string, unknown>;
  admin_actor?:   string;
}

export interface CompleteOutput {
  status:           'verified' | 'pending' | 'failed';
  external_id:      string | null;
  external_url:     string | null;
  evidence:         Record<string, unknown>;
  confidence_score: number;
  trust_weight:     number;
  message?:         string;
}

export interface ProviderAdapter {
  code: string;
  begin:    (i: BeginInput) => Promise<BeginOutput>;
  complete: (i: CompleteInput) => Promise<CompleteOutput>;
}

// ── Credly OAuth ─────────────────────────────────────────────
// Standard 3-legged OAuth. Without CREDLY_CLIENT_ID present we return
// `readiness` so the caller surfaces a "configure provider" admin notice.
const credly: ProviderAdapter = {
  code: 'CREDLY',
  async begin(i) {
    const clientId = process.env.CREDLY_CLIENT_ID;
    if (!clientId) return { status: 'readiness', message: 'Credly OAuth client not configured (CREDLY_CLIENT_ID missing)' };
    const url = new URL('https://api.credly.com/v1/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'read');
    if (i.redirect_uri) url.searchParams.set('redirect_uri', i.redirect_uri);
    url.searchParams.set('state', `${i.user_id}::${i.subject_id || ''}`);
    return { status: 'redirect', provider_url: url.toString() };
  },
  async complete(i) {
    // In production: exchange `code` → access token → GET /me/badges → match badge → return.
    // Stub returns failed when no real callback payload, so we never fake-verify.
    if (!i.callback_payload?.code) {
      return { status: 'failed', external_id: null, external_url: null, evidence: {}, confidence_score: 0, trust_weight: 1.2, message: 'No OAuth code received' };
    }
    return {
      status: 'pending', external_id: String(i.callback_payload.code), external_url: null,
      evidence: { received_code: true }, confidence_score: 0.5, trust_weight: 1.2,
      message: 'Credly live exchange not implemented in this environment — left pending for admin review',
    };
  },
};

// ── Accredible OAuth ─────────────────────────────────────────
const accredible: ProviderAdapter = {
  code: 'ACCREDIBLE',
  async begin(i) {
    const clientId = process.env.ACCREDIBLE_CLIENT_ID;
    if (!clientId) return { status: 'readiness', message: 'Accredible OAuth client not configured' };
    const url = new URL('https://accredible.com/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'credentials:read');
    if (i.redirect_uri) url.searchParams.set('redirect_uri', i.redirect_uri);
    url.searchParams.set('state', `${i.user_id}::${i.subject_id || ''}`);
    return { status: 'redirect', provider_url: url.toString() };
  },
  async complete(i) {
    if (!i.callback_payload?.code) {
      return { status: 'failed', external_id: null, external_url: null, evidence: {}, confidence_score: 0, trust_weight: 1.2, message: 'No OAuth code received' };
    }
    return {
      status: 'pending', external_id: String(i.callback_payload.code), external_url: null,
      evidence: { received_code: true }, confidence_score: 0.5, trust_weight: 1.2,
      message: 'Accredible live exchange not implemented in this environment — left pending for admin review',
    };
  },
};

// ── DigiLocker readiness ─────────────────────────────────────
// India e-Governance doc-locker. Requires NeGD empanelment; this adapter
// records intent + returns readiness so the audit trail shows the request
// existed but no fake verification is created.
const digilocker: ProviderAdapter = {
  code: 'DIGILOCKER',
  async begin() {
    return { status: 'readiness', message: 'DigiLocker integration pending NeGD empanelment' };
  },
  async complete() {
    return {
      status: 'failed', external_id: null, external_url: null,
      evidence: { readiness: true }, confidence_score: 0, trust_weight: 1.2,
      message: 'DigiLocker not yet enabled — verification unavailable',
    };
  },
};

// ── NAD readiness ────────────────────────────────────────────
const nad: ProviderAdapter = {
  code: 'NAD',
  async begin() {
    return { status: 'readiness', message: 'National Academic Depository integration pending onboarding' };
  },
  async complete() {
    return {
      status: 'failed', external_id: null, external_url: null,
      evidence: { readiness: true }, confidence_score: 0, trust_weight: 1.2,
      message: 'NAD not yet enabled — verification unavailable',
    };
  },
};

// ── Professional body lookups (ICAI / ICSI / ICMAI) ──────────
// Membership number lookups. Real impl would call the institute's public
// member-search endpoint. Here we validate format + record a `pending`
// verification that an admin or scheduled job can confirm.
function makeProfessionalBody(code: string, label: string, pattern: RegExp): ProviderAdapter {
  return {
    code,
    async begin() {
      return { status: 'pending', message: `Submit your ${label} membership number to verify` };
    },
    async complete(i) {
      const mid = String(i.external_id || '').trim();
      if (!mid || !pattern.test(mid)) {
        return { status: 'failed', external_id: null, external_url: null, evidence: {}, confidence_score: 0, trust_weight: 1.15, message: `${label} membership number format invalid` };
      }
      // Live lookup not wired here — submit as pending for admin/scheduled
      // verification. Trust weight applied only when status flips to verified.
      return {
        status: 'pending', external_id: mid, external_url: null,
        evidence: { membership_number: mid, format_valid: true },
        confidence_score: 0.7, trust_weight: 1.15,
        message: `${label} membership number recorded — pending official lookup`,
      };
    },
  };
}

const icai  = makeProfessionalBody('ICAI',  'ICAI',  /^\d{6,7}$/);
const icsi  = makeProfessionalBody('ICSI',  'ICSI',  /^(ACS|FCS)\s?\d{3,6}$/i);
const icmai = makeProfessionalBody('ICMAI', 'ICMAI', /^(ACMA|FCMA)\s?\d{3,6}$/i);

// ── Manual admin override ────────────────────────────────────
// Admin attests on behalf of a user (uploaded certificate, in-person check).
// Trust weight intentionally lower than direct issuer verifications.
const manual: ProviderAdapter = {
  code: 'MANUAL',
  async begin() {
    return { status: 'pending', message: 'Manual verification — requires admin attestation' };
  },
  async complete(i) {
    if (!i.admin_actor) {
      return { status: 'failed', external_id: null, external_url: null, evidence: {}, confidence_score: 0, trust_weight: 0.85, message: 'Manual verification requires admin actor' };
    }
    return {
      status: 'verified', external_id: String(i.external_id || `manual:${Date.now()}`),
      external_url: null, evidence: { ...(i.evidence || {}), attested_by: i.admin_actor },
      confidence_score: 0.85, trust_weight: 0.85,
      message: `Manually verified by ${i.admin_actor}`,
    };
  },
};

const REGISTRY: Record<string, ProviderAdapter> = {
  CREDLY: credly, ACCREDIBLE: accredible,
  DIGILOCKER: digilocker, NAD: nad,
  ICAI: icai, ICSI: icsi, ICMAI: icmai,
  MANUAL: manual,
};

export function getProviderAdapter(code: string): ProviderAdapter | null {
  return REGISTRY[code] || null;
}

export function listProviderCodes(): string[] {
  return Object.keys(REGISTRY);
}
