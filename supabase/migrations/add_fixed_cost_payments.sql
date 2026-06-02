-- ── Fixed Cost: due_day + monthly payments ─────────────────────────────────────

-- Day-of-month when this cost is typically due (optional)
ALTER TABLE fixed_costs ADD COLUMN IF NOT EXISTS due_day integer CHECK (due_day >= 1 AND due_day <= 31);

-- Tracks which months a fixed cost has been paid
CREATE TABLE IF NOT EXISTS fixed_cost_payments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fixed_cost_id uuid        NOT NULL REFERENCES fixed_costs(id)   ON DELETE CASCADE,
  year          integer     NOT NULL,
  month         integer     NOT NULL CHECK (month >= 1 AND month <= 12),
  paid_at       timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixed_cost_id, year, month)
);

CREATE INDEX IF NOT EXISTS fixed_cost_payments_org_id_idx       ON fixed_cost_payments (org_id);
CREATE INDEX IF NOT EXISTS fixed_cost_payments_cost_id_idx      ON fixed_cost_payments (fixed_cost_id);
CREATE INDEX IF NOT EXISTS fixed_cost_payments_year_month_idx   ON fixed_cost_payments (org_id, year, month);

ALTER TABLE fixed_cost_payments ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS; no additional policies needed.
