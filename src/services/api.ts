import { supabase } from '@/lib/supabase'
import { cloudinaryVideoPosterUrl, optimizeCloudinaryDeliveryUrl, uploadImageToCloudinary, uploadVideoToCloudinary } from '@/lib/cloudinary'
import type { CommunityCommentWithUser, CommunityPostWithDetails, HistoryTimelineEventWithPost, UserRow } from '@/types/database'

// ---- AUTH SERVICES ----

export async function signUp(email: string, password: string, username: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })
  return { data, error }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.functions.invoke('secure-login', {
    body: { email, password },
  })
  if (error || data?.error || !data?.session) {
    return { data: null, error: new Error(data?.error ?? error?.message ?? 'Đăng nhập thất bại') }
  }
  const sessionResult = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
  return { data: sessionResult.data, error: sessionResult.error }
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function createManagedUser(input: { email: string; password: string; username: string; role: 'user' | 'admin' | 'editor' | 'moderator' | 'contributor' }) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body: input })
  if (error || data?.error) return { data: null, error: new Error(data?.error ?? error?.message ?? 'Không thể tạo người dùng') }
  return { data, error: null }
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
  return data
}

// ---- POST SERVICES ----

export async function fetchPosts({
  page = 1,
  limit = 10,
  seriesId,
  status = 'published',
  search,
  featured,
  leagueId,
  clubId,
  playerId,
  seasonId,
  sort = 'newest',
}: {
  page?: number
  limit?: number
  seriesId?: string
  status?: string
  search?: string
  featured?: boolean
  leagueId?: string
  clubId?: string
  playerId?: string
  seasonId?: string
  sort?: 'newest' | 'oldest' | 'popular'
}) {
  let query = supabase
    .from('posts')
    .select(`
      id, title, slug, excerpt, cover_image, author_id, series_id, status, view_count, featured,
      image_alt, published_at, created_at, updated_at,
      author:users!posts_author_id_fkey(id, username, avatar),
      series:series(id, name, slug),
      likes(count),
      comments(count)
    `, { count: 'exact' })
    .eq('status', status)
    .order(sort === 'popular' ? 'view_count' : 'published_at', { ascending: sort === 'oldest' })
    .range((page - 1) * limit, page * limit - 1)

  if (seriesId) query = query.eq('series_id', seriesId)
  if (featured !== undefined) query = query.eq('featured', featured)
  if (search) query = query.textSearch('tsv', search, { type: 'websearch' })
  if (leagueId) query = query.eq('league_id', leagueId)
  if (clubId) query = query.eq('club_id', clubId)
  if (playerId) query = query.eq('player_id', playerId)
  if (seasonId) query = query.eq('season_id', seasonId)

  return query
}

export async function fetchPostBySlug(slug: string, incrementView = true) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:users!posts_author_id_fkey(id, username, avatar, bio),
      series:series(id, name, slug, description),
      post_tags(tag:tags(id, name, slug)),
      post_gallery_images(*),
      likes(count)
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (data && incrementView) {
    let visitorKey = localStorage.getItem('football-stories-visitor-key')
    if (!visitorKey) {
      visitorKey = crypto.randomUUID()
      localStorage.setItem('football-stories-visitor-key', visitorKey)
    }
    void supabase.rpc('record_post_view', { p_post_id: data.id, p_visitor_key: visitorKey })
  }
  return { data, error }
}

export async function fetchRelatedPosts(postId: string, seriesId: string | null, limit = 3) {
  let query = supabase
    .from('posts')
    .select('id, title, slug, cover_image, excerpt, published_at, series:series(name, slug)')
    .eq('status', 'published')
    .neq('id', postId)
    .limit(limit)

  if (seriesId) query = query.eq('series_id', seriesId)
  return query
}

