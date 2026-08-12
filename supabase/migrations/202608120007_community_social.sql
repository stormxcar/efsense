begin;

create table if not exists public.community_post_bookmarks (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_user_relations (
  follower_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  relation_type text not null check (relation_type in ('follow', 'mute', 'block')),
  created_at timestamptz not null default now(),
  primary key (follower_id, target_user_id, relation_type),
  check (follower_id <> target_user_id)
);

create index if not exists community_relations_target_idx on public.community_user_relations (target_user_id, relation_type);

alter table public.community_post_bookmarks enable row level security;
alter table public.community_user_relations enable row level security;

drop policy if exists "users read own community bookmarks" on public.community_post_bookmarks;
create policy "users read own community bookmarks" on public.community_post_bookmarks
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "users manage own community bookmarks" on public.community_post_bookmarks;
create policy "users manage own community bookmarks" on public.community_post_bookmarks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read own community relations" on public.community_user_relations;
create policy "users read own community relations" on public.community_user_relations
  for select to authenticated using (auth.uid() = follower_id);
drop policy if exists "users manage own community relations" on public.community_user_relations;
create policy "users manage own community relations" on public.community_user_relations
  for all to authenticated using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

alter table public.community_post_bookmarks replica identity full;
alter table public.community_user_relations replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_post_bookmarks') then
    alter publication supabase_realtime add table public.community_post_bookmarks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_user_relations') then
    alter publication supabase_realtime add table public.community_user_relations;
  end if;
end;
$$;

commit;
