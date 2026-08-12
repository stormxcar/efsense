begin;

-- Client-side login protection is unsafe. Only service_role may access these tables.
drop policy if exists "login attempts can be inserted" on public.login_attempts;
drop policy if exists "ip blocks can be read" on public.ip_blocks;
drop policy if exists "ip blocks can be created" on public.ip_blocks;
drop policy if exists "ip blocks can be updated" on public.ip_blocks;
revoke all on table public.login_attempts from anon, authenticated;
revoke all on table public.ip_blocks from anon, authenticated;

-- Atomic, deduplicated view analytics.
create table public.post_view_events (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_hash text not null,
  user_id uuid references public.users(id) on delete set null,
  viewed_at timestamptz not null default now()
);
create index post_view_events_post_time_idx on public.post_view_events (post_id, viewed_at desc);
create index post_view_events_viewer_time_idx on public.post_view_events (viewer_hash, viewed_at desc);
alter table public.post_view_events enable row level security;
revoke all on table public.post_view_events from anon, authenticated;

create or replace function public.record_post_view(p_post_id uuid, p_visitor_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_count integer;
begin
  if p_visitor_key is null or char_length(p_visitor_key) < 8 then
    raise exception 'invalid visitor key';
  end if;

  v_hash := encode(extensions.digest(p_visitor_key, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_post_id::text || v_hash, 0));

  if not exists (
    select 1 from public.post_view_events
    where post_id = p_post_id
      and viewer_hash = v_hash
      and viewed_at > now() - interval '30 minutes'
  ) then
    insert into public.post_view_events (post_id, viewer_hash, user_id)
    values (p_post_id, v_hash, auth.uid());

    update public.posts
    set view_count = view_count + 1
    where id = p_post_id and status = 'published'
    returning view_count into v_count;
  else
    select view_count into v_count from public.posts where id = p_post_id;
  end if;

  return coalesce(v_count, 0);
end;
$$;
grant execute on function public.record_post_view(uuid, text) to anon, authenticated;

create or replace function public.weekly_popular_posts(p_limit integer default 20)
returns table(post_id uuid, weekly_views bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.post_id, count(*)::bigint
  from public.post_view_events e
  join public.posts p on p.id = e.post_id
  where e.viewed_at >= now() - interval '7 days'
    and p.status = 'published'
  group by e.post_id
  order by count(*) desc
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.weekly_popular_posts(integer) to anon, authenticated;

-- Editorial metadata and primary football classifications.
alter table public.posts
  add column image_alt text,
  add column image_credit text,
  add column image_source_url text,
  add column scheduled_at timestamptz;

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  country text,
  logo_url text,
  created_at timestamptz not null default now()
);
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  league_id uuid references public.leagues(id) on delete set null,
  logo_url text,
  created_at timestamptz not null default now()
);
create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  club_id uuid references public.clubs(id) on delete set null,
  photo_url text,
  created_at timestamptz not null default now()
);
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

alter table public.posts
  add column league_id uuid references public.leagues(id) on delete set null,
  add column club_id uuid references public.clubs(id) on delete set null,
  add column player_id uuid references public.players(id) on delete set null,
  add column season_id uuid references public.seasons(id) on delete set null;

create index posts_league_published_idx on public.posts (league_id, published_at desc);
create index posts_club_published_idx on public.posts (club_id, published_at desc);
create index posts_player_published_idx on public.posts (player_id, published_at desc);
create index posts_season_published_idx on public.posts (season_id, published_at desc);
create index posts_scheduled_idx on public.posts (scheduled_at) where scheduled_at is not null;

alter table public.leagues enable row level security;
alter table public.clubs enable row level security;
alter table public.players enable row level security;
alter table public.seasons enable row level security;
create policy "leagues are public" on public.leagues for select using (true);
create policy "clubs are public" on public.clubs for select using (true);
create policy "players are public" on public.players for select using (true);
create policy "seasons are public" on public.seasons for select using (true);
create policy "admins manage leagues" on public.leagues for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage clubs" on public.clubs for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage players" on public.players for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage seasons" on public.seasons for all using (public.is_admin()) with check (public.is_admin());

-- Gallery assets with proper attribution.
create table public.post_gallery_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  image_url text not null,
  image_alt text not null default '',
  caption text,
  image_credit text,
  image_source_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index post_gallery_images_order_idx on public.post_gallery_images (post_id, sort_order);
alter table public.post_gallery_images enable row level security;
create policy "published galleries are public" on public.post_gallery_images for select
using (exists (select 1 from public.posts where posts.id = post_id and (posts.status = 'published' or public.is_admin())));
create policy "admins manage galleries" on public.post_gallery_images for all
using (public.is_admin()) with check (public.is_admin());

-- Newsletter signup is exposed only through a validating RPC.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('pending', 'active', 'unsubscribed')),
  confirmation_token uuid not null default gen_random_uuid(),
  subscribed_at timestamptz not null default now(),
  confirmed_at timestamptz
);
alter table public.newsletter_subscribers enable row level security;
revoke all on table public.newsletter_subscribers from anon, authenticated;

create or replace function public.subscribe_newsletter(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' collate "C" then
    raise exception 'invalid email';
  end if;
  insert into public.newsletter_subscribers (email, status, confirmed_at)
  values (v_email, 'active', now())
  on conflict (email) do update set
    status = 'active',
    confirmed_at = coalesce(public.newsletter_subscribers.confirmed_at, now()),
    subscribed_at = now();
  return 'active';
end;
$$;
grant execute on function public.subscribe_newsletter(text) to anon, authenticated;

insert into public.leagues (name, slug, country) values
  ('Premier League', 'premier-league', 'Anh'),
  ('Champions League', 'champions-league', 'Châu Âu'),
  ('V-League 1', 'v-league-1', 'Việt Nam'),
  ('La Liga', 'la-liga', 'Tây Ban Nha'),
  ('Serie A', 'serie-a', 'Ý')
on conflict (slug) do nothing;

insert into public.seasons (name, slug, starts_on, ends_on) values
  ('2025/26', '2025-26', '2025-07-01', '2026-06-30'),
  ('2026/27', '2026-27', '2026-07-01', '2027-06-30')
on conflict (slug) do nothing;

commit;
