begin;

create table if not exists public.post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (char_length(platform) between 2 and 40),
  created_at timestamptz not null default now()
);

create index if not exists post_shares_post_created_idx
  on public.post_shares (post_id, created_at desc);
create index if not exists post_shares_user_created_idx
  on public.post_shares (user_id, created_at desc);

alter table public.post_shares enable row level security;

drop policy if exists "authenticated users record own shares" on public.post_shares;
create policy "authenticated users record own shares"
  on public.post_shares
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "admins read post shares" on public.post_shares;
create policy "admins read post shares"
  on public.post_shares
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create or replace function public.notify_post_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_title text;
  v_slug text;
  v_actor text;
begin
  select p.author_id, p.title, p.slug
    into v_recipient, v_title, v_slug
  from public.posts p
  where p.id = new.post_id;

  select coalesce(u.username, 'Một độc giả')
    into v_actor
  from public.users u
  where u.id = new.user_id;

  if v_recipient is null or v_recipient = new.user_id then
    return new;
  end if;

  if tg_table_name = 'likes' then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      v_recipient,
      'post_like',
      'Bài viết có lượt thích mới',
      v_actor || ' đã thích “' || v_title || '”.',
      '/posts/' || v_slug
    );
  elsif tg_table_name = 'post_shares' then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      v_recipient,
      'post_share',
      'Bài viết vừa được chia sẻ',
      v_actor || ' đã chia sẻ “' || v_title || '” qua ' || new.platform || '.',
      '/posts/' || v_slug
    );
  end if;

  return new;
end;
$$;

drop trigger if exists likes_notify_post_author on public.likes;
create trigger likes_notify_post_author
after insert on public.likes
for each row execute function public.notify_post_activity();

drop trigger if exists shares_notify_post_author on public.post_shares;
create trigger shares_notify_post_author
after insert on public.post_shares
for each row execute function public.notify_post_activity();

create or replace function public.notify_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_post_author uuid;
  v_title text;
  v_slug text;
  v_actor text;
  v_type text;
  v_notification_title text;
begin
  select p.author_id, p.title, p.slug
    into v_post_author, v_title, v_slug
  from public.posts p
  where p.id = new.post_id;

  select coalesce(u.username, 'Một độc giả')
    into v_actor
  from public.users u
  where u.id = new.user_id;

  if new.parent_comment_id is not null then
    select c.user_id into v_recipient
    from public.comments c
    where c.id = new.parent_comment_id;
    v_type := 'comment_reply';
    v_notification_title := 'Bạn có phản hồi mới';
  else
    v_recipient := v_post_author;
    v_type := 'post_comment';
    v_notification_title := 'Bài viết có bình luận mới';
  end if;

  if v_recipient is not null and v_recipient <> new.user_id then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      v_recipient,
      v_type,
      v_notification_title,
      v_actor || case
        when new.parent_comment_id is null then ' đã bình luận trong “'
        else ' đã trả lời bình luận của bạn trong “'
      end || v_title || '”.',
      '/posts/' || v_slug || '#comments'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify_activity on public.comments;
create trigger comments_notify_activity
after insert on public.comments
for each row execute function public.notify_comment_activity();

alter table public.posts replica identity full;
alter table public.comments replica identity full;
alter table public.likes replica identity full;
alter table public.bookmarks replica identity full;
alter table public.follows replica identity full;
alter table public.notifications replica identity full;
alter table public.reports replica identity full;
alter table public.users replica identity full;
alter table public.series replica identity full;
alter table public.post_shares replica identity full;
alter table public.post_gallery_images replica identity full;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'posts',
    'comments',
    'likes',
    'bookmarks',
    'follows',
    'notifications',
    'reports',
    'users',
    'series',
    'post_shares',
    'post_gallery_images'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

commit;
