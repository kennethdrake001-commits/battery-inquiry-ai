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
