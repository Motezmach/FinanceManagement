-- Fixed monthly lifecycle and savings. Additive and idempotent: safe to run more
-- than once, and the previously deployed code keeps working against it.
-- Mirrored in src/lib/db/schema.ts.

ALTER TYPE entry_status ADD VALUE IF NOT EXISTS 'saved';

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_paid_seen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_pay_hold boolean NOT NULL DEFAULT false;

ALTER TABLE recurring_rules
  ADD COLUMN IF NOT EXISTS auto_pay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS fixed_synced_on date,
  ADD COLUMN IF NOT EXISTS fixed_model_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rule_skips (
  rule_id uuid NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, period)
);

CREATE INDEX IF NOT EXISTS rule_skips_user_idx ON rule_skips(user_id);
