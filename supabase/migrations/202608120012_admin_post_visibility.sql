begin;

-- Keep published posts public, while allowing editorial roles to work with
-- drafts and scheduled content without exposing them to ordinary users.
drop policy if exists "editorial staff read posts" on public.posts;
create policy "editorial staff read posts" on public.posts
  for select to authenticated
  using (
    public.is_admin()
    or public.can_publish_content()
    or (public.can_edit_content() and author_id = auth.uid() and status = 'draft')
  );

commit;
