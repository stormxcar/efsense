begin;

drop policy if exists "users register own media assets" on public.media_assets;
create policy "users register own media assets" on public.media_assets
  for insert to authenticated with check (owner_id = auth.uid());

commit;
