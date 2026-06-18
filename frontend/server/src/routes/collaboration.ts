import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/client.js';

const router = Router();
router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collab/connections — my accepted connections
router.get('/connections', async (req, res) => {
  const userId = req.user!.id;
  try {
    const { rows } = await pool.query(
      `SELECT sc.id, sc.status, sc.created_at,
              CASE WHEN sc.requester_id = $1 THEN sc.addressee_id ELSE sc.requester_id END AS peer_id,
              u.full_name AS peer_name, u.profile_picture AS peer_avatar, u.metadata AS peer_meta
       FROM student_connections sc
       JOIN users u ON u.id = CASE WHEN sc.requester_id = $1 THEN sc.addressee_id ELSE sc.requester_id END
       WHERE (sc.requester_id = $1 OR sc.addressee_id = $1) AND sc.status = 'accepted'
       ORDER BY sc.updated_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/collab/connections/requests — pending requests (incoming + outgoing)
router.get('/connections/requests', async (req, res) => {
  const userId = req.user!.id;
  try {
    const { rows } = await pool.query(
      `SELECT sc.id, sc.status, sc.message, sc.created_at,
              sc.requester_id, sc.addressee_id,
              u.full_name AS peer_name, u.profile_picture AS peer_avatar,
              CASE WHEN sc.requester_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction
       FROM student_connections sc
       JOIN users u ON u.id = CASE WHEN sc.requester_id = $1 THEN sc.addressee_id ELSE sc.requester_id END
       WHERE (sc.requester_id = $1 OR sc.addressee_id = $1) AND sc.status = 'pending'
       ORDER BY sc.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/collab/connections/suggestions — other students (not connected, not self)
router.get('/connections/suggestions', async (req, res) => {
  const userId = req.user!.id;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name AS name, u.profile_picture AS avatar, u.metadata
       FROM users u
       WHERE u.id != $1
         AND u.role = 'student'
         AND u.is_active = TRUE
         AND u.id NOT IN (
           SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END
           FROM student_connections
           WHERE requester_id = $1 OR addressee_id = $1
         )
       ORDER BY u.created_at DESC
       LIMIT 20`,
      [userId]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/collab/connections/request — send connection request
router.post('/connections/request', async (req, res) => {
  const userId = req.user!.id;
  const { addresseeId, message } = req.body;
  if (!addresseeId || addresseeId === userId) {
    return res.status(400).json({ error: 'Invalid addressee' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO student_connections (requester_id, addressee_id, message)
       VALUES ($1, $2, $3)
       ON CONFLICT (requester_id, addressee_id) DO NOTHING
       RETURNING *`,
      [userId, addresseeId, message || null]
    );
    if (!rows[0]) return res.status(409).json({ error: 'Request already exists' });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/collab/connections/:id/accept
router.patch('/connections/:id/accept', async (req, res) => {
  const userId = req.user!.id;
  try {
    const { rows } = await pool.query(
      `UPDATE student_connections
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/collab/connections/:id/decline
router.patch('/connections/:id/decline', async (req, res) => {
  const userId = req.user!.id;
  try {
    await pool.query(
      `DELETE FROM student_connections WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)`,
      [req.params.id, userId]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/collab/connections/:id — remove connection
router.delete('/connections/:id', async (req, res) => {
  const userId = req.user!.id;
  try {
    await pool.query(
      `DELETE FROM student_connections WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)`,
      [req.params.id, userId]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DIRECT MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collab/dm/inbox — list recent DM threads (one per peer)
router.get('/dm/inbox', async (req, res) => {
  const userId = req.user!.id;
  try {
    const { rows } = await pool.query(
      `WITH threads AS (
         SELECT DISTINCT ON (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
           dm.id, dm.content, dm.created_at, dm.is_read, dm.sender_id,
           CASE WHEN dm.sender_id = $1 THEN dm.receiver_id ELSE dm.sender_id END AS peer_id
         FROM direct_messages dm
         WHERE (dm.sender_id = $1 AND NOT dm.deleted_by_sender)
            OR (dm.receiver_id = $1 AND NOT dm.deleted_by_receiver)
         ORDER BY LEAST(sender_id,receiver_id), GREATEST(sender_id,receiver_id), dm.created_at DESC
       )
       SELECT t.*, u.full_name AS peer_name, u.profile_picture AS peer_avatar,
         (SELECT COUNT(*) FROM direct_messages
          WHERE sender_id = t.peer_id AND receiver_id = $1 AND is_read = FALSE) AS unread_count
       FROM threads t
       JOIN users u ON u.id = t.peer_id
       ORDER BY t.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/collab/dm/:peerId — messages in a thread
router.get('/dm/:peerId', async (req, res) => {
  const userId = req.user!.id;
  const { peerId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT dm.id, dm.content, dm.created_at, dm.is_read, dm.sender_id,
              u.full_name AS sender_name, u.profile_picture AS sender_avatar
       FROM direct_messages dm
       JOIN users u ON u.id = dm.sender_id
       WHERE ((dm.sender_id = $1 AND dm.receiver_id = $2 AND NOT dm.deleted_by_sender)
           OR (dm.sender_id = $2 AND dm.receiver_id = $1 AND NOT dm.deleted_by_receiver))
       ORDER BY dm.created_at ASC
       LIMIT 100`,
      [userId, peerId]
    );
    // Mark messages from peerId as read
    await pool.query(
      `UPDATE direct_messages SET is_read = TRUE
       WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE`,
      [peerId, userId]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/collab/dm/:peerId — send a DM
router.post('/dm/:peerId', async (req, res) => {
  const userId = req.user!.id;
  const { peerId } = req.params;
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

  try {
    // Check they are connected
    const { rows: conn } = await pool.query(
      `SELECT id FROM student_connections
       WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
         AND status = 'accepted'`,
      [userId, peerId]
    );
    if (!conn[0]) return res.status(403).json({ error: 'Not connected with this student' });

    const { rows } = await pool.query(
      `INSERT INTO direct_messages (sender_id, receiver_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, peerId, content.trim()]
    );
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// STUDY GROUPS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collab/groups — list public groups + my groups
router.get('/groups', async (req, res) => {
  const userId = req.user!.id;
  try {
    const { rows } = await pool.query(
      `SELECT sg.*,
              u.full_name AS creator_name,
              (SELECT COUNT(*) FROM group_members WHERE group_id = sg.id) AS member_count,
              (SELECT role FROM group_members WHERE group_id = sg.id AND user_id = $1) AS my_role,
              EXISTS(SELECT 1 FROM group_members WHERE group_id = sg.id AND user_id = $1) AS is_member
       FROM study_groups sg
       JOIN users u ON u.id = sg.creator_id
       WHERE sg.visibility = 'public'
          OR EXISTS(SELECT 1 FROM group_members WHERE group_id = sg.id AND user_id = $1)
       ORDER BY sg.updated_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/collab/groups — create group
router.post('/groups', async (req, res) => {
  const userId = req.user!.id;
  const { name, description, subject, tags, visibility, maxMembers, avatarColor } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Group name required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [group] } = await client.query(
      `INSERT INTO study_groups (name, description, subject, tags, visibility, max_members, creator_id, avatar_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name.trim(), description || null, subject || null,
       tags || [], visibility || 'public', maxMembers || 30, userId, avatarColor || '#344E86']
    );
    await client.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [group.id, userId]
    );
    await client.query('COMMIT');
    res.json(group);
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// POST /api/collab/groups/:id/join
router.post('/groups/:id/join', async (req, res) => {
  const userId = req.user!.id;
  try {
    const { rows: [group] } = await pool.query(
      `SELECT sg.*, (SELECT COUNT(*) FROM group_members WHERE group_id = sg.id) AS cnt
       FROM study_groups sg WHERE sg.id = $1`,
      [req.params.id]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (parseInt(group.cnt) >= group.max_members) {
      return res.status(409).json({ error: 'Group is full' });
    }
    await pool.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
      [req.params.id, userId]
    );
    // Update group timestamp
    await pool.query(`UPDATE study_groups SET updated_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/collab/groups/:id/leave
router.delete('/groups/:id/leave', async (req, res) => {
  const userId = req.user!.id;
  try {
    await pool.query(
      `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/collab/groups/:id/messages — group chat history
router.get('/groups/:id/messages', async (req, res) => {
  const userId = req.user!.id;
  try {
    // Must be a member
    const { rows: mem } = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    if (!mem[0]) return res.status(403).json({ error: 'Not a member of this group' });

    const { rows } = await pool.query(
      `SELECT gm.id, gm.content, gm.created_at, gm.is_deleted, gm.reply_to_id, gm.sender_id,
              u.full_name AS sender_name, u.profile_picture AS sender_avatar,
              r.content AS reply_to_content
       FROM group_messages gm
       JOIN users u ON u.id = gm.sender_id
       LEFT JOIN group_messages r ON r.id = gm.reply_to_id
       WHERE gm.group_id = $1
       ORDER BY gm.created_at ASC
       LIMIT 100`,
      [req.params.id]
    );
    res.json({ messages: rows, myRole: mem[0].role });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/collab/groups/:id/messages — send group message
router.post('/groups/:id/messages', async (req, res) => {
  const userId = req.user!.id;
  const { content, replyToId } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

  try {
    const { rows: mem } = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    if (!mem[0]) return res.status(403).json({ error: 'Not a member' });

    const { rows } = await pool.query(
      `INSERT INTO group_messages (group_id, sender_id, content, reply_to_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, userId, content.trim(), replyToId || null]
    );
    await pool.query(`UPDATE study_groups SET updated_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/collab/groups/:id/messages/:msgId — moderator/owner/sender can delete
router.delete('/groups/:id/messages/:msgId', async (req, res) => {
  const userId = req.user!.id;
  try {
    const { rows: mem } = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    const { rows: msg } = await pool.query(
      `SELECT sender_id FROM group_messages WHERE id = $1 AND group_id = $2`,
      [req.params.msgId, req.params.id]
    );
    if (!msg[0]) return res.status(404).json({ error: 'Message not found' });
    const isModerator = ['owner', 'moderator'].includes(mem[0]?.role);
    if (!isModerator && msg[0].sender_id !== userId) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    await pool.query(
      `UPDATE group_messages SET is_deleted = TRUE, deleted_by = $1 WHERE id = $2`,
      [userId, req.params.msgId]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/collab/groups/:id/members — list members
router.get('/groups/:id/members', async (req, res) => {
  const userId = req.user!.id;
  try {
    const { rows: mem } = await pool.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`, [req.params.id, userId]
    );
    if (!mem[0]) return res.status(403).json({ error: 'Not a member' });

    const { rows } = await pool.query(
      `SELECT gm.user_id, gm.role, gm.joined_at, u.full_name AS name, u.profile_picture AS avatar
       FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 ORDER BY gm.joined_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
