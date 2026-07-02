-- ═════════════════════════════════════════════════════════════════
-- Múul · Initial migration (extensions, RLS, triggers)
-- Run AFTER `drizzle-kit generate` has created the schema migration.
-- This file adds what Drizzle can't express on its own.
-- ═════════════════════════════════════════════════════════════════

-- ─── Extensions ───────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists postgis;
create extension if not exists pg_trgm;  -- para búsqueda por similitud

-- ─── Trigger: sync auth.users → public.users ──────────────────────
-- Cuando alguien se registra en Supabase Auth, esto crea su fila
-- en public.users automáticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Trigger: updated_at automático ───────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users
  for each row execute function public.touch_updated_at();
create trigger merchants_updated_at before update on public.merchants
  for each row execute function public.touch_updated_at();
create trigger listings_updated_at before update on public.listings
  for each row execute function public.touch_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function public.touch_updated_at();

-- ═════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- Por defecto Postgres permite todo. Activamos RLS y luego damos
-- permisos quirúrgicos.
-- ═════════════════════════════════════════════════════════════════

alter table public.users          enable row level security;
alter table public.merchants      enable row level security;
alter table public.merchant_users enable row level security;
alter table public.listings       enable row level security;
alter table public.products       enable row level security;
alter table public.services       enable row level security;
alter table public.availability_slots enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.bookings       enable row level security;
alter table public.reviews        enable row level security;
alter table public.notifications  enable row level security;

-- categories y pickup_points son públicos read-only
alter table public.categories     enable row level security;
alter table public.pickup_points  enable row level security;

create policy "categories: public read"
  on public.categories for select using (true);
create policy "pickup_points: public read"
  on public.pickup_points for select using (active);

-- ─── Helper function: ¿el user actual administra este merchant? ──
create or replace function public.is_merchant_admin(merchant uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.merchant_users
    where merchant_id = merchant
      and user_id = auth.uid()
  );
$$;

-- ─── users ────────────────────────────────────────────────────────
create policy "users: read own"
  on public.users for select
  using (id = auth.uid());

create policy "users: update own"
  on public.users for update
  using (id = auth.uid());

-- ─── merchants ───────────────────────────────────────────────────
create policy "merchants: public read active"
  on public.merchants for select
  using (status = 'active');

create policy "merchants: admin read all"
  on public.merchants for select
  using (public.is_merchant_admin(id));

create policy "merchants: admin update"
  on public.merchants for update
  using (public.is_merchant_admin(id));

-- INSERT de merchants se hace solo via service role (API onboarding).

-- ─── merchant_users ──────────────────────────────────────────────
create policy "merchant_users: read own merchants"
  on public.merchant_users for select
  using (user_id = auth.uid() or public.is_merchant_admin(merchant_id));

-- ─── listings (+ products + services) ────────────────────────────
create policy "listings: public read live"
  on public.listings for select
  using (status = 'live');

create policy "listings: admin all"
  on public.listings for all
  using (public.is_merchant_admin(merchant_id))
  with check (public.is_merchant_admin(merchant_id));

create policy "products: public read"
  on public.products for select using (
    exists (select 1 from public.listings l
            where l.id = listing_id and l.status = 'live')
  );

create policy "products: admin all"
  on public.products for all
  using (
    exists (select 1 from public.listings l
            where l.id = listing_id and public.is_merchant_admin(l.merchant_id))
  );

create policy "services: public read"
  on public.services for select using (
    exists (select 1 from public.listings l
            where l.id = listing_id and l.status = 'live')
  );

create policy "services: admin all"
  on public.services for all
  using (
    exists (select 1 from public.listings l
            where l.id = listing_id and public.is_merchant_admin(l.merchant_id))
  );

-- ─── availability_slots ──────────────────────────────────────────
create policy "slots: public read future"
  on public.availability_slots for select
  using (starts_at >= now());

create policy "slots: admin all"
  on public.availability_slots for all
  using (
    exists (
      select 1 from public.services s
      join public.listings l on l.id = s.listing_id
      where s.listing_id = service_listing_id
        and public.is_merchant_admin(l.merchant_id)
    )
  );

-- ─── orders ───────────────────────────────────────────────────────
create policy "orders: customer read own"
  on public.orders for select
  using (customer_id = auth.uid());

create policy "orders: merchant read own"
  on public.orders for select
  using (public.is_merchant_admin(merchant_id));

-- INSERT/UPDATE de orders solo via service role (checkout API + webhooks)

-- ─── bookings ─────────────────────────────────────────────────────
create policy "bookings: customer read own"
  on public.bookings for select
  using (customer_id = auth.uid());

create policy "bookings: merchant read own"
  on public.bookings for select
  using (
    exists (
      select 1 from public.availability_slots s
      join public.services svc on svc.listing_id = s.service_listing_id
      join public.listings l on l.id = svc.listing_id
      where s.id = slot_id and public.is_merchant_admin(l.merchant_id)
    )
  );

-- ─── reviews ──────────────────────────────────────────────────────
create policy "reviews: public read"
  on public.reviews for select using (true);

create policy "reviews: author insert if order completed"
  on public.reviews for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.customer_id = auth.uid()
        and o.status = 'completed'
    )
  );

-- ─── notifications ────────────────────────────────────────────────
create policy "notifications: read own"
  on public.notifications for select
  using (user_id = auth.uid());
