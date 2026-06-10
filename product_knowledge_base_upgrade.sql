alter table public.products
add column if not exists model text,
add column if not exists category text,
add column if not exists application text,
add column if not exists short_description text,
add column if not exists energy_kwh numeric,
add column if not exists cell_type text,
add column if not exists bms text,
add column if not exists max_charge_current text,
add column if not exists max_discharge_current text,
add column if not exists dimensions text,
add column if not exists weight text,
add column if not exists ip_rating text,
add column if not exists compatible_inverters text,
add column if not exists currency text,
add column if not exists base_price numeric,
add column if not exists price_term text,
add column if not exists port text,
add column if not exists price_note text;

create table if not exists public.product_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  asset_type text not null,
  file_type text,
  file_name text not null,
  file_url text,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.product_assets enable row level security;

grant select, insert, update, delete on public.product_assets to authenticated;

drop policy if exists "Users can read own product assets" on public.product_assets;
drop policy if exists "Users can insert own product assets" on public.product_assets;
drop policy if exists "Users can update own product assets" on public.product_assets;
drop policy if exists "Users can delete own product assets" on public.product_assets;

create policy "Users can read own product assets"
on public.product_assets for select
using (
  exists (
    select 1 from public.products
    where public.products.id = public.product_assets.product_id
    and public.products.created_by = auth.uid()
  )
);

create policy "Users can insert own product assets"
on public.product_assets for insert
with check (
  exists (
    select 1 from public.products
    where public.products.id = public.product_assets.product_id
    and public.products.created_by = auth.uid()
  )
);

create policy "Users can update own product assets"
on public.product_assets for update
using (
  exists (
    select 1 from public.products
    where public.products.id = public.product_assets.product_id
    and public.products.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.products
    where public.products.id = public.product_assets.product_id
    and public.products.created_by = auth.uid()
  )
);

create policy "Users can delete own product assets"
on public.product_assets for delete
using (
  exists (
    select 1 from public.products
    where public.products.id = public.product_assets.product_id
    and public.products.created_by = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', false),
  ('product-files', 'product-files', false)
on conflict (id) do nothing;

drop policy if exists "Users can read own product image objects" on storage.objects;
drop policy if exists "Users can upload own product image objects" on storage.objects;
drop policy if exists "Users can delete own product image objects" on storage.objects;
drop policy if exists "Users can read own product file objects" on storage.objects;
drop policy if exists "Users can upload own product file objects" on storage.objects;
drop policy if exists "Users can delete own product file objects" on storage.objects;

create policy "Users can read own product image objects"
on storage.objects for select
using (
  bucket_id = 'product-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload own product image objects"
on storage.objects for insert
with check (
  bucket_id = 'product-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own product image objects"
on storage.objects for delete
using (
  bucket_id = 'product-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read own product file objects"
on storage.objects for select
using (
  bucket_id = 'product-files'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload own product file objects"
on storage.objects for insert
with check (
  bucket_id = 'product-files'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own product file objects"
on storage.objects for delete
using (
  bucket_id = 'product-files'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
