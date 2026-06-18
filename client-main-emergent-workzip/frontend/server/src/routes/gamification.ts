import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { pool } from '../db/client.js';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
}

function calcLoginReward(streakDays: number): number {
  if (streakDays >= 21) return 75;
  if (streakDays >= 14) return 50;
  if (streakDays >= 7)  return 30;
  if (streakDays >= 3)  return 20;
  return 10;
}

async function ensureGamificationProfile(userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO student_gamification (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

async function awardXP(
  client: import('pg').PoolClient,
  userId: string,
  amount: number,
  source: string,
  referenceId?: string,
): Promise<void> {
  await client.query(
    `UPDATE student_gamification
     SET xp = xp + $2,
         level = GREATEST(level, FLOOR(SQRT((xp + $2) / 50.0))::int + 1),
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId, amount],
  );
  await client.query(
    `INSERT INTO xp_transactions (user_id, amount, source, reference_id) VALUES ($1, $2, $3, $4)`,
    [userId, amount, source, referenceId ?? null],
  );
}

async function awardCoins(
  client: import('pg').PoolClient,
  userId: string,
  amount: number,
  source: string,
  referenceId?: string,
): Promise<void> {
  const res = await client.query<{ coins: number }>(
    `UPDATE student_gamification SET coins = coins + $2, updated_at = NOW()
     WHERE user_id = $1 RETURNING coins`,
    [userId, amount],
  );
  const balance = res.rows[0]?.coins ?? amount;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);
  await client.query(
    `INSERT INTO coin_transactions (user_id, amount, type, source, balance_after, expires_at, reference_id)
     VALUES ($1, $2, 'earn', $3, $4, $5, $6)`,
    [userId, amount, source, balance, expiresAt.toISOString(), referenceId ?? null],
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/gamification/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    await ensureGamificationProfile(userId);

    const result = await pool.query<{
      xp: number; coins: number; level: number; streak_days: number;
      last_login_date: string | null; missions_completed: number;
    }>(
      `SELECT xp, coins, level, streak_days, last_login_date, missions_completed
       FROM student_gamification WHERE user_id = $1`,
      [userId],
    );

    const row = result.rows[0];
    const xp = row?.xp ?? 0;
    const level = row?.level ?? 1;
    const xpForCurrentLevel = (level - 1) * (level - 1) * 50;
    const xpForNextLevel = level * level * 50;
    const xpInLevel = xp - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;

    const today = new Date().toISOString().slice(0, 10);
    const lastLogin = row?.last_login_date?.toString().slice(0, 10);
    const canClaimLoginReward = lastLogin !== today;

    res.json({
      xp,
      coins: row?.coins ?? 0,
      level,
      streakDays: row?.streak_days ?? 0,
      missionsCompleted: row?.missions_completed ?? 0,
      xpInLevel,
      xpNeeded,
      levelProgress: xpNeeded > 0 ? Math.round((xpInLevel / xpNeeded) * 100) : 100,
      canClaimLoginReward,
    });
  } catch (err) {
    console.error('[gamification/profile]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/gamification/login-reward
router.post('/login-reward', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureGamificationProfile(userId);

    const today = new Date().toISOString().slice(0, 10);
    const row = await client.query<{
      last_login_date: string | null; streak_days: number; xp: number; coins: number;
    }>(
      `SELECT last_login_date, streak_days, xp, coins FROM student_gamification WHERE user_id = $1`,
      [userId],
    );

    const last = row.rows[0]?.last_login_date?.toString().slice(0, 10);
    if (last === today) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'ALREADY_CLAIMED', message: 'Login reward already claimed today' });
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const prevStreak = row.rows[0]?.streak_days ?? 0;
    const newStreak = last === yesterdayStr ? prevStreak + 1 : 1;
    const coinsEarned = calcLoginReward(newStreak);
    const xpEarned = 5;

    await client.query(
      `UPDATE student_gamification
       SET last_login_date = $2, streak_days = $3, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, today, newStreak],
    );

    await awardXP(client, userId, xpEarned, 'login_reward');
    await awardCoins(client, userId, coinsEarned, 'login_reward');

    await client.query('COMMIT');

    res.json({
      success: true,
      coinsEarned,
      xpEarned,
      streakDays: newStreak,
      message: newStreak > 1
        ? `Day ${newStreak} streak! You earned ${coinsEarned} coins.`
        : `Welcome back! You earned ${coinsEarned} coins.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[gamification/login-reward]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  } finally {
    client.release();
  }
});

// GET /api/gamification/missions/daily
router.get('/missions/daily', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureGamificationProfile(userId);

    const today = new Date().toISOString().slice(0, 10);

    const prefRow = await client.query<{ last_mission_reset: string | null }>(
      `SELECT last_mission_reset FROM student_gamification WHERE user_id = $1`,
      [userId],
    );
    const lastReset = prefRow.rows[0]?.last_mission_reset?.toString().slice(0, 10);

    if (lastReset !== today) {
      // Assign 3 random active missions for today
      const missionPool = await client.query<{ id: number }>(
        `SELECT id FROM missions WHERE is_active = TRUE ORDER BY RANDOM() LIMIT 3`,
      );
      if (missionPool.rows.length > 0) {
        const values = missionPool.rows
          .map((m) => `('${userId}', ${m.id}, '${today}')`)
          .join(',');
        await client.query(
          `INSERT INTO student_missions (student_id, mission_id, assigned_date)
           VALUES ${values} ON CONFLICT DO NOTHING`,
        );
      }
      await client.query(
        `UPDATE student_gamification SET last_mission_reset = $2 WHERE user_id = $1`,
        [userId, today],
      );
    }

    const missions = await client.query<{
      sm_id: number; mission_id: number; status: string; completed_at: string | null;
      title: string; description: string; type: string; difficulty: string;
      xp_reward: number; coin_reward: number; skill_tag: string | null;
    }>(
      `SELECT sm.id AS sm_id, sm.mission_id, sm.status, sm.completed_at,
              m.title, m.description, m.type, m.difficulty, m.xp_reward, m.coin_reward, m.skill_tag
       FROM student_missions sm
       JOIN missions m ON m.id = sm.mission_id
       WHERE sm.student_id = $1 AND sm.assigned_date = $2
       ORDER BY sm.id`,
      [userId, today],
    );

    await client.query('COMMIT');
    res.json({ date: today, missions: missions.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[gamification/missions/daily]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  } finally {
    client.release();
  }
});

// POST /api/gamification/missions/:id/complete
router.post('/missions/:id/complete', requireAuth, async (req, res) => {
  const studentMissionId = parseInt(req.params.id, 10);
  if (isNaN(studentMissionId)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const row = await client.query<{
      status: string; xp_reward: number; coin_reward: number; mission_id: number;
    }>(
      `SELECT sm.status, m.xp_reward, m.coin_reward, sm.mission_id
       FROM student_missions sm JOIN missions m ON m.id = sm.mission_id
       WHERE sm.id = $1 AND sm.student_id = $2`,
      [studentMissionId, userId],
    );

    if (row.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'MISSION_NOT_FOUND' });
      return;
    }

    const mission = row.rows[0];
    if (mission.status === 'completed') {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'ALREADY_COMPLETED' });
      return;
    }

    await client.query(
      `UPDATE student_missions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [studentMissionId],
    );

    await awardXP(client, userId, mission.xp_reward, 'mission_complete', String(studentMissionId));
    await awardCoins(client, userId, mission.coin_reward, 'mission_complete', String(studentMissionId));

    await client.query(
      `UPDATE student_gamification SET missions_completed = missions_completed + 1, updated_at = NOW()
       WHERE user_id = $1`,
      [userId],
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      xpEarned: mission.xp_reward,
      coinsEarned: mission.coin_reward,
      message: `Mission complete! +${mission.xp_reward} XP, +${mission.coin_reward} coins`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[gamification/missions/complete]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  } finally {
    client.release();
  }
});

// GET /api/gamification/leaderboard
router.get('/leaderboard', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10), 50);
    const result = await pool.query<{
      user_id: string; xp: number; level: number; streak_days: number;
      name: string | null; role: string;
    }>(
      `SELECT sg.user_id, sg.xp, sg.level, sg.streak_days,
              u.full_name AS name, u.role
       FROM student_gamification sg
       JOIN users u ON u.id = sg.user_id
       WHERE sg.xp > 0
       ORDER BY sg.xp DESC
       LIMIT $1`,
      [limit],
    );
    const userId = req.user?.id;
    let myRank: number | null = null;
    if (userId) {
      const rankRow = await pool.query<{ rank: number }>(
        `SELECT rank FROM (
           SELECT user_id, RANK() OVER (ORDER BY xp DESC) AS rank
           FROM student_gamification WHERE xp > 0
         ) ranked WHERE user_id = $1`,
        [userId],
      );
      myRank = rankRow.rows[0]?.rank ?? null;
    }
    res.json({ leaderboard: result.rows, myRank });
  } catch (err) {
    console.error('[gamification/leaderboard]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/gamification/rewards
router.get('/rewards', optionalAuth, async (req, res) => {
  try {
    const typeFilter = req.query.type as string | undefined;
    const params: string[] = [];
    let where = 'WHERE is_active = TRUE';
    if (typeFilter) {
      params.push(typeFilter);
      where += ` AND type = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT id, name, description, type, coin_cost, stock, image_url FROM rewards ${where} ORDER BY coin_cost ASC`,
      params,
    );
    res.json({ rewards: result.rows });
  } catch (err) {
    console.error('[gamification/rewards]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/gamification/rewards/:id/redeem
const RedeemSchema = z.object({
  address: z.object({
    line1: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: z.string().min(4),
  }).optional(),
});

router.post('/rewards/:id/redeem', requireAuth, async (req, res) => {
  const rewardId = parseInt(req.params.id, 10);
  if (isNaN(rewardId)) { res.status(400).json({ error: 'INVALID_ID' }); return; }

  const parsed = RedeemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() }); return; }

  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rewardRow = await client.query<{ coin_cost: number; stock: number | null; type: string; name: string }>(
      `SELECT coin_cost, stock, type, name FROM rewards WHERE id = $1 AND is_active = TRUE`,
      [rewardId],
    );
    if (rewardRow.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'REWARD_NOT_FOUND' });
      return;
    }
    const reward = rewardRow.rows[0];

    if (reward.stock !== null && reward.stock <= 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'OUT_OF_STOCK' });
      return;
    }

    if (reward.type === 'physical' && !parsed.data.address) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'ADDRESS_REQUIRED', message: 'Physical rewards require a delivery address' });
      return;
    }

    const profileRow = await client.query<{ coins: number }>(
      `SELECT coins FROM student_gamification WHERE user_id = $1`,
      [userId],
    );
    const currentCoins = profileRow.rows[0]?.coins ?? 0;
    if (currentCoins < reward.coin_cost) {
      await client.query('ROLLBACK');
      res.status(402).json({ error: 'INSUFFICIENT_COINS', required: reward.coin_cost, available: currentCoins });
      return;
    }

    // Deduct coins
    const newBalance = currentCoins - reward.coin_cost;
    await client.query(
      `UPDATE student_gamification SET coins = $2, updated_at = NOW() WHERE user_id = $1`,
      [userId, newBalance],
    );
    await client.query(
      `INSERT INTO coin_transactions (user_id, amount, type, source, balance_after, reference_id)
       VALUES ($1, $2, 'spend', 'reward_redemption', $3, $4)`,
      [userId, reward.coin_cost, newBalance, String(rewardId)],
    );

    // Reduce stock if applicable
    if (reward.stock !== null) {
      await client.query(`UPDATE rewards SET stock = stock - 1 WHERE id = $1`, [rewardId]);
    }

    const redemptionRow = await client.query<{ id: number }>(
      `INSERT INTO redemptions (user_id, reward_id, coins_spent, status, address)
       VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
      [userId, rewardId, reward.coin_cost, parsed.data.address ? JSON.stringify(parsed.data.address) : null],
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      redemptionId: redemptionRow.rows[0].id,
      coinsSpent: reward.coin_cost,
      remainingCoins: newBalance,
      message: `You've redeemed "${reward.name}" for ${reward.coin_cost} coins!`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[gamification/rewards/redeem]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  } finally {
    client.release();
  }
});

