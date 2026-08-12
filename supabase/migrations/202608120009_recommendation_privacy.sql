begin;

-- Recommendation results must always be scoped to the signed-in user. The
-- previous RPC accepted an optional id for server-side flexibility; this
-- wrapper implementation prevents an anonymous caller from probing another
-- user's interests.
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
    select case
      when auth.uid() is not null and p_user_id = auth.uid() then p_user_id
      else auth.uid()
    end as id
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

revoke execute on function public.recommended_posts(uuid, integer) from anon;
grant execute on function public.recommended_posts(uuid, integer) to authenticated;

-- Do not notify users about mentions in unpublished content. A status change
-- to published is also covered so scheduled posts notify at publication time.
create or replace function public.notify_post_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and new.content is not distinct from old.content and new.status is not distinct from old.status then return new; end if;
  perform public.notify_mentions_in_text(new.content, new.author_id, new.title, '/posts/' || new.slug, 'post', new.id);
  return new;
end;
$$;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions
after insert or update of content, status on public.posts
for each row execute function public.notify_post_mentions();

create or replace function public.notify_comment_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_slug text;
begin
  if new.status <> 'visible' then return new; end if;
  if tg_op = 'UPDATE' and new.content is not distinct from old.content and new.status is not distinct from old.status then return new; end if;
  select p.title, p.slug into v_title, v_slug from public.posts p where p.id = new.post_id;
  perform public.notify_mentions_in_text(new.content, new.user_id, v_title, '/posts/' || v_slug || '#comments', 'comment', new.id);
  return new;
end;
$$;

drop trigger if exists comments_notify_mentions on public.comments;
create trigger comments_notify_mentions
after insert or update of content, status on public.comments
for each row execute function public.notify_comment_mentions();

create or replace function public.notify_community_post_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and new.content is not distinct from old.content and new.status is not distinct from old.status then return new; end if;
  perform public.notify_mentions_in_text(new.content, new.author_id, coalesce(new.title, 'bài đăng cộng đồng'), '/cong-dong#community-' || new.id, 'community_post', new.id);
  return new;
end;
$$;

drop trigger if exists community_posts_notify_mentions on public.community_posts;
create trigger community_posts_notify_mentions
after insert or update of content, status on public.community_posts
for each row execute function public.notify_community_post_mentions();

create or replace function public.notify_community_comment_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
begin
  if new.status <> 'visible' then return new; end if;
  if tg_op = 'UPDATE' and new.content is not distinct from old.content and new.status is not distinct from old.status then return new; end if;
  select coalesce(cp.title, 'bài đăng cộng đồng') into v_title from public.community_posts cp where cp.id = new.post_id;
  perform public.notify_mentions_in_text(new.content, new.user_id, v_title, '/cong-dong#community-' || new.post_id, 'community_comment', new.id);
  return new;
end;
$$;

drop trigger if exists community_comments_notify_mentions on public.community_post_comments;
create trigger community_comments_notify_mentions
after insert or update of content, status on public.community_post_comments
for each row execute function public.notify_community_comment_mentions();

commit;