export async function createPost(post: {
  title: string
  slug: string
  excerpt?: string
  content?: string
  cover_image?: string
  series_id?: string
  status: 'draft' | 'published' | 'scheduled'
  featured?: boolean
  meta_title?: string
  meta_desc?: string
  author_id: string
  tagIds?: string[]
  image_alt?: string
  image_credit?: string
  image_source_url?: string
  scheduled_at?: string | null
  league_id?: string
  club_id?: string
  player_id?: string
  season_id?: string
  published_at?: string | null
}) {
  const { tagIds, ...postData } = post
  const normalizedPostData = {
    ...postData,
    series_id: postData.series_id || null,
    league_id: postData.league_id || null,
    club_id: postData.club_id || null,
    player_id: postData.player_id || null,
    season_id: postData.season_id || null,
  }
  const { data, error } = await supabase
    .from('posts')
    .insert({
      ...normalizedPostData,
      published_at: normalizedPostData.status === 'published' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (data && tagIds?.length) {
    await supabase.from('post_tags').insert(tagIds.map(tag_id => ({ post_id: data.id, tag_id })))
  }
  return { data, error }
}

export async function updatePost(id: string, updates: Parameters<typeof createPost>[0]) {
  const { tagIds, ...postData } = updates
  if (postData.status === 'published' && !('published_at' in postData)) {
    postData.published_at = new Date().toISOString()
  }
  const normalizedPostData = {
    ...postData,
    series_id: postData.series_id || null,
    league_id: postData.league_id || null,
    club_id: postData.club_id || null,
    player_id: postData.player_id || null,
    season_id: postData.season_id || null,
  }
  const { data, error } = await supabase.from('posts').update(normalizedPostData).eq('id', id).select().single()
  if (data && tagIds !== undefined) {
    await supabase.from('post_tags').delete().eq('post_id', id)
    if (tagIds.length) {
      await supabase.from('post_tags').insert(tagIds.map(tag_id => ({ post_id: id, tag_id })))
    }
  }
  return { data, error }
}

export async function deletePost(id: string) {
  return supabase.from('posts').delete().eq('id', id)
}

export async function updatePostsBulk(ids: string[], status: 'draft' | 'published') {
  return supabase.from('posts').update({ status, published_at: status === 'published' ? new Date().toISOString() : null }).in('id', ids)
}

export async function fetchPostRevisions(postId: string) {
  return supabase.from('post_revisions').select('*').eq('post_id', postId).order('version', { ascending: false })
}

export async function restorePostRevision(revision: { post_id: string; title: string; slug: string; excerpt: string | null; content: string | null; cover_image: string | null; status: string }) {
  return supabase.from('posts').update({
    title: revision.title,
    slug: revision.slug,
    excerpt: revision.excerpt,
    content: revision.content,
    cover_image: revision.cover_image,
    status: revision.status === 'published' ? 'draft' : revision.status,
  }).eq('id', revision.post_id).select().single()
}

// ---- SERIES SERVICES ----

export async function fetchSeries(status?: 'published' | 'draft') {
  let query = supabase.from('series').select('*, posts(count)').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  return query
}

export async function fetchSeriesBySlug(slug: string) {
  return supabase.from('series').select('*').eq('slug', slug).single()
}

export async function createSeries(data: { name: string; slug: string; description?: string; thumbnail?: string; status: 'draft' | 'published' }) {
  return supabase.from('series').insert(data).select().single()
}

export async function updateSeries(id: string, data: Partial<{ name: string; slug: string; description: string; thumbnail: string; status: string }>) {
  return supabase.from('series').update(data).eq('id', id).select().single()
}

export async function deleteSeries(id: string) {
  return supabase.from('series').delete().eq('id', id)
}

// ---- COMMENT SERVICES ----

export async function fetchComments(postId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, user:users(id, username, avatar)')
    .eq('post_id', postId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })

  if (data) {
    const roots = data.filter((c) => !c.parent_comment_id)
    const replies = data.filter((c) => c.parent_comment_id)
    const nested = roots.map((r) => ({
      ...r,
      replies: replies.filter((reply) => reply.parent_comment_id === r.id),
    }))
    return { data: nested, error }
  }
  return { data: [], error }
}

export async function createComment(comment: {
  post_id: string
  user_id: string
  content: string
  parent_comment_id?: string | null
  image_url?: string | null
}) {
  return supabase.from('comments').insert(comment).select('*, user:users(id, username, avatar)').single()
}

export async function deleteComment(id: string) {
  return supabase.from('comments').delete().eq('id', id)
}

export async function hideComment(id: string) {
  return supabase.from('comments').update({ status: 'hidden' }).eq('id', id)
}

export async function uploadCommentImage(file: File, userId: string): Promise<string> {
  void userId
  const result = await uploadImageToCloudinary(file, 'football-stories/comments')
  return result.secure_url
}

// ---- LIKES / BOOKMARKS ----

export async function toggleLike(userId: string, postId: string, isLiked: boolean) {
  if (isLiked) {
    return supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId)
  }
  return supabase.from('likes').insert({ user_id: userId, post_id: postId })
}

