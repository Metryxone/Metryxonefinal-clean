/* MX-700 Phase 1.41 — Platform Lifecycle Automation & Continuous Governance service-level validation (dev only).
 * Exercises every read engine + the WRITE paths (register policy, set policy enabled, capture governance
 * snapshot) against the REAL 1.37/1.38/1.39/1.40 substrate, then deletes its own test rows.
 * NOT a flag-OFF path test (it calls the services directly on purpose; the flag-OFF 503 path is asserted
 * by the HTTP smoke separately).
 *
 * Honesty assertions: the 6 automation scores are SEPARATE measured ratios (or null), there is NO
 * composited "overall"/"composite" score, compliance is MEASURED on-demand (not persisted), drift deltas
 * are null when a side is unmeasurable (null ≠ zero), and ensure-schema runs only on WRITE paths. */
import { Pool } from 'pg';
import { schemaReady as foundationSchemaReady } from '../services/platform-lifecycle';
import {
  getLifecycleAutomation, getContinuousGovernance, evaluateCompliance, getOrchestration,
  getContinuousValidation, getQualityGates, getAutomationMetrics, getAutomationSummary,
  getPolicyDefinitions, registerPolicy, setPolicyEnabled,
  captureGovernanceSnapshot, getGovernanceSnapshots, getGovernanceDrift, getGovernanceAudit,
} from '../services/platform-lifecycle-automation';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ok = (c: boolean, m: string) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
const isNumOrNull = (v: unknown) => v === null || typeof v === 'number';

