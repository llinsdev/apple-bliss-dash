
-- Enum de roles
create type public.app_role as enum ('admin', 'vendedor');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role security definer (evita recursão em RLS)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Sales
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  product_name text not null,
  category text not null check (category in ('Aparelho','Acessório')),
  sale_value numeric(12,2) not null check (sale_value >= 0),
  commission_percentage numeric(5,2) not null check (commission_percentage >= 0),
  commission_value numeric(12,2) not null default 0,
  sale_date date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.sales enable row level security;
create index sales_seller_date_idx on public.sales(seller_id, sale_date desc);

-- Trigger: calcula commission_value
create or replace function public.set_commission_value()
returns trigger
language plpgsql
as $$
begin
  new.commission_value := round(new.sale_value * new.commission_percentage / 100, 2);
  return new;
end;
$$;

create trigger sales_set_commission
  before insert or update of sale_value, commission_percentage on public.sales
  for each row execute function public.set_commission_value();

-- Goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_value numeric(12,2) not null check (target_value >= 0),
  target_type text not null check (target_type in ('diaria','semanal','mensal')),
  category_focus text not null check (category_focus in ('total','acessorios')),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now()
);
alter table public.goals enable row level security;
create index goals_user_idx on public.goals(user_id);

-- Trigger: cria profile + role 'vendedor' no signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  insert into public.user_roles (user_id, role)
  values (new.id, 'vendedor');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== RLS Policies =====

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "user_roles_select_own_or_admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "user_roles_admin_write" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- sales
create policy "sales_select_own_or_admin" on public.sales
  for select to authenticated
  using (seller_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "sales_insert_own_or_admin" on public.sales
  for insert to authenticated
  with check (seller_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "sales_update_own_or_admin" on public.sales
  for update to authenticated
  using (seller_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (seller_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "sales_delete_own_or_admin" on public.sales
  for delete to authenticated
  using (seller_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- goals
create policy "goals_select_own_or_admin" on public.goals
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "goals_admin_write" on public.goals
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