export async function toggleBookmark(userId: string, postId: string, isBookmarked: boolean) {
  if (isBookmarked) {
    return supabase.from('bookmarks').delete().eq('user_id', userId).eq('post_id', postId)
  }
  return supabase.from('bookmarks').insert({ user_id: userId, post_id: postId })
}

export async function recordPostShare(userId: string, postId: string, platform: string) {
  return supabase.from('post_shares').insert({
    user_id: userId,
    post_id: postId,
    platform,
  })
}

export async function toggleFollow(userId: string, seriesId: string, isFollowing: boolean) {
  if (isFollowing) {
    return supabase.from('follows').delete().eq('user_id', userId).eq('series_id', seriesId)
  }
  return supabase.from('follows').insert({ user_id: userId, series_id: seriesId })
}

export async function getUserInteractions(userId: string, postId: string) {
  const [{ data: likes, error: likesError }, { data: bookmarks, error: bookmarksError }] = await Promise.all([
    supabase.from('likes').select('*').eq('user_id', userId).eq('post_id', postId),
    supabase.from('bookmarks').select('*').eq('user_id', userId).eq('post_id', postId),
  ])
  if (likesError) throw likesError
  if (bookmarksError) throw bookmarksError
  return {
    isLiked: (likes?.length ?? 0) > 0,
    isBookmarked: (bookmarks?.length ?? 0) > 0,
  }
}

// ---- TAGS ----

export async function fetchTags() {
  return supabase.from('tags').select('*').order('name')
}

export async function fetchTaxonomies() {
  const [leagues, clubs, players, seasons] = await Promise.all([
    supabase.from('leagues').select('*').order('name'),
    supabase.from('clubs').select('*').order('name'),
    supabase.from('players').select('*').order('name'),
    supabase.from('seasons').select('*').order('starts_on', { ascending: false }),
  ])
  return {
    leagues: leagues.data ?? [],
    clubs: clubs.data ?? [],
    players: players.data ?? [],
    seasons: seasons.data ?? [],
  }
}

export async function fetchWeeklyPopularPosts(limit = 20) {
  const { data: ranking, error } = await supabase.rpc('weekly_popular_posts', { p_limit: limit })
  if (error || !ranking?.length) return { data: [], error }
  const rankedRows = ranking as { post_id: string; weekly_views: number }[]
  const ids = rankedRows.map(item => item.post_id)
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('*, author:users!posts_author_id_fkey(id, username, avatar), series:series(id, name, slug)')
    .in('id', ids)
  const byId = new Map((posts ?? []).map(post => [post.id, post]))
  return {
    data: rankedRows.flatMap(item => {
      const post = byId.get(item.post_id)
      return post ? [{ ...post, weekly_views: item.weekly_views }] : []
    }),
    error: postsError,
  }
}

export async function subscribeNewsletter(email: string) {
  return supabase.rpc('subscribe_newsletter', { p_email: email })
}

export async function createTag(name: string, slug: string) {
  return supabase.from('tags').insert({ name, slug }).select().single()
}

// ---- eFOOTBALL COMMUNITY ----

export async function fetchCommunityPosts({
  page = 1,
  limit = 12,
  type = 'all',
  viewerId,
}: { page?: number; limit?: number; type?: 'all' | 'discussion' | 'reel' | 'showcase'; viewerId?: string } = {}) {
  let hiddenAuthorIds: string[] = []
  if (viewerId) {
    const { data: relations } = await supabase
      .from('community_user_relations')
      .select('target_user_id')
      .eq('follower_id', viewerId)
      .in('relation_type', ['mute', 'block'])
    hiddenAuthorIds = [...new Set((relations ?? []).map(relation => relation.target_user_id))]
  }
  let query = supabase
    .from('community_posts')
    .select(`
      *,
      author:users!community_posts_author_id_fkey(id, username, avatar),
      likes:community_post_likes(count),
      comments:community_post_comments(count)
    `, { count: 'exact' })
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (type !== 'all') query = query.eq('post_type', type)
  if (hiddenAuthorIds.length) query = query.not('author_id', 'in', `(${hiddenAuthorIds.join(',')})`)
  return query as unknown as Promise<{ data: CommunityPostWithDetails[] | null; error: Error | null; count: number | null }>
}

