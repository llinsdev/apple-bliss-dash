create table public.bling_oauth (
  id text primary key default 'default',
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bling_oauth_singleton check (id = 'default')
);

alter table public.bling_oauth enable row level security;

create policy bling_oauth_admin_all on public.bling_oauth
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

insert into public.bling_oauth (id) values ('default') on conflict do nothing;