-- Governance, moderation, revisions and operational controls for the admin area.
-- This migration intentionally changes role from an enum to a constrained text field
-- so roles can evolve without another enum migration.
begin;

alter table public.users alter column role drop default;
alter table public.users alter column role type text using role::text;
alter table public.users alter column role set default 'user';
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('admin', 'editor', 'moderator', 'contributor', 'user'));

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and status = 'active'
      and role in ('admin', 'editor', 'moderator', 'contributor')
  );
$$;

create or replace function public.can_edit_content()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and status = 'active'
      and role in ('admin', 'editor', 'contributor')
  );
$$;

create or replace function public.can_publish_content()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and status = 'active'
      and role in ('admin', 'editor')
  );
$$;

create or replace function public.can_moderate_content()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and status = 'active'
      and role in ('admin', 'moderator')
  );
$$;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.can_edit_content() to anon, authenticated;
grant execute on function public.can_publish_content() to anon, authenticated;
grant execute on function public.can_moderate_content() to anon, authenticated;

-- Prevent ordinary users from changing their own role/status/email through the
-- broad legacy profile update policy.
create or replace function public.protect_user_security_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status
      or new.email is distinct from old.email then
      raise exception 'security fields can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_user_security_fields on public.users;
create trigger protect_user_security_fields
before update on public.users for each row execute function public.protect_user_security_fields();

-- Admin audit trail.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null check (action in ('create', 'update', 'delete', 'publish', 'hide', 'restore', 'lock', 'unlock', 'revoke_sessions', 'approve', 'reject')),
  entity_type text not null check (char_length(entity_type) between 2 and 60),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
alter table public.audit_logs enable row level security;
drop policy if exists "admins read audit logs" on public.audit_logs;
create policy "admins read audit logs" on public.audit_logs for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_logs from anon, authenticated;

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_action text;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  v_action := lower(tg_op);
  if tg_op = 'INSERT' then v_action := 'create'; end if;
  if tg_op = 'UPDATE' then v_action := 'update'; end if;
  if tg_op = 'DELETE' then v_action := 'delete'; end if;
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_entity_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  if tg_op = 'UPDATE' and (v_old ->> 'status') is distinct from (v_new ->> 'status') then
    if (v_new ->> 'status') = 'published' then v_action := 'publish';
    elsif (v_new ->> 'status') = 'hidden' then v_action := 'hide'; end if;
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), v_action, tg_table_name, v_entity_id,
    jsonb_build_object('old', v_old, 'new', v_new)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_posts on public.posts;
create trigger audit_posts after insert or update or delete on public.posts
for each row execute function public.write_audit_log();
drop trigger if exists audit_series on public.series;
create trigger audit_series after insert or update or delete on public.series
for each row execute function public.write_audit_log();
drop trigger if exists audit_users on public.users;
create trigger audit_users after insert or update or delete on public.users
for each row execute function public.write_audit_log();
drop trigger if exists audit_community_posts on public.community_posts;
create trigger audit_community_posts after insert or update or delete on public.community_posts
for each row execute function public.write_audit_log();
drop trigger if exists audit_comments on public.comments;
create trigger audit_comments after update or delete on public.comments
for each row execute function public.write_audit_log();
drop trigger if exists audit_reports on public.reports;
create trigger audit_reports after update on public.reports
for each row execute function public.write_audit_log();

-- Version snapshots created before every post update.
create table if not exists public.post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  version integer not null,
  title text not null,
  slug text not null,
  excerpt text,
  content text,
  cover_image text,
  status text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (post_id, version)
);
create index if not exists post_revisions_post_idx on public.post_revisions (post_id, version desc);
alter table public.post_revisions enable row level security;
create policy "staff read post revisions" on public.post_revisions for select to authenticated using (public.is_staff());
create policy "editors restore post revisions" on public.post_revisions for insert to authenticated with check (public.can_edit_content());
revoke update, delete on public.post_revisions from anon, authenticated;

