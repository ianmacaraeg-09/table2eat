-- ============================================================
-- Table2Eat — Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ---------------- BOOKINGS ----------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  name text not null,
  phone text not null,
  email text not null,
  date date not null,
  time text not null,
  party int not null,
  notes text,
  fee numeric not null,
  receipt_path text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

-- Customers (unauthenticated) can submit a booking, but only ever insert —
-- never read, update, or delete other people's reservation details.
create policy "Anyone can submit a booking"
  on public.bookings for insert
  to anon
  with check (true);

-- Staff (signed in) manage everything.
create policy "Staff can view bookings"
  on public.bookings for select
  to authenticated
  using (true);

create policy "Staff can update bookings"
  on public.bookings for update
  to authenticated
  using (true)
  with check (true);

-- ---------------- INVENTORY ----------------
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text not null,
  qty numeric not null default 0,
  reorder numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory enable row level security;

-- Inventory is staff-only, full stop — no anon policy at all means
-- unauthenticated requests are denied by default.
create policy "Staff can manage inventory"
  on public.inventory for all
  to authenticated
  using (true)
  with check (true);

-- keep updated_at current on edits
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

-- ---------------- STORAGE (payment receipts) ----------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Customers can upload their payment screenshot but never list/read others'.
create policy "Anyone can upload a receipt"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'receipts');

-- Staff can view receipts (via signed URLs generated server/client-side).
create policy "Staff can view receipts"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipts');

-- ---------------- SEED: starter inventory (optional) ----------------
insert into public.inventory (name, category, unit, qty, reorder) values
  ('Salmon Fillet', 'Meat & Seafood', 'kg', 8, 5),
  ('Duck Breast', 'Meat & Seafood', 'pcs', 3, 6),
  ('Baby Spinach', 'Produce', 'kg', 2, 3),
  ('Heirloom Tomatoes', 'Produce', 'kg', 0, 4),
  ('Tagliatelle Pasta', 'Dry Goods', 'kg', 12, 5),
  ('Heavy Cream', 'Dairy', 'L', 6, 4),
  ('Sparkling Water', 'Beverage', 'bottles', 40, 20),
  ('House Red Wine', 'Bar', 'bottles', 5, 8)
on conflict do nothing;
