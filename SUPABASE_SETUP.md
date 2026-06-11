# Supabase 手动配置记录

这份文件用于记录当前项目上线过程中**需要在 Supabase 后台手动确认或执行**的配置，避免以后忘记。

注意：

- 本文件只是记录，不会自动修改线上数据库。
- 如果线上已经执行过，不需要重复执行。
- 以下 SQL 请在 **Supabase SQL Editor** 中按需执行。

## 1. customers 工作流字段

如果 `customers` 表还没有这些字段，请执行：

```sql
alter table public.customers
add column if not exists customer_type text,
add column if not exists stage text,
add column if not exists lead_level text,
add column if not exists quantity text,
add column if not exists shipping_term text,
add column if not exists destination_city text,
add column if not exists next_action text,
add column if not exists missing_info text,
add column if not exists follow_up_date date;
```

如果还缺少任务/跟进辅助字段，再执行：

```sql
alter table public.customers add column if not exists current_next_action text;
alter table public.customers add column if not exists next_follow_up_at timestamptz;
alter table public.customers add column if not exists last_contacted_at timestamptz;
alter table public.customers add column if not exists last_customer_reply_at timestamptz;
alter table public.customers add column if not exists last_quote_at timestamptz;
```

## 2. products 删除权限

当前产品库页面支持“归档 / 删除”。

如果删除产品时报：

- `permission denied for table products`

请确认 `products` 表有 `delete` grant 和 delete policy：

```sql
grant delete on public.products to authenticated;

drop policy if exists "Users can delete own products" on public.products;

create policy "Users can delete own products"
on public.products for delete
using (auth.uid() = created_by);
```

## 3. product_assets 表权限

产品主图、规格书、认证文件上传，依赖 `product_assets` 表。

如果还没有这张表，可执行：

```sql
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
```

开启 RLS 并授权：

```sql
alter table public.product_assets enable row level security;

grant select, insert, update, delete on public.product_assets to authenticated;
```

按产品归属控制 `product_assets`：

```sql
drop policy if exists "Users can read own product assets" on public.product_assets;
drop policy if exists "Users can insert own product assets" on public.product_assets;
drop policy if exists "Users can update own product assets" on public.product_assets;
drop policy if exists "Users can delete own product assets" on public.product_assets;

create policy "Users can read own product assets"
on public.product_assets for select
using (
  exists (
    select 1
    from public.products
    where public.products.id = public.product_assets.product_id
      and public.products.created_by = auth.uid()
  )
);

create policy "Users can insert own product assets"
on public.product_assets for insert
with check (
  exists (
    select 1
    from public.products
    where public.products.id = public.product_assets.product_id
      and public.products.created_by = auth.uid()
  )
);

create policy "Users can update own product assets"
on public.product_assets for update
using (
  exists (
    select 1
    from public.products
    where public.products.id = public.product_assets.product_id
      and public.products.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.products
    where public.products.id = public.product_assets.product_id
      and public.products.created_by = auth.uid()
  )
);

create policy "Users can delete own product assets"
on public.product_assets for delete
using (
  exists (
    select 1
    from public.products
    where public.products.id = public.product_assets.product_id
      and public.products.created_by = auth.uid()
  )
);
```

## 4. Storage：product-assets bucket

当前产品库代码统一使用的 bucket 名称是：

- `product-assets`

这不是 `product-images`
也不是 `product-files`

### 手动创建 bucket

请在 Supabase Storage 中手动创建：

- Bucket name: `product-assets`
- Public: `false`

也可以用 SQL 记录方式：

```sql
insert into storage.buckets (id, name, public)
values ('product-assets', 'product-assets', false)
on conflict (id) do nothing;
```

## 5. storage.objects 对应权限

当前产品文件上传路径格式是：

```text
products/{productId}/{assetType}/{timestamp}-{safeFileName}
```

例如：

```text
products/a92522f8-5552-4c80-b6f2-83274be21d59/datasheet/1781189776844-file.pdf
```

所以 `storage.objects` 的策略应该基于：

- bucket = `product-assets`
- 第 2 段路径是 `productId`
- `productId` 对应的 `products.created_by = auth.uid()`

建议策略：

```sql
drop policy if exists "Users can read own product asset objects" on storage.objects;
drop policy if exists "Users can upload own product asset objects" on storage.objects;
drop policy if exists "Users can delete own product asset objects" on storage.objects;

create policy "Users can read own product asset objects"
on storage.objects for select
using (
  bucket_id = 'product-assets'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 1) = 'products'
  and exists (
    select 1
    from public.products
    where public.products.id::text = split_part(name, '/', 2)
      and public.products.created_by = auth.uid()
  )
);

create policy "Users can upload own product asset objects"
on storage.objects for insert
with check (
  bucket_id = 'product-assets'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 1) = 'products'
  and exists (
    select 1
    from public.products
    where public.products.id::text = split_part(name, '/', 2)
      and public.products.created_by = auth.uid()
  )
);

create policy "Users can delete own product asset objects"
on storage.objects for delete
using (
  bucket_id = 'product-assets'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 1) = 'products'
  and exists (
    select 1
    from public.products
    where public.products.id::text = split_part(name, '/', 2)
      and public.products.created_by = auth.uid()
  )
);
```

## 6. 当前产品上传逻辑依赖

前端产品上传要正常工作，需要同时满足：

1. `products.created_by` 正确写入当前登录用户 ID
2. `product_assets` RLS 允许通过 `product_id -> products.created_by` 判断归属
3. `storage.objects` 对 `product-assets` bucket 有对应 select / insert / delete policy
4. `product-assets` bucket 已创建

## 7. 推荐检查顺序

如果产品上传/预览/删除异常，建议按这个顺序排查：

1. `product-assets` bucket 是否存在
2. 新建产品时 `created_by` 是否正确写入
3. `product_assets` insert policy 是否存在
4. `products` delete policy 是否存在
5. `storage.objects` 对 `product-assets` 的策略是否存在

