-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- =============================================
-- ENUMS
-- =============================================

create type show_status as enum (
  'pre_reserva',
  'confirmado',
  'contrato_enviado',
  'contrato_assinado',
  'realizado',
  'cancelado'
);

create type member_role as enum (
  'owner',
  'empresario',
  'financeiro',
  'contratos',
  'marketing',
  'producao',
  'viewer'
);

create type plan_type as enum (
  'trial',
  'starter',
  'pro',
  'enterprise'
);

create type receivable_status as enum (
  'pendente',
  'parcial',
  'pago',
  'atrasado'
);

create type expense_category as enum (
  'logistica',
  'hospedagem',
  'comissao',
  'banda',
  'alimentacao',
  'equipamento',
  'outros'
);

create type attachment_type as enum (
  'contrato',
  'rider',
  'mapa_palco',
  'outros'
);

-- =============================================
-- ORGANIZATIONS (multi-tenancy root)
-- =============================================

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  logo_url text,
  plan plan_type not null default 'trial',
  trial_ends_at timestamptz default (now() + interval '7 days'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  base_city text,
  base_state text,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table organization_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'viewer',
  permissions jsonb default '{}',
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  unique(org_id, user_id)
);

-- =============================================
-- ARTISTS
-- =============================================

create table artists (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  photo_url text,
  bio text,
  color text default '#7c3aed',
  social_links jsonb default '{}',
  technical_rider_url text,
  contact jsonb default '{}',
  base_city text,
  base_state text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, slug)
);

-- =============================================
-- CONTRACTORS (contratantes)
-- =============================================

