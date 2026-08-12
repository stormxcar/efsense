begin;

create or replace function public.route_community_posts_to_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  select role into v_role from public.users where id = auth.uid() and status = 'active';
  if coalesce(v_role, 'user') not in ('admin', 'moderator') then
    new.status := 'pending';
  end if;
  return new;
end;
$$;
drop trigger if exists route_community_posts_to_moderation on public.community_posts;
create trigger route_community_posts_to_moderation
before insert on public.community_posts for each row
execute function public.route_community_posts_to_moderation();

commit;