export async function createCommunityPost(data: {
  author_id: string
  post_type: 'discussion' | 'reel' | 'showcase'
  title?: string | null
  content: string
  media_url?: string | null
  media_public_id?: string | null
  media_type?: 'image' | 'video' | null
  thumbnail_url?: string | null
  game_version?: string | null
  tactic?: string | null
}) {
  return supabase.from('community_posts').insert({
    ...data,
    title: data.title?.trim() || null,
    media_url: data.media_url || null,
    media_public_id: data.media_public_id || null,
    media_type: data.media_type || null,
    game_version: data.game_version?.trim() || null,
    tactic: data.tactic?.trim() || null,
    status: 'published',
  }).select(`*, author:users!community_posts_author_id_fkey(id, username, avatar)`).single()
}

export async function fetchCommunityComments(postId: string) {
  const { data, error } = await supabase
    .from('community_post_comments')
    .select('*, user:users(id, username, avatar)')
    .eq('post_id', postId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })

  return { data: (data ?? []) as unknown as CommunityCommentWithUser[], error }
}

export async function createCommunityComment(data: {
  post_id: string
  user_id: string
  content: string
  parent_comment_id?: string | null
}) {
  return supabase.from('community_post_comments').insert({
    ...data,
    content: data.content.trim(),
    parent_comment_id: data.parent_comment_id ?? null,
  }).select('*, user:users(id, username, avatar)').single()
}

export async function toggleCommunityLike(postId: string, userId: string, isLiked: boolean) {
  if (isLiked) return supabase.from('community_post_likes').delete().eq('post_id', postId).eq('user_id', userId)
  return supabase.from('community_post_likes').insert({ post_id: postId, user_id: userId })
}

export async function fetchCommunityLikeState(postId: string, userId?: string) {
  const query = supabase.from('community_post_likes').select('post_id, user_id').eq('post_id', postId)
  if (userId) query.eq('user_id', userId)
  const { data, error } = await query
  return { isLiked: (data?.length ?? 0) > 0, error }
}

export async function toggleCommunityBookmark(postId: string, userId: string, isBookmarked: boolean) {
  if (isBookmarked) return supabase.from('community_post_bookmarks').delete().eq('post_id', postId).eq('user_id', userId)
  return supabase.from('community_post_bookmarks').insert({ post_id: postId, user_id: userId })
}

export async function fetchCommunityBookmarkState(postId: string, userId?: string) {
  if (!userId) return { isBookmarked: false, error: null }
  const { data, error } = await supabase.from('community_post_bookmarks').select('post_id').eq('post_id', postId).eq('user_id', userId)
  return { isBookmarked: (data?.length ?? 0) > 0, error }
}

export async function toggleCommunityUserRelation(followerId: string, targetUserId: string, relationType: 'follow' | 'mute' | 'block', enabled: boolean) {
  const query = supabase.from('community_user_relations').delete().eq('follower_id', followerId).eq('target_user_id', targetUserId).eq('relation_type', relationType)
  if (enabled) return query
  return supabase.from('community_user_relations').insert({ follower_id: followerId, target_user_id: targetUserId, relation_type: relationType })
}

export async function fetchCommunityUserRelations(followerId: string, targetUserId: string) {
  const { data, error } = await supabase.from('community_user_relations').select('relation_type').eq('follower_id', followerId).eq('target_user_id', targetUserId)
  const relations = new Set((data ?? []).map(item => item.relation_type))
  return { isFollowing: relations.has('follow'), isMuted: relations.has('mute'), isBlocked: relations.has('block'), error }
}

export async function submitContentReport(data: {
  reporter_id: string
  target_type: 'post' | 'community_post' | 'comment' | 'community_comment' | 'reel'
  target_id: string
  reason: string
  description?: string
}) {
  return supabase.from('content_reports').insert(data)
}

export async function uploadCommunityMedia(source: File | string, mediaType: 'image' | 'video') {
  const result = mediaType === 'video'
    ? await uploadVideoToCloudinary(source, 'football-stories/community')
    : await uploadImageToCloudinary(source, 'football-stories/community')
  return {
    url: optimizeCloudinaryDeliveryUrl(result.secure_url, mediaType),
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    duration: result.duration,
    thumbnailUrl: mediaType === 'video'
      ? cloudinaryVideoPosterUrl(result.secure_url)
      : null,
  }
}

