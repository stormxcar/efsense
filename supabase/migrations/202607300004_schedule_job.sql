create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.publish_scheduled_posts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.posts
  set status = 'published',
      published_at = coalesce(published_at, scheduled_at, now()),
      updated_at = now()
  where status = 'scheduled'
    and scheduled_at is not null
    and scheduled_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.publish_scheduled_posts() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'publish-football-stories-scheduled-posts') then
    perform cron.schedule(
      'publish-football-stories-scheduled-posts',
      '* * * * *',
      'select public.publish_scheduled_posts();'
    );
  end if;
end
$$;

create or replace function public.notify_followers_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published'
    and new.series_id is not null
    and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    insert into public.notifications (user_id, type, title, body, link)
    select f.user_id,
           'new_series_post',
           'Chuyên đề có bài viết mới',
           new.title,
           '/posts/' || new.slug
    from public.follows f
    where f.series_id = new.series_id;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_notify_followers on public.posts;
create trigger posts_notify_followers
after insert or update of status on public.posts
for each row execute function public.notify_followers_on_publish();
