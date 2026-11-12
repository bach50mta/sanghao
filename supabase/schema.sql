-- Schema đồng bộ dữ liệu Đại lý Thức ăn chăn nuôi Sáng Hào trên Supabase
-- Chạy toàn bộ file này trong Supabase -> SQL Editor -> New query -> Run

create table if not exists public.products (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_slips (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.debt_payments (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Bật Row Level Security và cho phép Mini App (anon) đọc/ghi
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.delivery_slips enable row level security;
alter table public.debt_payments enable row level security;

drop policy if exists "Allow anon all products" on public.products;
create policy "Allow anon all products" on public.products
  for all to anon using (true) with check (true);

drop policy if exists "Allow anon all orders" on public.orders;
create policy "Allow anon all orders" on public.orders
  for all to anon using (true) with check (true);

drop policy if exists "Allow anon all delivery_slips" on public.delivery_slips;
create policy "Allow anon all delivery_slips" on public.delivery_slips
  for all to anon using (true) with check (true);

drop policy if exists "Allow anon all debt_payments" on public.debt_payments;
create policy "Allow anon all debt_payments" on public.debt_payments
  for all to anon using (true) with check (true);

-- Bật Realtime để đơn mới tự nhảy về máy Admin theo thời gian thực
do $$
begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.delivery_slips;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.debt_payments;
exception when duplicate_object then null;
end $$;

