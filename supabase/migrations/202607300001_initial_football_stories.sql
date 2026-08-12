begin;

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'user');
create type public.user_status as enum ('active', 'suspended', 'banned');
create type public.content_status as enum ('draft', 'published');
create type public.comment_status as enum ('visible', 'hidden', 'deleted');
create type public.report_status as enum ('pending', 'ignored', 'warned', 'locked');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  username text not null unique check (char_length(username) between 3 and 30),
  avatar text,
  role public.user_role not null default 'user',
  status public.user_status not null default 'active',
  bio text check (char_length(bio) <= 500),
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  thumbnail text,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  cover_image text,
  author_id uuid references public.users(id) on delete set null,
  series_id uuid references public.series(id) on delete set null,
  status public.content_status not null default 'draft',
  view_count integer not null default 0 check (view_count >= 0),
  featured boolean not null default false,
  meta_title text,
  meta_desc text,
  og_image text,
  tsv tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 3000),
  image_url text,
  status public.comment_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.likes (
  user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.bookmarks (
  user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.follows (
  user_id uuid not null references public.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid not null references public.users(id) on delete cascade,
  reason text not null,
  description text,
  status public.report_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_address text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create table public.ip_blocks (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null unique,
  attempt_count integer not null default 0,
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_published_idx on public.posts (status, published_at desc);
create index posts_series_idx on public.posts (series_id, published_at desc);
create index posts_featured_idx on public.posts (featured) where featured = true;
create index posts_search_idx on public.posts using gin (tsv);
create index comments_post_idx on public.comments (post_id, created_at);
create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);
create index login_attempts_ip_idx on public.login_attempts (ip_address, attempted_at desc);
create index login_attempts_email_idx on public.login_attempts (email, attempted_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger series_set_updated_at before update on public.series
for each row execute function public.set_updated_at();
create trigger posts_set_updated_at before update on public.posts
for each row execute function public.set_updated_at();
create trigger comments_set_updated_at before update on public.comments
for each row execute function public.set_updated_at();
create trigger ip_blocks_set_updated_at before update on public.ip_blocks
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, username)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'fan_' || substr(new.id::text, 1, 8))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.users enable row level security;
alter table public.series enable row level security;
alter table public.posts enable row level security;
alter table public.tags enable row level security;
alter table public.post_tags enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.login_attempts enable row level security;
alter table public.ip_blocks enable row level security;

create policy "public profiles are readable" on public.users for select using (true);
create policy "users update own profile" on public.users for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "admins manage users" on public.users for all using (public.is_admin()) with check (public.is_admin());

create policy "published series are public" on public.series for select using (status = 'published' or public.is_admin());
create policy "admins manage series" on public.series for all using (public.is_admin()) with check (public.is_admin());
create policy "published posts are public" on public.posts for select using (status = 'published' or public.is_admin());
create policy "admins manage posts" on public.posts for all using (public.is_admin()) with check (public.is_admin());
create policy "tags are public" on public.tags for select using (true);
create policy "admins manage tags" on public.tags for all using (public.is_admin()) with check (public.is_admin());
create policy "post tags are public" on public.post_tags for select using (true);
create policy "admins manage post tags" on public.post_tags for all using (public.is_admin()) with check (public.is_admin());

create policy "visible comments are public" on public.comments for select using (status = 'visible' or auth.uid() = user_id or public.is_admin());
create policy "authenticated users create comments" on public.comments for insert to authenticated with check (auth.uid() = user_id);
create policy "users delete own comments" on public.comments for delete using (auth.uid() = user_id or public.is_admin());
create policy "admins moderate comments" on public.comments for update using (public.is_admin()) with check (public.is_admin());

create policy "users manage own likes" on public.likes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "likes counts are public" on public.likes for select using (true);
create policy "users manage own bookmarks" on public.bookmarks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own follows" on public.follows for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users read own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "users update own notifications" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins create notifications" on public.notifications for insert to authenticated with check (public.is_admin());
create policy "users submit reports" on public.reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "admins manage reports" on public.reports for all using (public.is_admin()) with check (public.is_admin());
create policy "login attempts can be inserted" on public.login_attempts for insert with check (true);
create policy "ip blocks can be read" on public.ip_blocks for select using (true);
create policy "ip blocks can be created" on public.ip_blocks for insert with check (true);
create policy "ip blocks can be updated" on public.ip_blocks for update using (true) with check (true);

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('post-covers', 'post-covers', true),
  ('comment-images', 'comment-images', true)
on conflict (id) do update set public = excluded.public;

create policy "public media is readable" on storage.objects for select using (bucket_id in ('avatars', 'post-covers', 'comment-images'));
create policy "users upload own avatars" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own avatars" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users upload comment images" on storage.objects for insert to authenticated
with check (bucket_id = 'comment-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "admins manage post covers" on storage.objects for all to authenticated
using (bucket_id = 'post-covers' and public.is_admin())
with check (bucket_id = 'post-covers' and public.is_admin());

insert into public.series (name, slug, description, status)
values
  ('Phân tích chiến thuật', 'tactical-analysis', 'Mổ xẻ hệ thống, cách vận hành và những thay đổi chiến thuật định đoạt trận đấu.', 'published'),
  ('Huyền thoại sân cỏ', 'football-legends', 'Chân dung những cầu thủ và huấn luyện viên đã để lại dấu ấn lâu dài.', 'published'),
  ('Lịch sử câu lạc bộ', 'club-history', 'Những giai đoạn, con người và bước ngoặt tạo nên bản sắc của các câu lạc bộ.', 'published'),
  ('Chuyện World Cup', 'world-cup-stories', 'Các trận đấu, nhân vật và ký ức đáng nhớ trong lịch sử World Cup.', 'published')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status;

insert into public.tags (name, slug)
values
  ('Chiến thuật', 'chien-thuat'),
  ('Premier League', 'premier-league'),
  ('Champions League', 'champions-league'),
  ('World Cup', 'world-cup'),
  ('Đội tuyển Việt Nam', 'doi-tuyen-viet-nam'),
  ('V-League', 'v-league'),
  ('Chuyển nhượng', 'chuyen-nhuong'),
  ('Huyền thoại', 'huyen-thoai')
on conflict (slug) do update set name = excluded.name;

commit;