create or replace function public.snapshot_post_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  select coalesce(max(version), 0) + 1 into v_version from public.post_revisions where post_id = old.id;
  insert into public.post_revisions(post_id, version, title, slug, excerpt, content, cover_image, status, snapshot, created_by)
  values (old.id, v_version, old.title, old.slug, old.excerpt, old.content, old.cover_image, old.status::text, to_jsonb(old), auth.uid());
  return new;
end;
$$;
drop trigger if exists snapshot_post_revision on public.posts;
create trigger snapshot_post_revision before update on public.posts
for each row
execute function public.snapshot_post_revision();

-- Community/content reports and moderation queue support.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'community_post', 'comment', 'community_comment', 'reel')),
  target_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 2 and 80),
  description text check (description is null or char_length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);
create index if not exists content_reports_queue_idx on public.content_reports (status, created_at desc);
alter table public.content_reports enable row level security;
create policy "users submit content reports" on public.content_reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "users read own content reports" on public.content_reports for select to authenticated using (auth.uid() = reporter_id or public.can_moderate_content());
create policy "moderators manage content reports" on public.content_reports for update to authenticated using (public.can_moderate_content()) with check (public.can_moderate_content());

-- Conservative anti-spam limits, enforced in the database rather than only in UI.
create or replace function public.enforce_community_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if tg_table_name = 'community_posts' then
    select count(*) into v_count from public.community_posts
    where author_id = new.author_id and created_at > now() - interval '1 hour';
    if v_count >= 10 then raise exception 'Bạn đã đạt giới hạn 10 bài đăng cộng đồng mỗi giờ'; end if;
  else
    select count(*) into v_count from public.community_post_comments
    where user_id = new.user_id and created_at > now() - interval '1 hour';
    if v_count >= 40 then raise exception 'Bạn đã đạt giới hạn bình luận mỗi giờ'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists community_post_rate_limit on public.community_posts;
create trigger community_post_rate_limit before insert on public.community_posts
for each row execute function public.enforce_community_rate_limit();
drop trigger if exists community_comment_rate_limit on public.community_post_comments;
create trigger community_comment_rate_limit before insert on public.community_post_comments
for each row execute function public.enforce_community_rate_limit();

-- Central media registry for future uploads and orphan detection.
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  secure_url text not null,
  resource_type text not null check (resource_type in ('image', 'video', 'raw')),
  folder text,
  owner_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists media_assets_type_idx on public.media_assets (resource_type, created_at desc);
alter table public.media_assets enable row level security;
create policy "staff manage media assets" on public.media_assets for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Realtime for operational admin screens.
alter table public.audit_logs replica identity full;
alter table public.post_revisions replica identity full;
alter table public.content_reports replica identity full;
alter table public.media_assets replica identity full;
do $$ declare v_table text;
begin
  foreach v_table in array array['audit_logs','post_revisions','content_reports','media_assets'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

-- Broaden content policies according to responsibility, while keeping user management admin-only.
drop policy if exists "admins manage posts" on public.posts;
create policy "editorial staff manage posts" on public.posts for all to authenticated
using (
  public.can_edit_content()
  and (
    public.can_publish_content()
    or (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'contributor')
      and author_id = auth.uid() and status = 'draft')
  )
)
with check (public.can_edit_content() and (status <> 'published' or public.can_publish_content()));
drop policy if exists "admins manage series" on public.series;
create policy "editorial staff manage series" on public.series for all to authenticated
using (public.can_edit_content()) with check (public.can_edit_content() and (status <> 'published' or public.can_publish_content()));
drop policy if exists "admins manage timeline" on public.history_timeline_events;
create policy "editorial staff manage timeline" on public.history_timeline_events for all to authenticated
using (public.can_edit_content()) with check (public.can_edit_content() and (status <> 'published' or public.can_publish_content()));
drop policy if exists "users update own community posts" on public.community_posts;
create policy "authors and moderators manage community posts" on public.community_posts for update to authenticated
using (auth.uid() = author_id or public.can_moderate_content())
with check (auth.uid() = author_id or public.can_moderate_content());
drop policy if exists "users delete own community posts" on public.community_posts;
create policy "authors and moderators delete community posts" on public.community_posts for delete to authenticated
using (auth.uid() = author_id or public.can_moderate_content());

commit;
