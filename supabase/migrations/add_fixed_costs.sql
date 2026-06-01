-- ── Fixed Costs ───────────────────────────────────────────────────────────────
-- Recurring/fixed costs per artist (band fees, equipment, transport, etc.)
-- Not tied to a specific show.

create table if not exists fixed_costs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  artist_id   uuid not null references artists(id)       on delete cascade,
  description text not null,
  amount      numeric(10, 2) not null default 0,
  category    text not null default 'outros',
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists fixed_costs_org_id_idx    on fixed_costs (org_id);
create index if not exists fixed_costs_artist_id_idx on fixed_costs (artist_id);

-- RLS
alter table fixed_costs enable row level security;

-- Service role bypasses RLS (used by API routes) — no policies needed for anon/authenticated
-- since all access goes through server-side service client.