create table contractors (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  cnpj text,
  contact jsonb default '{}',
  city text,
  state text,
  tags text[] default '{}',
  notes text,
  rating integer check (rating between 1 and 5),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- LOCAL PARTNERS (parceiros locais)
-- =============================================

create table local_partners (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  cnpj text,
  contact jsonb default '{}',
  city text,
  state text,
  commission_default numeric(5,2) default 10,
  notes text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- SHOWS (core entity)
-- =============================================

create table shows (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  contractor_id uuid references contractors(id) on delete set null,
  local_partner_id uuid references local_partners(id) on delete set null,
  title text not null,
  status show_status not null default 'pre_reserva',
  start_at timestamptz not null,
  end_at timestamptz,
  venue_name text,
  address text,
  city text,
  state text,
  lat numeric(10,7),
  lng numeric(10,7),
  cache_value numeric(12,2) default 0,
  production_value numeric(12,2) default 0,
  currency text default 'BRL',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Show attachments
create table show_attachments (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade,
  type attachment_type not null default 'outros',
  file_url text not null,
  name text not null,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz default now()
);

-- =============================================
-- FINANCIAL
-- =============================================

create table receivables (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  description text,
  due_date date not null,
  amount numeric(12,2) not null,
  status receivable_status not null default 'pendente',
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table expenses (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  category expense_category not null default 'outros',
  description text,
  amount numeric(12,2) not null,
  paid boolean default false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Logistics calculation cache
create table logistics (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade unique,
  distance_km numeric(8,2),
  estimated_fuel_cost numeric(10,2),
  estimated_total_cost numeric(10,2),
  viability_score integer check (viability_score between 0 and 100),
  calculated_at timestamptz default now()
);

-- =============================================
-- SYSTEM
-- =============================================

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  entity text not null,
  entity_id uuid,
  action text not null,
  diff jsonb,
  created_at timestamptz default now()
);

create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- INDEXES
-- =============================================

create index idx_shows_org_id on shows(org_id);
create index idx_shows_artist_id on shows(artist_id);
create index idx_shows_start_at on shows(start_at);
create index idx_shows_status on shows(status);
create index idx_shows_org_start on shows(org_id, start_at);
create index idx_artists_org_id on artists(org_id);
create index idx_contractors_org_id on contractors(org_id);
create index idx_local_partners_org_id on local_partners(org_id);
create index idx_receivables_org_id on receivables(org_id);
create index idx_receivables_show_id on receivables(show_id);
create index idx_receivables_due_date on receivables(due_date);
create index idx_receivables_status on receivables(status);
create index idx_expenses_org_id on expenses(org_id);
create index idx_org_members_user_id on organization_members(user_id);
create index idx_notifications_user_id on notifications(user_id, read);

-- Full text search on shows
create index idx_shows_fts on shows using gin(
  to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(city,'') || ' ' || coalesce(venue_name,''))
);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on organizations
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on artists
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on contractors
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on local_partners
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on shows
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on receivables
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on expenses
  for each row execute function handle_updated_at();

-- =============================================
-- HELPER FUNCTION: get user's org_id
-- =============================================

create or replace function get_user_org_id()
returns uuid as $$
  select org_id from organization_members
  where user_id = auth.uid()
  limit 1;
$$ language sql security definer stable;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table artists enable row level security;
alter table contractors enable row level security;
alter table local_partners enable row level security;
alter table shows enable row level security;
alter table show_attachments enable row level security;
alter table receivables enable row level security;
alter table expenses enable row level security;
alter table logistics enable row level security;
alter table audit_log enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications enable row level security;

-- Organizations: members can read, owner can update
create policy "org_members_select" on organizations
  for select using (
    id in (select org_id from organization_members where user_id = auth.uid())
  );

create policy "org_owner_update" on organizations
  for update using (owner_id = auth.uid());

create policy "org_insert" on organizations
  for insert with check (owner_id = auth.uid());

-- Organization members
create policy "members_select" on organization_members
  for select using (
    org_id in (select org_id from organization_members where user_id = auth.uid())
  );

create policy "owner_manage_members" on organization_members
  for all using (
    org_id in (
      select id from organizations where owner_id = auth.uid()
    )
  );

create policy "member_insert_self" on organization_members
  for insert with check (user_id = auth.uid());

-- Artists (scoped by org)
create policy "artists_select" on artists
  for select using (org_id = get_user_org_id());
create policy "artists_insert" on artists
  for insert with check (org_id = get_user_org_id());
create policy "artists_update" on artists
  for update using (org_id = get_user_org_id());
create policy "artists_delete" on artists
  for delete using (org_id = get_user_org_id());

-- Contractors
create policy "contractors_select" on contractors
  for select using (org_id = get_user_org_id());
create policy "contractors_insert" on contractors
  for insert with check (org_id = get_user_org_id());
create policy "contractors_update" on contractors
  for update using (org_id = get_user_org_id());
create policy "contractors_delete" on contractors
  for delete using (org_id = get_user_org_id());

-- Local partners
create policy "local_partners_select" on local_partners
  for select using (org_id = get_user_org_id());
create policy "local_partners_insert" on local_partners
  for insert with check (org_id = get_user_org_id());
create policy "local_partners_update" on local_partners
  for update using (org_id = get_user_org_id());
create policy "local_partners_delete" on local_partners
  for delete using (org_id = get_user_org_id());

-- Shows
create policy "shows_select" on shows
  for select using (org_id = get_user_org_id());
create policy "shows_insert" on shows
  for insert with check (org_id = get_user_org_id());
create policy "shows_update" on shows
  for update using (org_id = get_user_org_id());
create policy "shows_delete" on shows
  for delete using (org_id = get_user_org_id());

-- Show attachments (via show)
create policy "show_attachments_select" on show_attachments
  for select using (
    show_id in (select id from shows where org_id = get_user_org_id())
  );
create policy "show_attachments_insert" on show_attachments
  for insert with check (
    show_id in (select id from shows where org_id = get_user_org_id())
  );
create policy "show_attachments_delete" on show_attachments
  for delete using (
    show_id in (select id from shows where org_id = get_user_org_id())
  );

-- Receivables
create policy "receivables_select" on receivables
  for select using (org_id = get_user_org_id());
create policy "receivables_insert" on receivables
  for insert with check (org_id = get_user_org_id());
create policy "receivables_update" on receivables
  for update using (org_id = get_user_org_id());
create policy "receivables_delete" on receivables
  for delete using (org_id = get_user_org_id());

-- Expenses
create policy "expenses_select" on expenses
  for select using (org_id = get_user_org_id());
create policy "expenses_insert" on expenses
  for insert with check (org_id = get_user_org_id());
create policy "expenses_update" on expenses
  for update using (org_id = get_user_org_id());
create policy "expenses_delete" on expenses
  for delete using (org_id = get_user_org_id());

-- Logistics
create policy "logistics_select" on logistics
  for select using (
    show_id in (select id from shows where org_id = get_user_org_id())
  );
create policy "logistics_insert" on logistics
  for insert with check (
    show_id in (select id from shows where org_id = get_user_org_id())
  );

-- Notifications (user's own)
create policy "notifications_select" on notifications
  for select using (user_id = auth.uid());
create policy "notifications_update" on notifications
  for update using (user_id = auth.uid());

-- Push subscriptions (user's own)
create policy "push_subscriptions_select" on push_subscriptions
  for select using (user_id = auth.uid());
create policy "push_subscriptions_insert" on push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "push_subscriptions_delete" on push_subscriptions
  for delete using (user_id = auth.uid());

-- Audit log (org members read, system writes)
create policy "audit_log_select" on audit_log
  for select using (org_id = get_user_org_id());
