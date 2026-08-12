begin;

-- Notification payloads now carry the actor and structured context so the UI can
-- render richer realtime events without another lookup.
alter table public.notifications
  add column if not exists actor_id uuid references public.users(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notifications_actor_idx
  on public.notifications (actor_id, created_at desc);

-- A privacy-safe event stream used only for recommendation scoring. It stores
-- aggregateable interaction facts, never IP addresses or raw credentials.
create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 2 and 50),
  target_type text check (target_type is null or char_length(target_type) between 2 and 50),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_activity_user_created_idx
  on public.user_activity_events (user_id, created_at desc);
create index if not exists user_activity_target_idx
  on public.user_activity_events (target_type, target_id, created_at desc);

alter table public.user_activity_events enable row level security;

drop policy if exists "users read own activity events" on public.user_activity_events;
create policy "users read own activity events" on public.user_activity_events
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users insert own activity events" on public.user_activity_events;
create policy "users insert own activity events" on public.user_activity_events
  for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.record_user_activity(
  p_user_id uuid,
  p_event_type text,
  p_target_type text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_user_id is null or (auth.uid() is distinct from p_user_id and not public.is_admin()) then
    raise exception 'not allowed';
  end if;

  insert into public.user_activity_events (user_id, event_type, target_type, target_id, metadata)
  values (
    p_user_id,
    left(trim(p_event_type), 50),
    nullif(left(trim(coalesce(p_target_type, '')), 50), ''),
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.record_user_activity(uuid, text, text, uuid, jsonb) to authenticated;

-- Associate deduplicated authenticated views with the activity stream while
-- preserving the existing anonymous visitor analytics contract.
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

    if auth.uid() is not null then
      insert into public.user_activity_events (user_id, event_type, target_type, target_id, metadata)
      values (auth.uid(), 'post_view', 'post', p_post_id, '{}'::jsonb);
    end if;
  else
    select view_count into v_count from public.posts where id = p_post_id;
  end if;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.record_post_view(uuid, text) to anon, authenticated;

-- Capture authenticated interactions centrally so recommendation data cannot be
-- bypassed by a client that forgets to call a tracking helper.
create or replace function public.capture_user_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_target_id uuid;
  v_target_type text;
  v_event_type text;
  v_metadata jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'likes' then
    v_user_id := new.user_id;
    v_target_id := new.post_id;
    v_target_type := 'post';
    v_event_type := 'post_like';
  elsif tg_table_name = 'bookmarks' then
    v_user_id := new.user_id;
    v_target_id := new.post_id;
    v_target_type := 'post';
    v_event_type := 'post_bookmark';
  elsif tg_table_name = 'post_shares' then
    v_user_id := new.user_id;
    v_target_id := new.post_id;
    v_target_type := 'post';
    v_event_type := 'post_share';
    v_metadata := jsonb_build_object('platform', new.platform);
  elsif tg_table_name = 'follows' then
    v_user_id := new.user_id;
    v_target_id := new.series_id;
    v_target_type := 'series';
    v_event_type := 'series_follow';
  elsif tg_table_name = 'comments' then
    v_user_id := new.user_id;
    v_target_id := new.post_id;
    v_target_type := 'post';
    v_event_type := 'post_comment';
  elsif tg_table_name = 'community_post_likes' then
    v_user_id := new.user_id;
    v_target_id := new.post_id;
    v_target_type := 'community_post';
    v_event_type := 'community_like';
  elsif tg_table_name = 'community_post_bookmarks' then
    v_user_id := new.user_id;
    v_target_id := new.post_id;
    v_target_type := 'community_post';
    v_event_type := 'community_bookmark';
  elsif tg_table_name = 'community_post_comments' then
    v_user_id := new.user_id;
    v_target_id := new.post_id;
    v_target_type := 'community_post';
    v_event_type := 'community_comment';
  end if;

  if v_user_id is not null and v_event_type is not null then
    insert into public.user_activity_events (user_id, event_type, target_type, target_id, metadata)
    values (v_user_id, v_event_type, v_target_type, v_target_id, v_metadata);
  end if;
  return new;
end;
$$;

drop trigger if exists likes_capture_activity on public.likes;
create trigger likes_capture_activity after insert on public.likes
for each row execute function public.capture_user_activity();
drop trigger if exists bookmarks_capture_activity on public.bookmarks;
create trigger bookmarks_capture_activity after insert on public.bookmarks
for each row execute function public.capture_user_activity();
drop trigger if exists shares_capture_activity on public.post_shares;
create trigger shares_capture_activity after insert on public.post_shares
for each row execute function public.capture_user_activity();
drop trigger if exists follows_capture_activity on public.follows;
create trigger follows_capture_activity after insert on public.follows
for each row execute function public.capture_user_activity();
drop trigger if exists comments_capture_activity on public.comments;
create trigger comments_capture_activity after insert on public.comments
for each row execute function public.capture_user_activity();
drop trigger if exists community_likes_capture_activity on public.community_post_likes;
create trigger community_likes_capture_activity after insert on public.community_post_likes
for each row execute function public.capture_user_activity();
drop trigger if exists community_bookmarks_capture_activity on public.community_post_bookmarks;
create trigger community_bookmarks_capture_activity after insert on public.community_post_bookmarks
for each row execute function public.capture_user_activity();
drop trigger if exists community_comments_capture_activity on public.community_post_comments;
create trigger community_comments_capture_activity after insert on public.community_post_comments
for each row execute function public.capture_user_activity();

-- Recommendation RPC: preference is accumulated by series from explicit follows
-- and meaningful interactions, then blended with freshness and editorial picks.
create or replace function public.recommended_posts(
  p_user_id uuid default auth.uid(),
  p_limit integer default 12
)
returns table (
  post_id uuid,
  title text,
  slug text,
  excerpt text,
  cover_image text,
  series_id uuid,
  series_name text,
  series_slug text,
  published_at timestamptz,
  score numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with effective_user as (
    select coalesce(p_user_id, auth.uid()) as id
  ),
  preference_events as (
    select
      p.series_id,
      sum(case e.event_type
        when 'post_like' then 5
        when 'post_bookmark' then 6
        when 'post_share' then 4
        when 'post_comment' then 3
        when 'post_open' then 1
        when 'post_view' then 1
        else 0
      end)::numeric as weight
    from public.user_activity_events e
    join effective_user u on u.id = e.user_id
    join public.posts p on p.id = e.target_id
    where e.target_type = 'post' and p.series_id is not null
    group by p.series_id
    union all
    select f.series_id, 8::numeric
    from public.follows f
    join effective_user u on u.id = f.user_id
  ),
  series_preferences as (
    select series_id, sum(weight)::numeric as weight
    from preference_events
    group by series_id
  )
  select
    p.id,
    p.title,
    p.slug,
    p.excerpt,
    p.cover_image,
    p.series_id,
    s.name,
    s.slug,
    coalesce(p.published_at, p.created_at),
    (
      coalesce(sp.weight, 0)
      + case when p.featured then 2 else 0 end
      + greatest(0::numeric, 2 - (extract(epoch from (now() - coalesce(p.published_at, p.created_at))) / 604800)::numeric)
    )::numeric as score
  from public.posts p
  left join public.series s on s.id = p.series_id
  left join series_preferences sp on sp.series_id = p.series_id
  where p.status = 'published'
    and coalesce(p.published_at, p.created_at) <= now()
    and (s.id is null or s.status = 'published')
  order by score desc, coalesce(p.published_at, p.created_at) desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

grant execute on function public.recommended_posts(uuid, integer) to anon, authenticated;

-- Shared mention parser for posts, comments and community content.
create or replace function public.notify_mentions_in_text(
  p_content text,
  p_actor_id uuid,
  p_title text,
  p_link text,
  p_target_type text,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_username text;
begin
  for v_recipient, v_username in
    select distinct u.id, u.username
    from pg_catalog.regexp_matches(coalesce(p_content, ''), '@([[:alnum:]_.-]+)', 'g') as matches
    join public.users u on lower(u.username) = lower(matches[1])
    where u.status = 'active' and u.id <> p_actor_id
  loop
    insert into public.notifications (user_id, actor_id, type, title, body, link, metadata)
    values (
      v_recipient,
      p_actor_id,
      'mention',
      'Bạn được nhắc tên',
      coalesce(v_username, 'Bạn') || ' được nhắc trong ' || coalesce(p_title, 'một cuộc trò chuyện') || '.',
      p_link,
      jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id)
    );
  end loop;
end;
$$;

create or replace function public.notify_post_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then return new; end if;
  perform public.notify_mentions_in_text(new.content, new.author_id, new.title, '/posts/' || new.slug, 'post', new.id);
  return new;
end;
$$;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions
after insert or update of content on public.posts
for each row execute function public.notify_post_mentions();

create or replace function public.notify_comment_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_slug text;
begin
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then return new; end if;
  select p.title, p.slug into v_title, v_slug from public.posts p where p.id = new.post_id;
  perform public.notify_mentions_in_text(new.content, new.user_id, v_title, '/posts/' || v_slug || '#comments', 'comment', new.id);
  return new;
end;
$$;

drop trigger if exists comments_notify_mentions on public.comments;
create trigger comments_notify_mentions
after insert or update of content on public.comments
for each row execute function public.notify_comment_mentions();

create or replace function public.notify_community_post_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then return new; end if;
  perform public.notify_mentions_in_text(new.content, new.author_id, coalesce(new.title, 'bài đăng cộng đồng'), '/cong-dong#community-' || new.id, 'community_post', new.id);
  return new;
end;
$$;

drop trigger if exists community_posts_notify_mentions on public.community_posts;
create trigger community_posts_notify_mentions
after insert or update of content on public.community_posts
for each row execute function public.notify_community_post_mentions();

create or replace function public.notify_community_comment_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
begin
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then return new; end if;
  select coalesce(cp.title, 'bài đăng cộng đồng') into v_title from public.community_posts cp where cp.id = new.post_id;
  perform public.notify_mentions_in_text(new.content, new.user_id, v_title, '/cong-dong#community-' || new.post_id, 'community_comment', new.id);
  return new;
end;
$$;

drop trigger if exists community_comments_notify_mentions on public.community_post_comments;
create trigger community_comments_notify_mentions
after insert or update of content on public.community_post_comments
for each row execute function public.notify_community_comment_mentions();

-- Upgrade existing reply/follower notifications with actor metadata.
create or replace function public.notify_comment_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid;
  v_post_author uuid;
  v_title text;
  v_slug text;
  v_actor text;
  v_type text;
  v_notification_title text;
begin
  select p.author_id, p.title, p.slug into v_post_author, v_title, v_slug from public.posts p where p.id = new.post_id;
  select coalesce(u.username, 'Một độc giả') into v_actor from public.users u where u.id = new.user_id;
  if new.parent_comment_id is not null then
    select c.user_id into v_recipient from public.comments c where c.id = new.parent_comment_id;
    v_type := 'comment_reply';
    v_notification_title := 'Bạn có phản hồi mới';
  else
    v_recipient := v_post_author;
    v_type := 'post_comment';
    v_notification_title := 'Bài viết có bình luận mới';
  end if;
  if v_recipient is not null and v_recipient <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, title, body, link, metadata)
    values (v_recipient, new.user_id, v_type, v_notification_title,
      v_actor || case when new.parent_comment_id is null then ' đã bình luận trong “' else ' đã trả lời bình luận của bạn trong “' end || v_title || '”.',
      '/posts/' || v_slug || '#comments', jsonb_build_object('post_id', new.post_id, 'comment_id', new.id));
  end if;
  return new;
end;
$$;

create or replace function public.notify_community_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid;
  v_author text;
  v_post_title text;
  v_type text;
  v_notification_title text;
begin
  if tg_table_name = 'community_post_comments' then
    select cp.author_id, coalesce(cp.title, 'bài đăng cộng đồng') into v_recipient, v_post_title from public.community_posts cp where cp.id = new.post_id;
    if new.parent_comment_id is not null then
      select c.user_id into v_recipient from public.community_post_comments c where c.id = new.parent_comment_id;
      v_type := 'community_reply';
      v_notification_title := 'Bạn có phản hồi mới trong cộng đồng';
    else
      v_type := 'community_comment';
      v_notification_title := 'Bài đăng có bình luận mới';
    end if;
    if v_recipient is not null and v_recipient <> new.user_id then
      select coalesce(u.username, 'Một thành viên') into v_author from public.users u where u.id = new.user_id;
      insert into public.notifications (user_id, actor_id, type, title, body, link, metadata)
      values (v_recipient, new.user_id, v_type, v_notification_title,
        v_author || case when new.parent_comment_id is null then ' đã bình luận trong “' else ' đã trả lời bình luận của bạn trong “' end || v_post_title || '”.',
        '/cong-dong#community-' || new.post_id, jsonb_build_object('post_id', new.post_id, 'comment_id', new.id));
    end if;
  elsif tg_table_name = 'community_post_likes' then
    select cp.author_id, coalesce(cp.title, 'bài đăng cộng đồng') into v_recipient, v_post_title from public.community_posts cp where cp.id = new.post_id;
    if v_recipient is not null and v_recipient <> new.user_id then
      select coalesce(u.username, 'Một thành viên') into v_author from public.users u where u.id = new.user_id;
      insert into public.notifications (user_id, actor_id, type, title, body, link, metadata)
      values (v_recipient, new.user_id, 'community_like', 'Bài đăng có lượt thích mới', v_author || ' đã thích “' || v_post_title || '”.', '/cong-dong#community-' || new.post_id, jsonb_build_object('post_id', new.post_id));
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_followers_on_publish()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and new.series_id is not null and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    insert into public.notifications (user_id, actor_id, type, title, body, link, metadata)
    select f.user_id, new.author_id, 'new_series_post', 'Chuyên đề có bài viết mới', new.title, '/posts/' || new.slug,
      jsonb_build_object('series_id', new.series_id, 'post_id', new.id)
    from public.follows f where f.series_id = new.series_id;
  end if;
  return new;
end;
$$;

create or replace function public.notify_user_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor text;
begin
  if new.relation_type = 'follow' then
    select coalesce(u.username, 'Một thành viên') into v_actor from public.users u where u.id = new.follower_id;
    insert into public.notifications (user_id, actor_id, type, title, body, link, metadata)
    values (new.target_user_id, new.follower_id, 'user_follow', 'Bạn có người theo dõi mới', v_actor || ' đã bắt đầu theo dõi bạn.', '/profile',
      jsonb_build_object('follower_id', new.follower_id));
  end if;
  return new;
end;
$$;

drop trigger if exists community_user_follow_notify on public.community_user_relations;
create trigger community_user_follow_notify after insert on public.community_user_relations
for each row execute function public.notify_user_follow();

alter table public.user_activity_events replica identity full;
do $$
declare v_table text;
begin
  foreach v_table in array array['user_activity_events', 'notifications'] loop
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
