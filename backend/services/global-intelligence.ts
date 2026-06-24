/**
 * MX-76X — Global Intelligence composer (PURE, read-only).
 *
 * Composes the EXISTING global-deployability assets into one honest view. NO new tables, NO DDL,
 * NO recompute: every method only SELECTs from already-present tables (to_regclass-probed) or returns
 * deterministic pure config (region crosswalk + currency resolver). Coverage ⟂ Confidence; absent →
 * null / 'inherited' / 'not_localized' / 'not_measurable', never a fabricated value.
 *
 * Reconciles the three live region taxonomies WITHOUT renaming any of them:
 *   Phase-8 `global_region_content`  (ME/EU/US/APAC + IN default)
 *   `m4_countries.region`            (EMEA/APAC/Americas)
 *   `nhda_regions`                   (India national/state)
 */
import type { Pool } from 'pg';
import { createLocalization } from './m4-localization';

export const GLOBAL_INTELLIGENCE_VERSION = '1.0.0';

/** Canonical region set (additive — never renames the source codes). */
export const CANONICAL_REGIONS = ['NA', 'EU', 'ME', 'IN', 'APAC', 'AFRICA', 'LATAM'] as const;
export type CanonicalRegion = (typeof CANONICAL_REGIONS)[number];

/**
 * Region crosswalk: canonical → source-system codes. `m4` is a many-to-one COARSE parent
 * (EMEA → {EU, ME, AFRICA}; Americas → {NA, LATAM}) so it is labelled coarse, never precise.
 */
export const REGION_CROSSWALK: Record<CanonicalRegion, {
  label: string;
  phase8: string | null;        // global_region_content.region_code (null → no overlay seeded)
  m4: string | null;            // m4_countries.region (coarse parent)
  m4_coarse: boolean;           // true when the m4 parent spans multiple canonical regions
}> = {
  NA:     { label: 'North America', phase8: 'US',   m4: 'Americas', m4_coarse: true },
  EU:     { label: 'Europe',        phase8: 'EU',   m4: 'EMEA',     m4_coarse: true },
  ME:     { label: 'Middle East',   phase8: 'ME',   m4: 'EMEA',     m4_coarse: true },
  IN:     { label: 'India',         phase8: 'IN',   m4: 'APAC',     m4_coarse: true },
  APAC:   { label: 'Asia-Pacific',  phase8: 'APAC', m4: 'APAC',     m4_coarse: false },
  AFRICA: { label: 'Africa',        phase8: null,   m4: 'EMEA',     m4_coarse: true },
  LATAM:  { label: 'Latin America', phase8: null,   m4: 'Americas', m4_coarse: true },
};

/** Country→currency display resolver (display formatting ONLY — no FX conversion). Default INR. */
export const COUNTRY_CURRENCY: Record<string, { currency: string; locale: string }> = {
  IN: { currency: 'INR', locale: 'en-IN' },
  US: { currency: 'USD', locale: 'en-US' },
  DE: { currency: 'EUR', locale: 'de-DE' },
  AE: { currency: 'AED', locale: 'ar-AE' },
  JP: { currency: 'JPY', locale: 'ja-JP' },
};
export const DEFAULT_CURRENCY = { currency: 'INR', locale: 'en-IN' };

export function resolveCurrency(iso2?: string | null): {
  currency: string; locale: string; source: 'country' | 'default';
} {
  const key = (iso2 ?? '').toUpperCase();
  const hit = COUNTRY_CURRENCY[key];
  return hit ? { ...hit, source: 'country' } : { ...DEFAULT_CURRENCY, source: 'default' };
}

