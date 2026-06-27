// MX-600 Phase 2 (B1): proves the live RBAC enforcement primitive denies/permits
// correctly. requireRole needs no DB (pure persona→role mapping), so this is a
// fast, deterministic unit test. Run: npx tsx tests/rbac-enforcement.test.ts
import { requireRole } from '../services/security-middleware';

function mkReq(user: any): any {
  return { user, get: (_h: string) => '' };
}
function mkRes(): any {
  const r: any = { code: 0, body: null };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  return r;
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.error('  ✗', name); }
}

// super_admin inherits all
{
  const res = mkRes(); let nexted = false;
  requireRole('recruiter')(mkReq({ role: 'super_admin' }), res, () => { nexted = true; });
  check('super_admin passes any role gate', nexted && res.code === 0);
}

// persona maps to formal role (hr_recruiter → recruiter)
{
  const res = mkRes(); let nexted = false;
  requireRole('recruiter')(mkReq({ role: 'hr_recruiter' }), res, () => { nexted = true; });
  check('hr_recruiter persona maps to recruiter', nexted && res.code === 0);
}

// institute persona → institution_admin
{
  const res = mkRes(); let nexted = false;
  requireRole('institution_admin')(mkReq({ role: 'institute' }), res, () => { nexted = true; });
  check('institute persona maps to institution_admin', nexted && res.code === 0);
}

// wrong persona denied 403
{
  const res = mkRes(); let nexted = false;
  requireRole('recruiter')(mkReq({ role: 'student' }), res, () => { nexted = true; });
  check('student denied recruiter gate (403)', !nexted && res.code === 403);
}

// no identity → 401
{
  const res = mkRes(); let nexted = false;
  requireRole('recruiter')(mkReq(null), res, () => { nexted = true; });
  check('no identity rejected (401)', !nexted && res.code === 401);
}

console.log(`\nRBAC enforcement: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
