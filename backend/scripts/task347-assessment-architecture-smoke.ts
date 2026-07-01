import { Pool } from 'pg';
import {
  classifyClarityBank, bloomCoverage, computeGroupNorms,
  ensureCountryCohortConstraint, registerCountryCohorts, listCountryCohorts,
  type NormGroupType,
} from '../services/assessment-architecture-engine';
import { registerCodeEmbeddedPrompts, registryCoverage, resolvePrompt } from '../services/prompt-registry-activation';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const out: Record<string, unknown> = {};
  out.bloom_classify = await classifyClarityBank(pool);
  out.bloom_coverage = await bloomCoverage(pool);
  const types: NormGroupType[] = ['gender', 'education_tier', 'competitive_exam', 'country'];
  out.norm_groups = {};
  for (const t of types) (out.norm_groups as Record<string, unknown>)[t] = await computeGroupNorms(pool, t);
  out.country_constraint = await ensureCountryCohortConstraint(pool);
  out.country_register = await registerCountryCohorts(pool, [
    { id: 'coh_country_in', name: 'India — National Benchmark Cohort (scaffold)', geography: 'IN' },
    { id: 'coh_country_us', name: 'United States — National Benchmark Cohort (scaffold)', geography: 'US' },
  ]);
  out.country_list = await listCountryCohorts(pool);
  out.prompts_register = await registerCodeEmbeddedPrompts(pool);
  out.prompts_coverage = await registryCoverage(pool);
  out.prompt_resolve = await resolvePrompt(pool, 'capadex.reflection.summary', { template: 'FALLBACK', system_context: null });
  out.prompt_resolve_missing = await resolvePrompt(pool, 'nonexistent.slug', { template: 'FALLBACK-LITERAL', system_context: null });
  console.log(JSON.stringify(out, null, 2));
  await pool.end();
}
main().catch((e) => { console.error('SMOKE FAILED', e); process.exit(1); });