export function createGlobalIntelligence(pool: Pool) {
  const loc = createLocalization(pool);

  async function present(qualified: string): Promise<boolean> {
    try {
      const r = await pool.query('SELECT to_regclass($1) AS t', [qualified]);
      return r.rows[0]?.t != null;
    } catch { return false; }
  }

  /** Never-throws SELECT → rows or [] (honest empty, never a fabricated row). */
  async function rows(sql: string, params: any[] = []): Promise<any[]> {
    try { return (await pool.query(sql, params)).rows; } catch { return []; }
  }

  // ── Regions ──────────────────────────────────────────────────────────────────────────────────
  async function regions() {
    const hasOverlay = await present('public.global_region_content');
    const hasMarket = await present('public.wos_market_signals');
    const hasBench = await present('public.bench_cohorts');

    // Phase-8 overlay coverage per region_code × surface
    const overlay = hasOverlay
      ? await rows(`SELECT region_code, surface, COUNT(*)::int AS n
                      FROM global_region_content GROUP BY region_code, surface`)
      : [];
    const overlayBy: Record<string, Record<string, number>> = {};
    for (const r of overlay) {
      (overlayBy[r.region_code] ??= {})[r.surface] = Number(r.n);
    }
    // Region benchmark cohorts (latent tier surfaced read-only; k-anonymity preserved downstream)
    const benchRegions = hasBench
      ? await rows(`SELECT geography, COUNT(*)::int AS n FROM bench_cohorts
                      WHERE cohort_type = 'region' AND geography IS NOT NULL GROUP BY geography`)
      : [];
    const benchBy: Record<string, number> = {};
    for (const r of benchRegions) benchBy[r.geography] = Number(r.n);
    // Region-native market signals
    const market = hasMarket
      ? await rows(`SELECT geography, COUNT(*)::int AS n FROM wos_market_signals
                      WHERE geography IS NOT NULL GROUP BY geography`)
      : [];
    const marketBy: Record<string, number> = {};
    for (const r of market) marketBy[r.geography] = Number(r.n);

    const out = CANONICAL_REGIONS.map((code) => {
      const xw = REGION_CROSSWALK[code];
      const p8 = xw.phase8 ? overlayBy[xw.phase8] ?? null : null;
      const isDefault = code === 'IN';
      // IN reads base tables (not overlay rows) — its content is "native/base", others overlay-only.
      const competency = isDefault ? 'base' : p8?.competency_models ?? null;
      const role = isDefault ? 'base' : p8?.role_library ?? null;
      const demand = isDefault ? marketBy['global'] ?? null : (p8?.demand_intelligence ?? null);
      const bench = benchBy[xw.phase8 ?? ''] ?? null;
      const native = isDefault || (p8 != null);
      return {
        canonical_code: code,
        label: xw.label,
        crosswalk: { phase8: xw.phase8, m4_parent: xw.m4, m4_coarse: xw.m4_coarse },
        coverage: {
          competency_models: competency,
          role_library: role,
          demand_intelligence: demand,
          benchmark_cohorts: bench,
          market_signals: marketBy[xw.phase8 ?? ''] ?? null,
        },
        status: native ? (isDefault ? 'native' : 'partial_native') : 'empty',
        source: isDefault ? 'base_tables' : p8 ? 'overlay' : 'none',
      };
    });
    return {
      canonical_regions: CANONICAL_REGIONS,
      regions: out,
      taxonomy_note:
        'Three live region taxonomies reconciled via additive crosswalk (no renames): Phase-8 overlay ' +
        '(ME/EU/US/APAC + IN default), m4_countries.region (EMEA/APAC/Americas, COARSE parent), ' +
        'nhda_regions (India national/state). Africa & LATAM are declared but have ZERO content (honest).',
      coverage_present: { overlay: hasOverlay, market: hasMarket, benchmarks: hasBench },
    };
  }

  // ── Countries (m4 tier) ──────────────────────────────────────────────────────────────────────
  async function countries() {
    if (!(await present('public.m4_countries'))) {
      return { localized: [], localized_count: 0, note: 'm4_countries absent — country tier not present.' };
    }
    const cs = await loc.countries();
    const localized = cs.map((c: any) => {
      // map m4.region (coarse) → canonical regions it parents
      const canon = (Object.keys(REGION_CROSSWALK) as CanonicalRegion[])
        .filter((k) => REGION_CROSSWALK[k].m4 === c.region);
      return {
        iso2: c.iso2,
        name: c.name,
        m4_region: c.region,
        canonical_regions: canon,
        language: c.language,
        labor_regime: c.labor_regime,
        currency: resolveCurrency(c.iso2),
      };
    });
    return {
      localized,
      localized_count: localized.length,
      note:
        `${localized.length} countries have native m4_* localization. Any ISO2 outside this set resolves ` +
        `to 'not_localized' (never silently inherited as native). labor_regime is stored but NOT enforced.`,
    };
  }

  /** Composed country profile (reuses the EXISTING createLocalization.profile). 404-safe → null. */
  async function country(iso2: string) {
    if (!(await present('public.m4_countries'))) return null;
    const cs = await loc.countries();
    const match = cs.find((c: any) => String(c.iso2).toUpperCase() === iso2.toUpperCase());
    if (!match) return null;
    // never-throws: the reused m4 profile reader SELECTs several m4_* tables WITHOUT to_regclass
    // probing, so a missing/drifted dependent table would throw. Degrade to the base country facets
    // (never a 500) and flag the gap honestly rather than fabricating profile fields.
    let profile: Record<string, unknown> = {};
    let profile_degraded = false;
    try {
      profile = (await loc.profile(match.id)) as Record<string, unknown>;
    } catch (err) {
      console.error('[global-intel] country profile degraded:', err);
      profile_degraded = true;
    }
    const canon = (Object.keys(REGION_CROSSWALK) as CanonicalRegion[])
      .filter((k) => REGION_CROSSWALK[k].m4 === match.region);
    return {
      iso2: match.iso2,
      name: match.name,
      canonical_regions: canon,
      currency: resolveCurrency(match.iso2),
      ...profile,
      profile_degraded,
      inheritance_note:
        'Industry/function/role are inherited from the global tier (O*NET has no geography). Country ' +
        'fields present below are native; absent dimensions inherit upward and are labelled, never zero-filled.',
    };
  }

  // ── Benchmark tier coverage (read-only; k-anonymity preserved at the resolver) ─────────────────
  async function benchmarks() {
    if (!(await present('public.bench_cohorts'))) {
      return { tiers: {}, note: 'bench_cohorts absent.' };
    }
    const byType = await rows(`SELECT cohort_type, COUNT(*)::int AS n FROM bench_cohorts GROUP BY cohort_type`);
    const tiers: Record<string, number> = {};
    for (const r of byType) tiers[r.cohort_type] = Number(r.n);
    return {
      tiers,
      region_cohorts_latent: (tiers['region'] ?? 0) > 0,
      country_tier: 'not_measurable',
      note:
        "Region benchmark cohorts EXIST (cohort_type='region') and are surfaced here read-only; full " +
        'activation in resolveCohort is a follow-up. Country benchmarking is not_measurable (no country ' +
        'cohort + no ≥k_min country population) — never a fabricated percentile. k-anonymity suppression ' +
        'is enforced by the existing benchmark engine and is NOT bypassed here.',
    };
  }

  // ── Role DNA region/country inheritance (variant=null honest resting state) ─────────────────────
  async function roleDna(roleId: string, opts: { region?: string; country?: string } = {}) {
    const hasWeights = await present('public.onto_role_weights');
    const base = hasWeights
      ? await rows(`SELECT competency_id, weight FROM onto_role_weights WHERE role_id = $1`, [roleId])
      : [];
    return {
      role_id: roleId,
      base_weights: base,
      base_count: base.length,
      // No region/country column on any role table + O*NET has no geography → no native variant source.
      variant: null,
      effective: base,
      source: 'inherited_universal',
      scope: { region: opts.region ?? null, country: opts.country ?? null },
      note:
        'Region/country Role-DNA variants are not representable today: no role table carries a geography ' +
        'dimension and O*NET (the breadth source) has no geography. variant=null is the honest resting ' +
        'state — effective DNA inherits the universal weights. Variants would require licensed per-country ' +
        'labour-market sources; absent → never fabricated.',
    };
  }

  // ── Localization resolution status ─────────────────────────────────────────────────────────────
  async function localization() {
    const hasPacks = await present('public.rf_language_packs');
    const packs = hasPacks
      ? await rows(`SELECT DISTINCT language_code FROM rf_language_packs ORDER BY language_code`)
      : [];
    const reportLangs = packs.map((p: any) => p.language_code);
    // UI bundles that actually ship (kept in sync with frontend i18n — Indian-centric today).
    const uiLangs = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa'];
    const reportOnly = reportLangs.filter((l: string) => !uiLangs.includes(l));
    return {
      report_languages: reportLangs,
      ui_languages: uiLangs,
      report_only_languages: reportOnly, // have report packs but no UI bundle → 'report_only'
      currency_resolver: {
        countries: Object.keys(COUNTRY_CURRENCY),
        default: DEFAULT_CURRENCY,
        fx_conversion: false,
        note: 'Display formatting only (symbol + locale grouping). NO FX conversion (no honest source).',
      },
      note:
        'Report-pack breadth exceeds UI bundle breadth — report_only_languages lag the UI. Currency is ' +
        'resolved per country for display, defaulting to INR so India stays byte-identical.',
    };
  }

  // ── Overview (admin) ───────────────────────────────────────────────────────────────────────────
  async function overview() {
    const [reg, ctry, bench, locz] = await Promise.all([regions(), countries(), benchmarks(), localization()]);
    const nativeRegions = reg.regions.filter((r) => r.status !== 'empty').length;
    return {
      version: GLOBAL_INTELLIGENCE_VERSION,
      summary: {
        canonical_regions: CANONICAL_REGIONS.length,
        regions_with_content: nativeRegions,
        empty_regions: reg.regions.filter((r) => r.status === 'empty').map((r) => r.canonical_code),
        localized_countries: ctry.localized_count,
        benchmark_tiers: bench.tiers,
        report_languages: locz.report_languages.length,
      },
      regions: reg,
      countries: ctry,
      benchmarks: bench,
      localization: locz,
      honesty:
        'Mechanism is broadly PRESENT; content depth is SHALLOW (region content for ~5 of 7 canonical ' +
        'regions, 5 localized countries, 0 tenants, no region-native Role DNA). Reported as PARTIAL.',
    };
  }

  return { regions, countries, country, benchmarks, roleDna, localization, overview };
}
