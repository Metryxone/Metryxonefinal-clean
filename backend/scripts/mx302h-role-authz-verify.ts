/**
 * MX-302H — role-aware institutional authz verification (ephemeral, self-cleaning).
 *
 * Seeds a throwaway institute with an owner, a placement officer, a faculty member
 * (assigned to ONE of two batches), and an unrelated user, then asserts
 * resolveInstituteForUser() classifies each role + batch scope correctly. Every
 * seeded row is @example.com / mx302h-verify-prefixed and DELETEd in a finally
 * block so the shared dev DB is left byte-identical.
 *
 *   run: cd backend && npx tsx scripts/mx302h-role-authz-verify.ts
 */
import { Pool } from 'pg';
import { resolveInstituteForUser, classifyStaffRole } from '../services/institutional-intelligence-engine';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const P = 'mx302h-verify';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function newUser(suffix: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO users (username, password, full_name, email)
     VALUES ($1, 'x', $2, $3) RETURNING id`,
    [`${P}-${suffix}-${Date.now()}@example.com`, `${P} ${suffix}`, `${P}-${suffix}@example.com`],
  );
  return r.rows[0].id;
}

async function main() {
  const ids: { users: string[]; institute?: string; batches: string[]; staff: string[]; roles: string[] } =
    { users: [], batches: [], staff: [], roles: [] };
  try {
    // ── classifyStaffRole unit checks (pure) ─────────────────────────────────
    console.log('classifyStaffRole:');
    check('placement code → placement_officer', classifyStaffRole('PLACEMENT_OFFICER') === 'placement_officer');
    check('TPO → placement_officer', classifyStaffRole('TPO', 'Training & Placement') === 'placement_officer');
    check('faculty code → faculty', classifyStaffRole('FACULTY') === 'faculty');
    check('teacher name → faculty', classifyStaffRole('TCH', 'Senior Teacher') === 'faculty');
    check('principal → institute_admin', classifyStaffRole('PRINCIPAL') === 'institute_admin');
    check('unknown → staff', classifyStaffRole('LIBRARIAN', 'Library Desk') === 'staff');
    check('null → staff', classifyStaffRole(null) === 'staff');

    // ── seed institute + users ───────────────────────────────────────────────
    const ownerId = await newUser('owner'); ids.users.push(ownerId);
    const officerId = await newUser('officer'); ids.users.push(officerId);
    const facultyId = await newUser('faculty'); ids.users.push(facultyId);
    const outsiderId = await newUser('outsider'); ids.users.push(outsiderId);

    const inst = await pool.query<{ id: string }>(
      `INSERT INTO institutes (admin_user_id, institute_code, legal_name, display_name)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [ownerId, `${P}-${Date.now()}`, `${P} Legal`, `${P} College`],
    );
    ids.institute = inst.rows[0].id;

    const b1 = await pool.query<{ id: string }>(
      `INSERT INTO batches (institute_id, batch_code, batch_name, academic_year)
       VALUES ($1, 'B1', 'Batch One', '2026') RETURNING id`, [ids.institute]);
    const b2 = await pool.query<{ id: string }>(
      `INSERT INTO batches (institute_id, batch_code, batch_name, academic_year)
       VALUES ($1, 'B2', 'Batch Two', '2026') RETURNING id`, [ids.institute]);
    ids.batches.push(b1.rows[0].id, b2.rows[0].id);

    // staff roles
    const officerRole = await pool.query<{ id: string }>(
      `INSERT INTO staff_roles (role_name, role_code) VALUES ('Placement Officer', $1) RETURNING id`,
      [`${P}-PLACEMENT_OFFICER-${Date.now()}`]);
    const facultyRole = await pool.query<{ id: string }>(
      `INSERT INTO staff_roles (role_name, role_code) VALUES ('Faculty', $1) RETURNING id`,
      [`${P}-FACULTY-${Date.now()}`]);
    ids.roles.push(officerRole.rows[0].id, facultyRole.rows[0].id);

    const officerStaff = await pool.query<{ id: string }>(
      `INSERT INTO institute_staff (institute_id, user_id, role_id, full_name) VALUES ($1,$2,$3,$4) RETURNING id`,
      [ids.institute, officerId, officerRole.rows[0].id, `${P} Officer`]);
    const facultyStaff = await pool.query<{ id: string }>(
      `INSERT INTO institute_staff (institute_id, user_id, role_id, full_name) VALUES ($1,$2,$3,$4) RETURNING id`,
      [ids.institute, facultyId, facultyRole.rows[0].id, `${P} Faculty`]);
    ids.staff.push(officerStaff.rows[0].id, facultyStaff.rows[0].id);

    // faculty assigned ONLY to batch 1
    await pool.query(
      `INSERT INTO staff_batch_assignments (staff_id, batch_id) VALUES ($1,$2)`,
      [facultyStaff.rows[0].id, b1.rows[0].id]);

    // ── resolver checks ──────────────────────────────────────────────────────
    console.log('\nresolveInstituteForUser:');
    const owner = await resolveInstituteForUser(pool, ownerId);
    check('owner resolves', !!owner);
    check('owner role institute_admin', owner?.role === 'institute_admin', owner?.role);
    check('owner all batches (null)', owner?.allowed_batch_ids === null);
    check('owner staff_id null', owner?.staff_id === null);

    const officer = await resolveInstituteForUser(pool, officerId);
    check('officer resolves', !!officer);
    check('officer role placement_officer', officer?.role === 'placement_officer', officer?.role);
    check('officer same institute', officer?.institute_id === ids.institute);
    check('officer all batches (null, institute-level)', officer?.allowed_batch_ids === null);

    const faculty = await resolveInstituteForUser(pool, facultyId);
    check('faculty resolves', !!faculty);
    check('faculty role faculty', faculty?.role === 'faculty', faculty?.role);
    check('faculty batch-scoped to b1 only',
      Array.isArray(faculty?.allowed_batch_ids) && faculty?.allowed_batch_ids.length === 1 && faculty?.allowed_batch_ids[0] === b1.rows[0].id,
      JSON.stringify(faculty?.allowed_batch_ids));
    check('faculty NOT scoped to b2', !faculty?.allowed_batch_ids?.includes(b2.rows[0].id));

    const outsider = await resolveInstituteForUser(pool, outsiderId);
    check('outsider resolves null (→ 403)', outsider === null);

    const empty = await resolveInstituteForUser(pool, '');
    check('empty uid resolves null', empty === null);
  } finally {
    // ── cleanup (children → parents) ─────────────────────────────────────────
    try {
      for (const s of ids.staff) await pool.query(`DELETE FROM staff_batch_assignments WHERE staff_id=$1`, [s]);
      for (const s of ids.staff) await pool.query(`DELETE FROM institute_staff WHERE id=$1`, [s]);
      for (const r of ids.roles) await pool.query(`DELETE FROM staff_roles WHERE id=$1`, [r]);
      for (const b of ids.batches) await pool.query(`DELETE FROM batches WHERE id=$1`, [b]);
      if (ids.institute) await pool.query(`DELETE FROM institutes WHERE id=$1`, [ids.institute]);
      for (const u of ids.users) await pool.query(`DELETE FROM users WHERE id=$1`, [u]);
      const leftover = await pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM users WHERE email LIKE $1`, [`${P}%`]);
      console.log(`\ncleanup leftover ${P} users: ${leftover.rows[0].c}`);
    } catch (e) { console.error('cleanup error:', e); }
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
