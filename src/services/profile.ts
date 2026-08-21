import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export interface ProfileOverviewData {
  reading_minutes: number
  articles_read: number
  reading_streak: number
  activity_30d: number
  community_posts: number
  reels: number
  followers: number
  following_users: number
  following_series: number
  following_tags: number
  reactions_received: number
  comments_received: number
  creator_views: number
  engagement_rate: number
}

export interface ProfileActivityItem {
  id: string
  event_type: string
  target_type: string | null
  target_id: string | null
  target_title: string
  target_slug: string | null
  context_text: string | null
  reply_to_name: string | null
  reaction: string | null
  comment_id: string | null
  metadata: Json
  created_at: string
  total_count: number
}

export interface ReadingCollection {
  id: string
  user_id: string
  name: string
  description: string | null
  color: 'lime' | 'blue' | 'orange' | 'violet'
  created_at: string
  items_count: number
}

export interface ProfilePreference {
  user_id: string
  profile_visibility: 'public' | 'members' | 'private'
  show_activity: boolean
  show_reading_stats: boolean
  email_notifications: boolean
  push_notifications: boolean
  notify_mentions: boolean
  notify_replies: boolean
  notify_follows: boolean
  notify_new_content: boolean
  updated_at?: string
}

export interface ProfileBadge {
  id: string
  awarded_at: string
  badge: { slug: string; name: string; description: string; icon: string } | null
}

export interface FollowingData {
  users: Array<{ id: string; username: string; avatar: string | null; bio: string | null }>
  series: Array<{ id: string; name: string; slug: string; thumbnail: string | null; description: string | null }>
  tags: Array<{ id: string; name: string; slug: string }>
}

const defaultOverview: ProfileOverviewData = {
  reading_minutes: 0, articles_read: 0, reading_streak: 0, activity_30d: 0,
  community_posts: 0, reels: 0, followers: 0, following_users: 0,
  following_series: 0, following_tags: 0, reactions_received: 0,
  comments_received: 0, creator_views: 0, engagement_rate: 0,
}

export async function fetchProfileOverview() {
  const { data, error } = await supabase.rpc('profile_overview')
  if (error) throw error
  return { ...defaultOverview, ...(data as Partial<ProfileOverviewData> | null) }
}

export async function fetchProfileActivity(page = 1, pageSize = 10) {
  const { data, error } = await supabase.rpc('profile_activity_feed', { p_limit: pageSize, p_offset: (page - 1) * pageSize })
  if (error) throw error
  const items = (data ?? []) as ProfileActivityItem[]
  return { items, total: Number(items[0]?.total_count ?? 0) }
}

export async function fetchProfileBadges(userId: string) {
  await supabase.rpc('refresh_my_profile_badges')
  const { data, error } = await supabase
    .from('user_badges')
    .select('badge_id, awarded_at, badge:member_badges(id, slug, name, description, icon)')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((item) => ({
    id: String(item.badge_id),
    awarded_at: String(item.awarded_at),
    badge: (Array.isArray(item.badge) ? item.badge[0] : item.badge) as ProfileBadge['badge'],
  }))
}

export async function fetchReadingCollections(userId: string) {
  const { data, error } = await supabase
    .from('reading_collections')
    .select('*, items:reading_collection_items(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((item) => ({
    ...item,
    items_count: Number(item.items?.[0]?.count ?? 0),
  })) as ReadingCollection[]
}

export async function createReadingCollection(userId: string, values: Pick<ReadingCollection, 'name' | 'description' | 'color'>) {
  const { data, error } = await supabase.from('reading_collections').insert({ user_id: userId, ...values }).select('*').single()
  if (error) throw error
  return data
}

export async function deleteReadingCollection(collectionId: string) {
  const { error } = await supabase.from('reading_collections').delete().eq('id', collectionId)
  if (error) throw error
}

export async function addPostToReadingCollection(collectionId: string, postId: string) {
  const { error } = await supabase.from('reading_collection_items').upsert({ collection_id: collectionId, post_id: postId })
  if (error) throw error
}

export async function fetchFollowingData(userId: string): Promise<FollowingData> {
  const [{ data: relations, error: relationError }, { data: seriesLinks, error: seriesError }, { data: tagLinks, error: tagError }] = await Promise.all([
    supabase.from('community_user_relations').select('target_user_id').eq('follower_id', userId).eq('relation_type', 'follow').order('created_at', { ascending: false }),
    supabase.from('follows').select('series_id').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('community_tag_follows').select('tag_id').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  if (relationError) throw relationError
  if (seriesError) throw seriesError
  if (tagError) throw tagError
  const userIds = (relations ?? []).map((item) => item.target_user_id)
  const seriesIds = (seriesLinks ?? []).map((item) => item.series_id)
  const tagIds = (tagLinks ?? []).map((item) => item.tag_id)
  const [{ data: users }, { data: series }, { data: tags }] = await Promise.all([
    userIds.length ? supabase.from('users').select('id, username, avatar, bio').in('id', userIds) : Promise.resolve({ data: [] }),
    seriesIds.length ? supabase.from('series').select('id, name, slug, thumbnail, description').in('id', seriesIds) : Promise.resolve({ data: [] }),
    tagIds.length ? supabase.from('community_tags').select('id, name, slug').in('id', tagIds) : Promise.resolve({ data: [] }),
  ])
  return { users: users ?? [], series: series ?? [], tags: tags ?? [] } as FollowingData
}

export async function fetchProfilePreferences(userId: string): Promise<ProfilePreference> {
  const { data, error } = await supabase.from('profile_preferences').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data ?? {
    user_id: userId, profile_visibility: 'public', show_activity: true, show_reading_stats: true,
    email_notifications: true, push_notifications: true, notify_mentions: true,
    notify_replies: true, notify_follows: true, notify_new_content: true,
  }
}

export async function saveProfilePreferences(preferences: ProfilePreference) {
  const { data, error } = await supabase.from('profile_preferences').upsert({ ...preferences, updated_at: new Date().toISOString() }).select('*').single()
  if (error) throw error
  return data as ProfilePreference
}
