create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text,
  country text,
  source text,
  original_message text,
  our_reply text,
  quoted boolean default false,
  quote_content text,
  current_status text,
  question text,
  latest_analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  input_snapshot jsonb not null,
  analysis jsonb not null,
  ai_suggested_reply text,
  final_english_reply text,
  final_sent_reply text,
  reply_modified boolean default false,
  created_at timestamptz not null default now()
);

alter table public.customer_analyses
add column if not exists ai_suggested_reply text;

alter table public.customer_analyses
add column if not exists final_sent_reply text;

alter table public.customer_analyses
add column if not exists reply_modified boolean default false;

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  related_ai_analysis_id uuid references public.customer_analyses(id) on delete set null,
  original_message text,
  our_reply text,
  ai_analysis jsonb,
  ai_suggested_reply text,
  final_sent_reply text,
  reply_modified boolean default false,
  interaction_status text default 'draft',
  sent_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  customer_new_reply text,
  result_feedback text,
  failure_reason text,
  operator_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playbook_cases (
  id uuid primary key default gen_random_uuid(),
  scene_name text,
  customer_type text,
  stage text,
  problem text,
  effective_reply text,
  result text,
  reply_tag text,
  notes text,
  source_customer_id uuid references public.customers(id) on delete set null,
  source_interaction_id uuid references public.interactions(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_name text,
  common_name text,
  voltage text,
  capacity_kwh numeric,
  capacity_ah numeric,
  battery_type text,
  installation_type text,
  bms_current text,
  discharge_rate text,
  communication text,
  parallel_support text,
  cycle_life text,
  certifications text,
  warranty text,
  fob_price text,
  fob_port text,
  moq text,
  lead_time text,
  suitable_customers text,
  suitable_scenarios text,
  risk_notes text,
  status text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.customer_analyses enable row level security;
alter table public.interactions enable row level security;
alter table public.playbook_cases enable row level security;
alter table public.products enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.customer_analyses to authenticated;
grant select, insert, update on public.interactions to authenticated;
grant select, insert, update on public.playbook_cases to authenticated;
grant select, insert, update on public.products to authenticated;

drop policy if exists "Users can read own customers" on public.customers;
drop policy if exists "Users can insert own customers" on public.customers;
drop policy if exists "Users can update own customers" on public.customers;
drop policy if exists "Users can read own analyses" on public.customer_analyses;
drop policy if exists "Users can insert own analyses" on public.customer_analyses;
drop policy if exists "Users can update own analyses" on public.customer_analyses;
drop policy if exists "Users can read own interactions" on public.interactions;
drop policy if exists "Users can insert own interactions" on public.interactions;
drop policy if exists "Users can update own interactions" on public.interactions;
drop policy if exists "Users can read own playbook cases" on public.playbook_cases;
drop policy if exists "Users can insert own playbook cases" on public.playbook_cases;
drop policy if exists "Users can update own playbook cases" on public.playbook_cases;
drop policy if exists "Users can read own products" on public.products;
drop policy if exists "Users can insert own products" on public.products;
drop policy if exists "Users can update own products" on public.products;

create policy "Users can read own customers"
on public.customers for select
using (auth.uid() = user_id);

create policy "Users can insert own customers"
on public.customers for insert
with check (auth.uid() = user_id);

create policy "Users can update own customers"
on public.customers for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own analyses"
on public.customer_analyses for select
using (auth.uid() = user_id);

create policy "Users can insert own analyses"
on public.customer_analyses for insert
with check (auth.uid() = user_id);

create policy "Users can update own analyses"
on public.customer_analyses for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own interactions"
on public.interactions for select
using (auth.uid() = user_id);

create policy "Users can insert own interactions"
on public.interactions for insert
with check (auth.uid() = user_id);

create policy "Users can update own interactions"
on public.interactions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own playbook cases"
on public.playbook_cases for select
using (auth.uid() = created_by);

create policy "Users can insert own playbook cases"
on public.playbook_cases for insert
with check (auth.uid() = created_by);

create policy "Users can update own playbook cases"
on public.playbook_cases for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

create policy "Users can read own products"
on public.products for select
using (auth.uid() = created_by);

create policy "Users can insert own products"
on public.products for insert
with check (auth.uid() = created_by);

create policy "Users can update own products"
on public.products for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);
