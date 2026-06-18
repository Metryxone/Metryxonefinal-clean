-- Migration: ensure websocket_runtime feature flag exists
-- Inserted as disabled (enabled = false) so existing sessions are unaffected.
-- Admins can enable it via the Feature Flags panel in the admin dashboard.

INSERT INTO feature_flags (
  flag_key,
  label,
  description,
  enabled,
  rollout_pct,
  phase,
  created_at,
  updated_at
) VALUES (
  'websocket_runtime',
  'WebSocket Runtime Sync',
  'Phase 1 S12 — WebSocket real-time cognitive runtime synchronisation. When enabled, the backend broadcasts hypothesis, confidence, contradiction, cognitive-load, and stage events to connected frontend clients over /ws/session/:sessionId.',
  false,
  0,
  'phase1',
  now(),
  now()
) ON CONFLICT (flag_key) DO NOTHING;
