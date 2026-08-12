begin;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  post_type text not null default 'discussion' check (post_type in ('discussion', 'reel', 'showcase')),
  title text,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  media_url text,
  media_public_id text,
  media_type text check (media_type is null or media_type in ('image', 'video')),
  thumbnail_url text,
  game_version text,
  tactic text,
  status text not null default 'published' check (status in ('published', 'pending', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_reel_video_check check (post_type <> 'reel' or media_type = 'video')
);

create index if not exists community_posts_feed_idx on public.community_posts (status, created_at desc);
create index if not exists community_posts_type_idx on public.community_posts (post_type, created_at desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id, created_at desc);

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_comment_id uuid references public.community_post_comments(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_comments_post_idx on public.community_post_comments (post_id, created_at asc);
create index if not exists community_comments_parent_idx on public.community_post_comments (parent_comment_id);

alter table public.community_posts enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_post_comments enable row level security;

drop policy if exists "public read published community posts" on public.community_posts;
create policy "public read published community posts" on public.community_posts
  for select using (status = 'published' or auth.uid() = author_id or public.is_admin());

drop policy if exists "users create own community posts" on public.community_posts;
create policy "users create own community posts" on public.community_posts
  for insert to authenticated with check (auth.uid() = author_id);

drop policy if exists "users update own community posts" on public.community_posts;
create policy "users update own community posts" on public.community_posts
  for update to authenticated using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "users delete own community posts" on public.community_posts;
create policy "users delete own community posts" on public.community_posts
  for delete to authenticated using (auth.uid() = author_id or public.is_admin());

drop policy if exists "public read community likes" on public.community_post_likes;
create policy "public read community likes" on public.community_post_likes
  for select using (true);

drop policy if exists "users manage own community likes" on public.community_post_likes;
create policy "users manage own community likes" on public.community_post_likes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "public read visible community comments" on public.community_post_comments;
create policy "public read visible community comments" on public.community_post_comments
  for select using (status = 'visible' or auth.uid() = user_id or public.is_admin());

drop policy if exists "users create own community comments" on public.community_post_comments;
create policy "users create own community comments" on public.community_post_comments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update own community comments" on public.community_post_comments;
create policy "users update own community comments" on public.community_post_comments
  for update to authenticated using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "users delete own community comments" on public.community_post_comments;
create policy "users delete own community comments" on public.community_post_comments
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

create or replace function public.touch_community_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_posts_touch_updated_at on public.community_posts;
create trigger community_posts_touch_updated_at before update on public.community_posts
for each row execute function public.touch_community_updated_at();

drop trigger if exists community_comments_touch_updated_at on public.community_post_comments;
create trigger community_comments_touch_updated_at before update on public.community_post_comments
for each row execute function public.touch_community_updated_at();

create or replace function public.notify_community_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid;
  v_author text;
  v_post_title text;
begin
  if tg_table_name = 'community_post_comments' then
    select cp.author_id, coalesce(cp.title, 'bài đăng cộng đồng') into v_recipient, v_post_title
    from public.community_posts cp where cp.id = new.post_id;
    if v_recipient is not null and v_recipient <> new.user_id then
      select coalesce(u.username, 'Một thành viên') into v_author from public.users u where u.id = new.user_id;
      insert into public.notifications (user_id, type, title, body, link)
      values (v_recipient, 'community_comment', 'Bài đăng có bình luận mới',
        v_author || ' đã bình luận trong “' || v_post_title || '”.', '/cong-dong#community-' || new.post_id);
    end if;
  elsif tg_table_name = 'community_post_likes' then
    select cp.author_id, coalesce(cp.title, 'bài đăng cộng đồng') into v_recipient, v_post_title
    from public.community_posts cp where cp.id = new.post_id;
    if v_recipient is not null and v_recipient <> new.user_id then
      select coalesce(u.username, 'Một thành viên') into v_author from public.users u where u.id = new.user_id;
      insert into public.notifications (user_id, type, title, body, link)
      values (v_recipient, 'community_like', 'Bài đăng có lượt thích mới',
        v_author || ' đã thích “' || v_post_title || '”.', '/cong-dong#community-' || new.post_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists community_comments_notify_activity on public.community_post_comments;
create trigger community_comments_notify_activity after insert on public.community_post_comments
for each row execute function public.notify_community_activity();

drop trigger if exists community_likes_notify_activity on public.community_post_likes;
create trigger community_likes_notify_activity after insert on public.community_post_likes
for each row execute function public.notify_community_activity();

alter table public.community_posts replica identity full;
alter table public.community_post_likes replica identity full;
alter table public.community_post_comments replica identity full;

do $$
declare v_table text;
begin
  foreach v_table in array array['community_posts', 'community_post_likes', 'community_post_comments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

commit;
