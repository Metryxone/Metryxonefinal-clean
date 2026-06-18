CREATE TABLE IF NOT EXISTS notification_preferences (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text        NOT NULL,
  category      text        NOT NULL,
  app_enabled   boolean     NOT NULL DEFAULT true,
  email_enabled boolean     NOT NULL DEFAULT true,
  sms_enabled   boolean     NOT NULL DEFAULT false,
  push_enabled  boolean     NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, category)
);
CREATE INDEX IF NOT EXISTS notif_pref_user_idx ON notification_preferences(user_id);