// ---- HISTORY TIMELINE ----

export async function fetchTimelineEvents(status?: 'draft' | 'published') {
  let query = supabase
    .from('history_timeline_events')
    .select('*, post:posts(id, title, slug)')
    .order('sort_order', { ascending: true })
    .order('year', { ascending: true })
  if (status) query = query.eq('status', status)
  const result = await query
  return { data: (result.data ?? []) as unknown as HistoryTimelineEventWithPost[], error: result.error }
}

export type TimelineEventInput = Omit<HistoryTimelineEventWithPost, 'id' | 'created_at' | 'updated_at' | 'post'>

export async function createTimelineEvent(input: TimelineEventInput) {
  return supabase.from('history_timeline_events').insert(input).select('*, post:posts(id, title, slug)').single()
}

export async function updateTimelineEvent(id: string, input: Partial<TimelineEventInput>) {
  return supabase.from('history_timeline_events').update(input).eq('id', id).select('*, post:posts(id, title, slug)').single()
}

export async function deleteTimelineEvent(id: string) {
  return supabase.from('history_timeline_events').delete().eq('id', id)
}

// ---- NOTIFICATIONS ----

export async function fetchNotifications(userId: string, limit = 20) {
  return supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function markNotificationRead(id: string) {
  return supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

export async function markAllNotificationsRead(userId: string) {
  return supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
}

// ---- REPORTS ----

export async function submitReport(data: {
  reporter_id: string
  reported_user_id: string
  reason: string
  description?: string
}) {
  return supabase.from('reports').insert(data)
}

export async function fetchReports() {
  return supabase
    .from('reports')
    .select('*, reporter:users!reporter_id(username, avatar), reported:users!reported_user_id(username, avatar, status)')
    .order('created_at', { ascending: false })
}

export async function updateReportStatus(id: string, status: 'ignored' | 'warned' | 'locked') {
  return supabase.from('reports').update({ status }).eq('id', id)
}

// ---- USER MANAGEMENT ----

export async function fetchUsers(page = 1, limit = 20) {
  return supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)
}

export async function updateUserStatus(id: string, status: 'active' | 'suspended' | 'banned') {
  return supabase.from('users').update({ status }).eq('id', id)
}

export async function updateUserRole(id: string, role: 'admin' | 'editor' | 'moderator' | 'contributor' | 'user') {
  return supabase.from('users').update({ role }).eq('id', id)
}

export async function runAdminSecurityAction(action: 'lock' | 'unlock' | 'revoke_sessions', userId: string) {
  const { data, error } = await supabase.functions.invoke('admin-security-actions', { body: { action, userId } })
  if (error || data?.error) return { data: null, error: new Error(data?.error ?? error?.message ?? 'Không thể thực hiện thao tác bảo mật') }
  return { data, error: null }
}

export async function fetchAuditLogs(limit = 100) {
  return supabase.from('audit_logs').select('*, actor:users!audit_logs_actor_id_fkey(username, avatar)').order('created_at', { ascending: false }).limit(limit)
}

export async function fetchContentReports() {
  return supabase.from('content_reports').select('*, reporter:users!content_reports_reporter_id_fkey(username, avatar)').order('created_at', { ascending: false })
}

export async function updateContentReport(id: string, status: 'reviewing' | 'resolved' | 'dismissed') {
  return supabase.from('content_reports').update({ status, resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null }).eq('id', id)
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  void userId
  const result = await uploadImageToCloudinary(file, 'football-stories/avatars')
  return result.secure_url
}

export async function updateProfile(userId: string, updates: { username?: string; bio?: string; avatar?: string }) {
  return supabase.from('users').update(updates).eq('id', userId)
}

// ---- SEARCH ----

export async function searchPosts(query: string, page = 1, limit = 10) {
  return supabase
    .from('posts')
    .select('*, author:users!posts_author_id_fkey(username, avatar), series:series(name, slug)', { count: 'exact' })
    .eq('status', 'published')
    .textSearch('tsv', query, { type: 'websearch' })
    .range((page - 1) * limit, page * limit - 1)
}

// ---- SLUG HELPER ----

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
