begin;

-- Internal SECURITY DEFINER helpers are trigger-only and must not be callable
-- by the browser roles. Keep only the explicit client RPCs exposed.
revoke all on function public.notify_mentions_in_text(text, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.capture_user_activity() from public, anon, authenticated;
revoke all on function public.notify_post_mentions() from public, anon, authenticated;
revoke all on function public.notify_comment_mentions() from public, anon, authenticated;
revoke all on function public.notify_community_post_mentions() from public, anon, authenticated;
revoke all on function public.notify_community_comment_mentions() from public, anon, authenticated;
revoke all on function public.notify_comment_activity() from public, anon, authenticated;
revoke all on function public.notify_community_activity() from public, anon, authenticated;
revoke all on function public.notify_followers_on_publish() from public, anon, authenticated;
revoke all on function public.notify_user_follow() from public, anon, authenticated;

revoke all on function public.record_user_activity(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.record_user_activity(uuid, text, text, uuid, jsonb) to authenticated;
revoke all on function public.recommended_posts(uuid, integer) from public, anon;
grant execute on function public.recommended_posts(uuid, integer) to authenticated;

commit;
