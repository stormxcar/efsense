begin;

-- Explicit server-side capability boundaries. The UI only mirrors these
-- rules; every write is still rejected by RLS when the role is insufficient.
drop policy if exists "editorial staff manage posts" on public.posts;
drop policy if exists "editorial staff manage series" on public.series;
drop policy if exists "editorial staff manage timeline" on public.history_timeline_events;
create policy "editorial staff create posts" on public.posts
  for insert to authenticated
  with check (
    public.can_publish_content()
    or (public.can_edit_content() and author_id = auth.uid() and status = 'draft')
  );
create policy "editorial staff update posts" on public.posts
  for update to authenticated
  using (
    public.can_publish_content()
    or (public.can_edit_content() and author_id = auth.uid() and status = 'draft')
  )
  with check (
    public.can_publish_content()
    or (public.can_edit_content() and author_id = auth.uid() and status = 'draft')
  );
create policy "editorial staff delete posts" on public.posts
  for delete to authenticated
  using (
    public.can_publish_content()
    or (public.can_edit_content() and author_id = auth.uid() and status = 'draft')
  );

drop policy if exists "editorial staff manage series" on public.series;
create policy "editors manage series" on public.series
  for all to authenticated using (public.can_publish_content()) with check (public.can_publish_content());
drop policy if exists "editorial staff manage timeline" on public.history_timeline_events;
create policy "editors manage timeline" on public.history_timeline_events
  for all to authenticated using (public.can_publish_content()) with check (public.can_publish_content());

drop policy if exists "admins moderate comments" on public.comments;
create policy "moderators moderate comments" on public.comments
  for update to authenticated using (public.can_moderate_content()) with check (public.can_moderate_content());
create policy "moderators delete comments" on public.comments
  for delete to authenticated using (public.can_moderate_content() or auth.uid() = user_id);

drop policy if exists "editors restore post revisions" on public.post_revisions;
revoke insert, update, delete on public.post_revisions from anon, authenticated;

-- Media cleanup is deliberately two-phase: scan and review first, then an
-- admin-only registry cleanup. Cloudinary deletion remains a server secret
-- operation and is not exposed to the browser.
drop policy if exists "staff manage media assets" on public.media_assets;
drop policy if exists "users register own media assets" on public.media_assets;
create policy "staff read media assets" on public.media_assets
  for select to authenticated using (public.is_staff());
create policy "owners register media assets" on public.media_assets
  for insert to authenticated with check (owner_id = auth.uid() or public.is_admin());
create policy "admins update media assets" on public.media_assets
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete media assets" on public.media_assets
  for delete to authenticated using (public.is_admin());

