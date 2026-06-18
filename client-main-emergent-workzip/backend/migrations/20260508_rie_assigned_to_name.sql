-- Add assigned_to_name to rie_escalations so counsellor display name persists
ALTER TABLE rie_escalations
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
