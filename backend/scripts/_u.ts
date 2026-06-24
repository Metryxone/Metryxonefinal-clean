import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const c = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`);
  console.log('users:', c.rows.map(r=>r.column_name).join(', '));
  const cs = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='career_seeker_profiles' ORDER BY ordinal_position`);
  console.log('career_seeker_profiles:', cs.rows.map(r=>r.column_name).join(', '));
  const demo = await pool.query(`SELECT email, role FROM users WHERE email LIKE '%@example.com' LIMIT 5`).catch(e=>({rows:[{err:e.message}]}));
  console.log('demo users:', JSON.stringify(demo.rows));
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1);});