create or replace function public.find_orphan_media_assets(p_limit integer default 200)
returns table (
  id uuid,
  public_id text,
  secure_url text,
  resource_type text,
  folder text,
  owner_id uuid,
  created_at timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.public_id, m.secure_url, m.resource_type, m.folder, m.owner_id, m.created_at, m.last_seen_at
  from public.media_assets m
  where public.is_admin()
    and not exists (select 1 from public.posts p where p.cover_image in (m.secure_url, m.public_id) or position(m.public_id in coalesce(p.content, '')) > 0)
    and not exists (select 1 from public.post_gallery_images g where g.image_url in (m.secure_url, m.public_id))
    and not exists (select 1 from public.community_posts cp where cp.media_url in (m.secure_url, m.public_id) or cp.thumbnail_url in (m.secure_url, m.public_id))
    and not exists (select 1 from public.series s where s.thumbnail in (m.secure_url, m.public_id))
    and not exists (select 1 from public.history_timeline_events h where h.media_url in (m.secure_url, m.public_id))
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
$$;
grant execute on function public.find_orphan_media_assets(integer) to authenticated;

create or replace function public.cleanup_orphan_media_assets(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'only admins can clean media'; end if;
  delete from public.media_assets m
  where m.id = any(coalesce(p_ids, '{}'::uuid[]))
    and not exists (select 1 from public.posts p where p.cover_image in (m.secure_url, m.public_id) or position(m.public_id in coalesce(p.content, '')) > 0)
    and not exists (select 1 from public.post_gallery_images g where g.image_url in (m.secure_url, m.public_id))
    and not exists (select 1 from public.community_posts cp where cp.media_url in (m.secure_url, m.public_id) or cp.thumbnail_url in (m.secure_url, m.public_id))
    and not exists (select 1 from public.series s where s.thumbnail in (m.secure_url, m.public_id))
    and not exists (select 1 from public.history_timeline_events h where h.media_url in (m.secure_url, m.public_id));
  get diagnostics v_count = row_count;
  insert into public.audit_logs(actor_id, action, entity_type, metadata)
  values (auth.uid(), 'delete', 'media_assets', jsonb_build_object('cleaned_count', v_count, 'asset_ids', p_ids));
  return v_count;
end;
$$;
revoke all on function public.cleanup_orphan_media_assets(uuid[]) from public, anon, authenticated;
grant execute on function public.cleanup_orphan_media_assets(uuid[]) to authenticated;

-- Editorial reminder for scheduled posts, while the existing cron job handles
-- the actual publication at scheduled_at.
alter table public.posts add column if not exists schedule_reminded_at timestamptz;
create index if not exists posts_schedule_reminder_idx on public.posts (scheduled_at) where status = 'scheduled' and schedule_reminded_at is null;
create or replace function public.notify_upcoming_scheduled_posts()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.notifications (user_id, actor_id, type, title, body, link, metadata)
  select p.author_id, p.author_id, 'schedule_reminder', 'Bài viết sắp được xuất bản', 'Bài “' || p.title || '” sẽ tự động xuất bản trong khoảng một giờ tới.', '/admin/posts/' || p.id || '/edit', jsonb_build_object('post_id', p.id, 'scheduled_at', p.scheduled_at)
  from public.posts p
  where p.status = 'scheduled' and p.author_id is not null
    and p.scheduled_at between now() and now() + interval '1 hour'
    and p.schedule_reminded_at is null;
  get diagnostics v_count = row_count;
  update public.posts set schedule_reminded_at = now()
  where status = 'scheduled' and scheduled_at between now() and now() + interval '1 hour' and schedule_reminded_at is null;
  return v_count;
end;
$$;
revoke all on function public.notify_upcoming_scheduled_posts() from public, anon, authenticated;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'football-stories-schedule-reminders') then
    perform cron.schedule('football-stories-schedule-reminders', '*/5 * * * *', 'select public.notify_upcoming_scheduled_posts();');
  end if;
end
$$;

-- Admin-only aggregate metrics for the dashboard. Returning users are users
-- active on both the current 7-day window and the previous 7-day window.
create or replace function public.admin_dashboard_summary(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_dau bigint;
  v_reads bigint;
  v_reels bigint;
  v_approved bigint;
  v_total bigint;
  v_returning bigint;
begin
  if not public.is_admin() then raise exception 'only admins can read dashboard metrics'; end if;
  select count(distinct user_id) into v_dau from public.user_activity_events where created_at >= now() - make_interval(days => least(greatest(p_days, 1), 365)) and user_id is not null;
  select count(*) into v_reads from public.post_view_events where viewed_at >= now() - make_interval(days => least(greatest(p_days, 1), 365));
  select count(*) into v_reels from public.community_posts where post_type = 'reel' and created_at >= now() - make_interval(days => least(greatest(p_days, 1), 365));
  select count(*) filter (where status = 'published'), count(*) into v_approved, v_total from public.community_posts where created_at >= now() - make_interval(days => least(greatest(p_days, 1), 365));
  select count(*) into v_returning from (select user_id from public.user_activity_events where created_at >= now() - interval '7 days' intersect select user_id from public.user_activity_events where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days') returning_users;
  return jsonb_build_object('dau', coalesce(v_dau, 0), 'reads', coalesce(v_reads, 0), 'reels', coalesce(v_reels, 0), 'approval_rate', case when v_total > 0 then round(v_approved * 100.0 / v_total, 1) else 100 end, 'retention_7d', case when v_dau > 0 then round(v_returning * 100.0 / v_dau, 1) else 0 end);
end;
$$;
grant execute on function public.admin_dashboard_summary(integer) to authenticated;

create or replace function public.admin_dashboard_timeseries(p_days integer default 30)
returns table(day date, dau bigint, reads bigint, reels bigint, approved bigint)
language sql stable security definer set search_path = '' as $$
  select d.day::date,
    (select count(distinct e.user_id) from public.user_activity_events e where e.created_at >= d.day and e.created_at < d.day + interval '1 day') as dau,
    (select count(*) from public.post_view_events e where e.viewed_at >= d.day and e.viewed_at < d.day + interval '1 day') as reads,
    (select count(*) from public.community_posts cp where cp.post_type = 'reel' and cp.created_at >= d.day and cp.created_at < d.day + interval '1 day') as reels,
    (select count(*) from public.community_posts cp where cp.status = 'published' and cp.created_at >= d.day and cp.created_at < d.day + interval '1 day') as approved
  from generate_series(current_date - (least(greatest(coalesce(p_days, 30), 1), 365) - 1), current_date, interval '1 day') d(day)
  where public.is_admin()
  order by d.day;
$$;
grant execute on function public.admin_dashboard_timeseries(integer) to authenticated;

commit;
