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
  final_english_reply text,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.customer_analyses enable row level security;

drop policy if exists "Users can read own customers" on public.customers;
drop policy if exists "Users can insert own customers" on public.customers;
drop policy if exists "Users can update own customers" on public.customers;
drop policy if exists "Users can read own analyses" on public.customer_analyses;
drop policy if exists "Users can insert own analyses" on public.customer_analyses;

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
