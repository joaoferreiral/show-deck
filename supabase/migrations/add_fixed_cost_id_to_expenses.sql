-- Link expenses back to the fixed cost that originated them (nullable)
alter table expenses
  add column if not exists fixed_cost_id uuid references fixed_costs(id) on delete set null;

create index if not exists expenses_fixed_cost_id_idx on expenses (fixed_cost_id);