// GET /api/gamification/skills
router.get('/skills', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await pool.query(
      `SELECT s.id, s.name, s.category, s.description, s.icon,
              COALESCE(ss.mastery_level, 0) AS mastery_level
       FROM skills s
       LEFT JOIN student_skills ss ON ss.skill_id = s.id AND ss.student_id = $1
       WHERE s.is_active = TRUE
       ORDER BY s.category, s.name`,
      [userId],
    );
    res.json({ skills: result.rows });
  } catch (err) {
    console.error('[gamification/skills]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/gamification/coins/history
router.get('/coins/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const result = await pool.query(
      `SELECT id, amount, type, source, balance_after, expires_at, created_at
       FROM coin_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    console.error('[gamification/coins/history]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/gamification/xp/history
router.get('/xp/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const result = await pool.query(
      `SELECT id, amount, source, reference_id, created_at
       FROM xp_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    console.error('[gamification/xp/history]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/gamification/redemptions
router.get('/redemptions', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await pool.query(
      `SELECT r.id, r.coins_spent, r.status, r.created_at,
              rw.name AS reward_name, rw.type AS reward_type
       FROM redemptions r JOIN rewards rw ON rw.id = r.reward_id
       WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 20`,
      [userId],
    );
    res.json({ redemptions: result.rows });
  } catch (err) {
    console.error('[gamification/redemptions]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
