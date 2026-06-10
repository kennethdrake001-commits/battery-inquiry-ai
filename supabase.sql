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
  customer_type text,
  stage text,
  lead_level text,
  next_action text,
  missing_info text,
  follow_up_date date,
  quantity text,
  destination_city text,
  shipping_term text,
  latest_analysis jsonb,
  current_next_action text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  last_customer_reply_at timestamptz,
  last_quote_at timestamptz,
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

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  quote_version text,
  product text,
  quantity text,
  unit_price text,
  total_price text,
  trade_term text,
  port_or_address text,
  valid_until date,
  quote_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.customers add column if not exists current_next_action text;
alter table public.customers add column if not exists next_follow_up_at timestamptz;
alter table public.customers add column if not exists last_contacted_at timestamptz;
alter table public.customers add column if not exists last_customer_reply_at timestamptz;
alter table public.customers add column if not exists last_quote_at timestamptz;
alter table public.customers add column if not exists customer_type text;
alter table public.customers add column if not exists stage text;
alter table public.customers add column if not exists lead_level text;
alter table public.customers add column if not exists next_action text;
alter table public.customers add column if not exists missing_info text;
alter table public.customers add column if not exists follow_up_date date;
alter table public.customers add column if not exists quantity text;
alter table public.customers add column if not exists destination_city text;
alter table public.customers add column if not exists shipping_term text;

alter table public.customers enable row level security;
alter table public.customer_analyses enable row level security;
alter table public.interactions enable row level security;
alter table public.playbook_cases enable row level security;
alter table public.products enable row level security;
alter table public.quotes enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.customer_analyses to authenticated;
grant select, insert, update on public.interactions to authenticated;
grant select, insert, update on public.playbook_cases to authenticated;
grant select, insert, update on public.products to authenticated;
grant select, insert, update on public.quotes to authenticated;

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
drop policy if exists "Users can read own quotes" on public.quotes;
drop policy if exists "Users can insert own quotes" on public.quotes;
drop policy if exists "Users can update own quotes" on public.quotes;

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

create policy "Users can read own quotes"
on public.quotes for select
using (
  exists (
    select 1 from public.customers
    where public.customers.id = public.quotes.customer_id
    and public.customers.user_id = auth.uid()
  )
);

create policy "Users can insert own quotes"
on public.quotes for insert
with check (
  auth.uid() = created_by
  and exists (
    select 1 from public.customers
    where public.customers.id = public.quotes.customer_id
    and public.customers.user_id = auth.uid()
  )
);

create policy "Users can update own quotes"
on public.quotes for update
using (
  exists (
    select 1 from public.customers
    where public.customers.id = public.quotes.customer_id
    and public.customers.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.customers
    where public.customers.id = public.quotes.customer_id
    and public.customers.user_id = auth.uid()
  )
);