(async () => {
  const policyUids: string[] = [];
  const snapUids: string[] = [];
  try {
    const founded = await foundationSchemaReady(pool);
    console.log(`Foundation schema ready: ${founded} (if false, run POST /api/admin/platform-lifecycle/discover first)\n`);

    // PART 3: built-in policy set is ALWAYS available (in code), independent of Foundation.
    const defs0 = await getPolicyDefinitions(pool);
    ok(defs0.ready && defs0.builtin_count >= 13, `built-in policy set present (${defs0.builtin_count} policies)`);
    ok(defs0.custom_count === null || typeof defs0.custom_count === 'number', 'custom_count null until registry built (built ≠ populated; null ≠ zero)');

    // PART 3 WRITE: register a curated custom policy (owns ensure-schema), then disable it.
    const reg = await registerPolicy(pool, {
      policyKey: 'validation.doc_required_141', title: 'VALIDATION doc-required', policyDomain: 'documentation',
      ruleKind: 'field_present', ruleField: 'documentation_reference', severity: 'warn', actor: 'validation-1.41',
    });
    ok(reg.ok && !!reg.policy_uid, `registerPolicy -> ${reg.policy_uid}`);
    if (reg.policy_uid) policyUids.push(reg.policy_uid);

    // injection-safety: a non-whitelisted field must be rejected, never interpolated.
    const bad = await registerPolicy(pool, { policyKey: 'validation.bad_141', title: 'bad', policyDomain: 'x', ruleKind: 'field_present', ruleField: 'created_at; DROP TABLE x' });
    ok(!bad.ok && bad.error === 'rule_field_not_in_safe_whitelist', 'custom policy field guarded by exact-match whitelist (injection-safe)');
    // built-in prefix is reserved.
    const resv = await registerPolicy(pool, { policyKey: 'builtin.x', title: 'x', policyDomain: 'x', ruleKind: 'count_threshold' });
    ok(!resv.ok && resv.error === 'reserved_builtin_prefix', 'builtin.* policy_key prefix reserved');

    const setOff = reg.policy_uid ? await setPolicyEnabled(pool, reg.policy_uid, false) : { ok: false };
    ok(setOff.ok, 'setPolicyEnabled toggles a custom policy');
    if (reg.policy_uid) await setPolicyEnabled(pool, reg.policy_uid, true);

    const defs1 = await getPolicyDefinitions(pool);
    ok(defs1.ready && defs1.custom_registry_present && (defs1.custom_count ?? 0) >= 1, `custom registry read-back (${defs1.custom_count} custom)`);

    if (!founded) {
      console.log('\nFoundation not discovered — automation/governance/compliance/validation/metrics correctly return ready:false. Skipping Foundation-dependent measured assertions.');
    } else {
      // PART 1: automation checks composed read-only.
      const auto = await getLifecycleAutomation(pool);
      ok(auto.ready && auto.checks && isNumOrNull(auto.pass_rate) && Array.isArray(auto.composes), `automation checks MEASURED (pass_rate=${auto.pass_rate})`);

      // PART 2: governance areas composed.
      const gov = await getContinuousGovernance(pool);
      ok(gov.ready && gov.areas && isNumOrNull(gov.pass_rate), `governance areas MEASURED (pass_rate=${gov.pass_rate})`);

      // PART 4: compliance MEASURED on-demand vs live registry; per-domain SEPARATE.
      const comp = await evaluateCompliance(pool);
      ok(comp.ready && comp.policies.length >= 13 && comp.compliance_by_domain && isNumOrNull(comp.overall_compliance), `compliance evaluated (${comp.totals.evaluated}/${comp.totals.policies} policies, overall=${comp.overall_compliance})`);
      ok(comp.policies.every((p: any) => isNumOrNull(p.compliance_ratio) && isNumOrNull(p.violations)), 'each policy compliance_ratio/violations number|null (unmeasurable ≠ compliant)');

      // PART 5: orchestration coordinates the 4 tiers read-only.
      const orch = await getOrchestration(pool);
      ok(orch.ready && Array.isArray(orch.tiers) && orch.tiers.length === 4, 'orchestration coordinates 4 tiers (1.37/1.38/1.39/1.40)');

      // PART 6: continuous validation composes 1.39 + 1.40.
      const val = await getContinuousValidation(pool);
      ok(val.ready && val.checks && isNumOrNull(val.validation_success), `continuous validation MEASURED (success=${val.validation_success})`);

      // PART 7: quality gates — Gate-Pass ≠ Production-Ready; regression_risk is structural.
      const gates = await getQualityGates(pool);
      ok(gates.ready && gates.gates && gates.gates.regression_risk.status === 'structural', 'quality gates composed; regression_risk is STRUCTURAL (not runtime-measured)');
      ok(isNumOrNull(gates.gate_pass_rate), `gate_pass_rate number|null (${gates.gate_pass_rate})`);

      // PART 9: metrics — SIX SEPARATE scores, NO composite.
      const m = await getAutomationMetrics(pool);
      const scoreKeys = ['automation_health', 'compliance_health', 'governance_health', 'validation_success', 'repository_stability', 'lifecycle_stability'];
      ok(m.ready && scoreKeys.every((k) => isNumOrNull(m.scores[k])), 'all 6 automation scores number|null (separate axes)');
      ok(!Object.prototype.hasOwnProperty.call(m.scores, 'overall') && !Object.prototype.hasOwnProperty.call(m.scores, 'composite'), 'NO composited "overall"/"composite" score (honesty)');
      console.log('  scores:', JSON.stringify(m.scores));

      // PART 8: capture snapshots + drift.
      const s1 = await captureGovernanceSnapshot(pool, 'validation-1.41');
      ok(s1.ok && typeof s1.snapshot_uid === 'string', `governance snapshot #1 captured (${s1.snapshot_uid})`);
      if (s1.snapshot_uid) snapUids.push(s1.snapshot_uid);
      const s2 = await captureGovernanceSnapshot(pool, 'validation-1.41');
      ok(s2.ok, `governance snapshot #2 captured (${s2.snapshot_uid})`);
      if (s2.snapshot_uid) snapUids.push(s2.snapshot_uid);
      const snaps = await getGovernanceSnapshots(pool, { limit: 5 });
      ok(snaps.ready && snaps.rows.length >= 2, `snapshots list returns >=2 (${snaps.rows.length})`);
      const drift = await getGovernanceDrift(pool);
      ok(drift.ready && drift.snapshots === 2 && drift.drift && isNumOrNull(drift.drift.governance_health), 'drift computed between latest 2 (number|null deltas)');

      // audit + summary compose everything.
      const audit = await getGovernanceAudit(pool);
      ok(audit.ready && audit.audit && audit.audit.compliance_audit && audit.audit.drift, 'audit composes compliance + governance + validation + drift');
      const sum = await getAutomationSummary(pool);
      ok(sum.ready && Array.isArray(sum.composes) && sum.composes.length === 4, 'summary declares it COMPOSES 1.37 + 1.38 + 1.39 + 1.40');
    }

    // cleanup own test rows
    for (const u of policyUids) await pool.query(`DELETE FROM platform_governance_policies WHERE policy_uid=$1`, [u]).catch(() => {});
    for (const u of snapUids) await pool.query(`DELETE FROM platform_governance_audit_snapshots WHERE snapshot_uid=$1`, [u]).catch(() => {});
    const leftover =
      (policyUids.length ? (await pool.query(`SELECT count(*)::int n FROM platform_governance_policies WHERE policy_uid = ANY($1)`, [policyUids])).rows[0].n : 0) +
      (snapUids.length ? (await pool.query(`SELECT count(*)::int n FROM platform_governance_audit_snapshots WHERE snapshot_uid = ANY($1)`, [snapUids])).rows[0].n : 0);
    ok(leftover === 0, `cleanup complete (${leftover} test rows remain)`);
    console.log('\nDONE');
  } catch (e: any) {
    console.error('ERROR', e.message, e.stack);
  } finally {
    await pool.end();
  }
})();
