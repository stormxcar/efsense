import { cloudinaryVideoPosterUrl, optimizeCloudinaryDeliveryUrl, uploadImageToCloudinary, uploadVideoToCloudinary } from '@/lib/cloudinary'
import { setRememberMe, supabase } from '@/lib/supabase'
import { validateEmail, validatePassword, validateUsername } from '@/utils/validation'
import type { AdminModerationCommentRow, AuditLogRow, CommentRevisionRow, CommentWithUser, CommunityCommentReactionSummary, CommunityCommentWithUser, CommunityGameVersionRow, CommunityPopularRankRow, CommunityPostMedia, CommunityPostWithDetails, CommunityReactionSummary, CommunityReactionType, CommunityTag, GroupedNotificationRow, HistoryTimelineEventWithPost, RecommendedPostRow, UserRow, WeeklyCommunityCreatorRow } from '@/types/database'

// ---- AUTH SERVICES ----

function friendlyAuthMessage(message: string, fallback: string) {
  const normalized = message.trim().toLowerCase()
  if (!normalized || normalized === 'edge function returned a non-2xx status code') return fallback
  if (normalized.includes('email not confirmed')) return 'Email chưa được xác minh. Hãy kiểm tra hộp thư trước khi đăng nhập.'
  if (normalized.includes('invalid login credentials') || normalized.includes('invalid credentials')) return 'Email hoặc mật khẩu chưa đúng.'
  if (normalized.includes('user already registered') || normalized.includes('already been registered')) return 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.'
  if (normalized.includes('password should be at least')) return 'Mật khẩu chưa đủ độ dài yêu cầu.'
  if (normalized.includes('failed to fetch') || normalized.includes('network')) return 'Không thể kết nối máy chủ. Vui lòng thử lại.'
  return message
}

async function friendlyEdgeFunctionError(error: unknown, fallback: string) {
  const context = error && typeof error === 'object' && 'context' in error ? (error as { context?: unknown }).context : null
  if (typeof Response !== 'undefined' && context instanceof Response) {
    try {
      const payload = await context.clone().json() as { error?: unknown; message?: unknown }
      const serverMessage = typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : ''
      if (serverMessage) return new Error(serverMessage)
    } catch {
      // The response may not contain JSON. Fall through to the safe fallback.
    }
  }
  const rawMessage = error instanceof Error ? error.message : ''
  return new Error(friendlyAuthMessage(rawMessage, fallback))
}

export async function signUp(email: string, password: string, username: string) {
  let normalizedEmail: string
  let normalizedUsername: string
  try {
    normalizedEmail = validateEmail(email)
    normalizedUsername = validateUsername(username)
    validatePassword(password)
  } catch (validationError) {
    return { data: null, error: validationError instanceof Error ? validationError : new Error('Thông tin đăng ký chưa hợp lệ.') }
  }
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { username: normalizedUsername } },
  })
  return { data, error: error ? new Error(friendlyAuthMessage(error.message, 'Không thể tạo tài khoản lúc này.')) : null }
}

export async function signIn(email: string, password: string, rememberMe = true) {
  let normalizedEmail: string
  try { normalizedEmail = validateEmail(email) } catch (validationError) {
    return { data: null, error: validationError instanceof Error ? validationError : new Error('Email không hợp lệ') }
  }
  if (!password) return { data: null, error: new Error('Vui lòng nhập mật khẩu') }
  setRememberMe(rememberMe)
  const { data, error } = await supabase.functions.invoke('secure-login', {
    body: { email: normalizedEmail, password },
  })
  if (error || data?.error || !data?.session) {
    return { data: null, error: data?.error ? new Error(friendlyAuthMessage(String(data.error), 'Đăng nhập thất bại.')) : await friendlyEdgeFunctionError(error, 'Email hoặc mật khẩu chưa đúng.') }
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
  if (data?.error) return { data: null, error: new Error(String(data.error)) }
  if (error) return { data: null, error: await friendlyEdgeFunctionError(error, 'Không thể tạo người dùng.') }
  return { data, error: null }
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
  return data
}

// ---- POST SERVICES ----

type PostMetricRelations = {
  likes?: Array<{ count: number }> | null
  comments?: Array<{ count: number }> | null
  likes_count?: number
  comments_count?: number
}

function normalizePostMetrics<T extends object>(posts: T[] | null) {
  return (posts ?? []).map(post => {
    const metrics = post as T & PostMetricRelations
    return {
      ...post,
      likes_count: Number(metrics.likes_count ?? metrics.likes?.[0]?.count ?? 0),
      comments_count: Number(metrics.comments_count ?? metrics.comments?.[0]?.count ?? 0),
    }
  })
}

async function fetchViewerLikedPostIds(viewerId: string | undefined, postIds: string[]) {
  if (!viewerId || postIds.length === 0) return new Set<string>()
  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', viewerId)
    .in('post_id', postIds)
  if (error) return new Set<string>()
  return new Set((data ?? []).map(row => row.post_id))
}

async function attachViewerLikeState<T extends { id: string }>(posts: T[], viewerId?: string) {
  const likedIds = await fetchViewerLikedPostIds(viewerId, posts.map(post => post.id))
  return posts.map(post => ({ ...post, is_liked: likedIds.has(post.id) }))
}

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
  viewerId,
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
  viewerId?: string
}) {
  let query = supabase
    .from('posts')
    .select(`
      id, title, slug, excerpt, cover_image, author_id, series_id, status, view_count, featured,
      image_alt, reading_time_minutes, published_at, created_at, updated_at,
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

  const result = await query
  const normalized = normalizePostMetrics(result.data ?? [])
  return { ...result, data: await attachViewerLikeState(normalized, viewerId) }
}

export async function recordUserActivity(
  userId: string,
  eventType: string,
  targetType?: string | null,
  targetId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.rpc('record_user_activity', {
    p_user_id: userId,
    p_event_type: eventType,
    p_target_type: targetType ?? null,
    p_target_id: targetId ?? null,
    p_metadata: metadata,
  })
  return { data: data as string | null, error }
}

export async function fetchRecommendedPosts(userId: string, limit = 12) {
  const { data, error } = await supabase.rpc('recommended_posts', { p_user_id: userId, p_limit: limit })
  const rows = (data ?? []) as RecommendedPostRow[]
  const likedIds = await fetchViewerLikedPostIds(userId, rows.map(row => row.post_id))
  return { data: rows.map(row => ({ ...row, is_liked: likedIds.has(row.post_id) })), error }
}

export async function fetchAdminDashboardMetrics(days = 30) {
  const [summary, timeseries] = await Promise.all([
    supabase.rpc('admin_dashboard_summary', { p_days: days }),
    supabase.rpc('admin_dashboard_timeseries', { p_days: days }),
  ])
  return { summary: (summary.data ?? {}) as { dau?: number; reads?: number; reels?: number; approval_rate?: number; retention_7d?: number }, timeseries: timeseries.data ?? [], error: summary.error ?? timeseries.error }
}

export async function fetchOrphanMediaAssets(limit = 200) {
  return supabase.rpc('find_orphan_media_assets', { p_limit: limit })
}

export async function cleanupOrphanMediaAssets(ids: string[]) {
  return supabase.rpc('cleanup_orphan_media_assets', { p_ids: ids })
}

export async function markMediaAssetsReferenced(publicIds: string[], referenceType: string, referenceId: string) {
  const ids = [...new Set(publicIds.filter(Boolean))]
  if (!ids.length) return { data: 0, error: null }
  return supabase.rpc('mark_media_assets_referenced', {
    p_public_ids: ids,
    p_reference_type: referenceType,
    p_reference_id: referenceId,
  })
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

export async function fetchRelatedPosts(postId: string, seriesId: string | null, limit = 3, viewerId?: string) {
  let query = supabase
    .from('posts')
    .select('id, title, slug, cover_image, excerpt, published_at, reading_time_minutes, view_count, created_at, updated_at, status, featured, author_id, series_id, likes(count), comments(count), series:series(id, name, slug)')
    .eq('status', 'published')
    .neq('id', postId)
    .limit(limit)

  if (seriesId) query = query.eq('series_id', seriesId)
  const result = await query
  const normalized = normalizePostMetrics(result.data ?? [])
  return { ...result, data: await attachViewerLikeState(normalized, viewerId) }
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

export async function reschedulePost(id: string, scheduledAt: string) {
  return supabase.from('posts').update({ status: 'scheduled', scheduled_at: scheduledAt, published_at: null }).eq('id', id).select('id,status,scheduled_at').single()
}

export async function fetchPostRevisions(postId: string) {
  return supabase.from('post_revisions').select('*').eq('post_id', postId).order('version', { ascending: false })
}

export async function fetchPostSnapshot(postId: string) {
  return supabase.from('posts').select('id,title,slug,excerpt,content,cover_image,status').eq('id', postId).single()
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

export type CommentCursor = { created_at: string; id: string }
export type CommentPage<T> = { data: T[]; nextCursor: CommentCursor | null; hasMore: boolean; error: Error | null }

function applyCommentCursor<T extends { or: (filters: string) => T }>(query: T, cursor?: CommentCursor | null) {
  if (!cursor) return query
  const createdAt = new Date(cursor.created_at).toISOString()
  return query.or(`created_at.gt.${createdAt},and(created_at.eq.${createdAt},id.gt.${cursor.id})`)
}

function toCommentPage<T extends { id: string; created_at: string }>(rows: T[] | null, error: Error | null, limit: number): CommentPage<T> {
  const result = rows ?? []
  const hasMore = result.length > limit
  const data = hasMore ? result.slice(0, limit) : result
  const last = data.at(-1)
  return { data, nextCursor: hasMore && last ? { created_at: last.created_at, id: last.id } : null, hasMore, error }
}

async function withReplyCounts<T extends { id: string; created_at: string }>(commentType: 'post' | 'community', rows: T[]) {
  if (!rows.length) return { data: rows.map(row => ({ ...row, reply_count: 0 })), error: null }
  const result = await supabase.rpc('comment_reply_counts', {
    p_comment_type: commentType,
    p_parent_ids: rows.map(row => row.id),
  })
  if (result.error) return { data: [] as Array<T & { reply_count: number }>, error: result.error }
  const counts = new Map((result.data ?? []).map((item: { parent_id: string; reply_count: number }) => [item.parent_id, Number(item.reply_count)]))
  return { data: rows.map(row => ({ ...row, reply_count: counts.get(row.id) ?? 0 })), error: null }
}

export async function fetchComments(postId: string, cursor?: CommentCursor | null, limit = 12): Promise<CommentPage<CommentWithUser>> {
  let query = supabase
    .from('comments')
    .select('*, user:users!comments_user_id_fkey(id, username, avatar)')
    .eq('post_id', postId)
    .eq('status', 'visible')
    .is('parent_comment_id', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1)
  query = applyCommentCursor(query, cursor)
  const { data, error } = await query
  if (error) return toCommentPage([], error, limit)
  const counted = await withReplyCounts('post', (data ?? []) as unknown as CommentWithUser[])
  return toCommentPage(counted.data, counted.error, limit)
}

export async function fetchCommentReplies(parentCommentId: string, cursor?: CommentCursor | null, limit = 10): Promise<CommentPage<CommentWithUser>> {
  let query = supabase
    .from('comments')
    .select('*, user:users!comments_user_id_fkey(id, username, avatar)')
    .eq('parent_comment_id', parentCommentId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1)
  query = applyCommentCursor(query, cursor)
  const { data, error } = await query
  if (error) return toCommentPage([], error, limit)
  return toCommentPage((data ?? []) as unknown as CommentWithUser[], null, limit)
}

export async function fetchCommentCount(postId: string) {
  return supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', postId).eq('status', 'visible')
}

export async function createComment(comment: {
  post_id: string
  user_id: string
  content: string
  parent_comment_id?: string | null
  reply_to_comment_id?: string | null
  reply_to_user_id?: string | null
  reply_to_name?: string | null
  image_url?: string | null
}) {
  return supabase.from('comments').insert(comment).select('*, user:users!comments_user_id_fkey(id, username, avatar)').single()
}

export async function deleteComment(id: string) {
  return supabase.from('comments').delete().eq('id', id)
}

export async function hideComment(id: string) {
  return supabase.from('comments').update({ status: 'hidden' }).eq('id', id)
}

export async function uploadCommentImage(file: File, userId: string): Promise<{ url: string; publicId: string }> {
  void userId
  const result = await uploadImageToCloudinary(file, 'football-stories/comments')
  return { url: result.secure_url, publicId: result.public_id }
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

export async function fetchWeeklyPopularPosts(limit = 20, viewerId?: string) {
  const { data: ranking, error } = await supabase.rpc('weekly_popular_posts', { p_limit: limit })
  if (error || !ranking?.length) return { data: [], error }
  const rankedRows = ranking as { post_id: string; weekly_views: number }[]
  const ids = rankedRows.map(item => item.post_id)
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('*, author:users!posts_author_id_fkey(id, username, avatar), series:series(id, name, slug), likes(count), comments(count)')
    .in('id', ids)
  const byId = new Map(normalizePostMetrics(posts ?? []).map(post => [post.id, post]))
  const likedIds = await fetchViewerLikedPostIds(viewerId, ids)
  return {
    data: rankedRows.flatMap(item => {
      const post = byId.get(item.post_id)
      return post ? [{ ...post, weekly_views: item.weekly_views, is_liked: likedIds.has(post.id) }] : []
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

export type CommunityCollection = 'liked' | 'bookmarked' | 'voted'
export type CommunitySort = 'newest' | 'oldest' | 'popular'

export function communityTagSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function normalizeCommunityTagNames(tags: string[] = []) {
  const seen = new Set<string>()
  return tags.map(tag => tag.replace(/^#+/, '').trim().replace(/\s+/g, ' ')).filter(tag => {
    const slug = communityTagSlug(tag)
    if (!slug || seen.has(slug)) return false
    seen.add(slug)
    return true
  }).slice(0, 8)
}

export async function fetchCommunityTags(search = '') {
  let query = supabase.from('community_tags').select('id, name, slug').order('name').limit(30)
  const term = search.trim().replace(/[%,]/g, ' ')
  if (term) query = query.ilike('name', `%${term}%`)
  return query as unknown as Promise<{ data: CommunityTag[] | null; error: Error | null }>
}

async function syncCommunityPostTags(postId: string, authorId: string, tagNames: string[]) {
  const normalized = normalizeCommunityTagNames(tagNames)
  const namesBySlug = new Map(normalized.map(name => [communityTagSlug(name), name]))
  const slugs = [...namesBySlug.keys()]
  const deleteResult = await supabase.from('community_post_tags').delete().eq('post_id', postId)
  if (deleteResult.error) return deleteResult
  if (!slugs.length) return { data: null, error: null }

  const existingResult = await supabase.from('community_tags').select('id, name, slug').in('slug', slugs)
  if (existingResult.error) return existingResult
  const existing = (existingResult.data ?? []) as CommunityTag[]
  const existingSlugs = new Set(existing.map(tag => tag.slug))
  const missing = slugs.filter(slug => !existingSlugs.has(slug)).map(slug => ({ name: namesBySlug.get(slug) ?? slug, slug, created_by: authorId }))
  if (missing.length) {
    const insertResult = await supabase.from('community_tags').insert(missing)
    if (insertResult.error && insertResult.error.code !== '23505') return insertResult
  }

  const finalResult = await supabase.from('community_tags').select('id, name, slug').in('slug', slugs)
  if (finalResult.error) return finalResult
  return supabase.from('community_post_tags').insert((finalResult.data as CommunityTag[]).map(tag => ({ post_id: postId, tag_id: tag.id })))
}

export async function fetchCommunityPosts({
  page = 1,
  limit = 12,
  type = 'all',
  viewerId,
  collection,
  search = '',
  sort = 'newest',
  tagSlug,
  gameVersion,
  authorId,
}: { page?: number; limit?: number; type?: 'all' | 'discussion' | 'reel' | 'showcase'; viewerId?: string; authorId?: string; collection?: CommunityCollection; search?: string; sort?: CommunitySort; tagSlug?: string; gameVersion?: string } = {}) {
  let popularRanks: CommunityPopularRankRow[] | null = null
  if (sort === 'popular') {
    const rankingResult = await supabase.rpc('popular_community_posts', {
      p_type: type,
      p_viewer_id: viewerId ?? null,
      p_author_id: authorId ?? null,
      p_collection: collection ?? null,
      p_search: search.trim() || null,
      p_tag_slug: tagSlug?.trim() || null,
      p_game_version: gameVersion?.trim() || null,
      p_limit: limit,
      p_offset: (page - 1) * limit,
    })
    if (rankingResult.error) return { data: null, error: rankingResult.error, count: 0 }
    popularRanks = (rankingResult.data ?? []) as CommunityPopularRankRow[]
    if (!popularRanks.length) return { data: [], error: null, count: 0 }
  }
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
      comments:community_post_comments(count),
      tags:community_post_tags(tag:community_tags(id, name, slug)),
      media:community_post_media(id, post_id, media_type, media_url, media_public_id, thumbnail_url, alt, sort_order),
      poll:community_post_polls(
        id, post_id, question, closes_at,
        options:community_post_poll_options(id, label, sort_order, votes:community_post_poll_votes(count))
      )
    `, { count: 'exact' })
    .eq('status', 'published')
    .order('created_at', { ascending: sort === 'oldest' })

  if (type !== 'all') query = query.eq('post_type', type)
  if (gameVersion?.trim()) query = query.ilike('game_version', gameVersion.trim())
  if (authorId) query = query.eq('author_id', authorId)
  if (collection && viewerId) {
    let relationRows: Array<{ post_id?: string; poll?: { post_id: string } | null }> = []
    let relationError: Error | null = null
    if (collection === 'voted') {
      const result = await supabase.from('community_post_poll_votes').select('poll:community_post_polls!inner(post_id)').eq('user_id', viewerId)
      relationRows = (result.data ?? []) as unknown as Array<{ poll?: { post_id: string } | null }>
      relationError = result.error
    } else {
      const relationTable = collection === 'liked' ? 'community_post_likes' : 'community_post_bookmarks'
      const result = await supabase.from(relationTable).select('post_id').eq('user_id', viewerId)
      relationRows = (result.data ?? []) as Array<{ post_id?: string }>
      relationError = result.error
    }
    if (relationError) return { data: null, error: relationError, count: 0 }
    const postIds = relationRows.map(row => row.post_id ?? row.poll?.post_id).filter((id): id is string => Boolean(id))
    if (!postIds.length) return { data: [], error: null, count: 0 }
    query = query.in('id', postIds)
  }
  const cleanSearch = search.trim().replace(/[%,]/g, ' ')
  if (cleanSearch) query = query.or(`title.ilike.%${cleanSearch}%,content.ilike.%${cleanSearch}%,game_version.ilike.%${cleanSearch}%,tactic.ilike.%${cleanSearch}%`)
  if (tagSlug) {
    const tagResult = await supabase.from('community_post_tags').select('post_id, tag:community_tags!inner(slug)').eq('tag.slug', tagSlug)
    if (tagResult.error) return { data: null, error: tagResult.error, count: 0 }
    const tagPostIds = (tagResult.data ?? []).map(row => row.post_id)
    if (!tagPostIds.length) return { data: [], error: null, count: 0 }
    query = query.in('id', tagPostIds)
  }
  if (hiddenAuthorIds.length) query = query.not('author_id', 'in', `(${hiddenAuthorIds.join(',')})`)
  if (popularRanks) query = query.in('id', popularRanks.map(row => row.post_id))
  const result = popularRanks ? await query : await query.range((page - 1) * limit, page * limit - 1)
  if (result.error) return result as unknown as { data: CommunityPostWithDetails[] | null; error: Error | null; count: number | null }
  const rows = ((result.data ?? []) as unknown as CommunityPostWithDetails[])
  const reactionResult = rows.length
    ? await supabase.from('community_post_reaction_counts').select('post_id, reaction, count').in('post_id', rows.map(row => row.id))
    : { data: [], error: null }
  const reactionByPost = new Map<string, CommunityReactionSummary[]>()
  for (const row of (reactionResult.data ?? []) as Array<{ post_id: string; reaction: CommunityReactionType; count: number }>) {
    const current = reactionByPost.get(row.post_id) ?? []
    current.push({ reaction: row.reaction, count: Number(row.count) })
    reactionByPost.set(row.post_id, current)
  }
  const rankByPost = new Map((popularRanks ?? []).map(rank => [rank.post_id, rank]))
  const enrichedRows = rows.map(row => {
    const rank = rankByPost.get(row.id)
    return {
      ...row,
      reactions: reactionByPost.get(row.id) ?? [],
      ...(rank ? {
        popular_score: Number(rank.popular_score),
        quality_score: Number(rank.quality_score),
        share_count: Number(rank.share_count),
        community_view_count: Number(rank.view_count),
      } : {}),
    }
  })
  if (popularRanks) enrichedRows.sort((left, right) => (rankByPost.get(right.id)?.popular_score ?? 0) - (rankByPost.get(left.id)?.popular_score ?? 0))
  return { data: enrichedRows, error: null, count: popularRanks?.[0]?.total_count ?? result.count }
}

export async function recordCommunityPostView(postId: string) {
  return supabase.rpc('record_community_post_view', {
    p_post_id: postId,
    p_visitor_key: getCommunityDeviceFingerprint(),
  })
}

export async function recordCommunityPostShare(postId: string, platform: 'native' | 'copy' | 'facebook' | 'messenger' | 'x' | 'telegram' | 'zalo' | 'other' = 'other') {
  return supabase.rpc('record_community_post_share', {
    p_post_id: postId,
    p_platform: platform,
    p_visitor_key: getCommunityDeviceFingerprint(),
  })
}

export async function createCommunityPost(data: {
  author_id: string
  post_type: 'discussion' | 'reel' | 'showcase'
  title?: string | null
  content?: string | null
  media_url?: string | null
  media_public_id?: string | null
  media_type?: 'image' | 'video' | null
  thumbnail_url?: string | null
  game_version?: string | null
  tactic?: string | null
  tags?: string[]
  media?: Array<Pick<CommunityPostMedia, 'media_type' | 'media_url' | 'media_public_id' | 'thumbnail_url' | 'alt' | 'sort_order'>>
  poll?: { question: string; options: string[] } | null
}) {
  const { poll, tags, media, ...postData } = data
  const result = await supabase.from('community_posts').insert({
    ...postData,
    title: postData.title?.trim() || null,
    content: postData.content?.trim() || '',
    media_url: postData.media_url || null,
    media_public_id: postData.media_public_id || null,
    media_type: postData.media_type || null,
    game_version: postData.game_version?.trim() || null,
    tactic: postData.tactic?.trim() || null,
    status: 'published',
  }).select(`*, author:users!community_posts_author_id_fkey(id, username, avatar)`).single()
  if (result.error || !result.data) return result

  const cleanupPost = async () => {
    await supabase.from('community_posts').delete().eq('id', result.data.id).eq('author_id', data.author_id)
  }
  const tagsResult = await syncCommunityPostTags(result.data.id, data.author_id, tags ?? [])
  if (tagsResult.error) {
    await cleanupPost()
    return { data: null, error: tagsResult.error }
  }
  if (media?.length) {
    const mediaResult = await supabase.from('community_post_media').insert(media.map((item, index) => ({
      post_id: result.data.id,
      media_type: item.media_type,
      media_url: item.media_url,
      media_public_id: item.media_public_id ?? null,
      thumbnail_url: item.thumbnail_url ?? null,
      alt: item.alt ?? null,
      sort_order: item.sort_order ?? index,
    })))
    if (mediaResult.error) {
      await cleanupPost()
      return { data: null, error: mediaResult.error }
    }
  }
  if (!poll) return result

  const pollResult = await supabase.from('community_post_polls').insert({
    post_id: result.data.id,
    question: poll.question.trim(),
  }).select('id').single()
  if (pollResult.error || !pollResult.data) {
    await cleanupPost()
    return { data: null, error: pollResult.error ?? new Error('Không thể tạo bình chọn') }
  }

  const optionsResult = await supabase.from('community_post_poll_options').insert(poll.options.map((label, index) => ({
    poll_id: pollResult.data.id,
    label: label.trim(),
    sort_order: index,
  })))
  if (optionsResult.error) {
    await cleanupPost()
    return { data: null, error: optionsResult.error }
  }
  return result
}

export async function deleteCommunityPost(postId: string, authorId: string) {
  return supabase.from('community_posts').delete().eq('id', postId).eq('author_id', authorId)
}

export async function updateCommunityPost(postId: string, authorId: string, updates: {
  title?: string | null
  content?: string | null
  game_version?: string | null
  tactic?: string | null
  media_url?: string | null
  media_public_id?: string | null
  media_type?: 'image' | 'video' | null
  thumbnail_url?: string | null
  tags?: string[]
}) {
  const { tags, ...postUpdates } = updates
  const result = await supabase.from('community_posts').update({
    ...postUpdates,
    title: postUpdates.title?.trim() || null,
    content: postUpdates.content?.trim() || '',
    game_version: postUpdates.game_version?.trim() || null,
    tactic: postUpdates.tactic?.trim() || null,
    ...(postUpdates.media_url !== undefined ? {
      media_url: postUpdates.media_url || null,
      media_public_id: postUpdates.media_public_id || null,
      media_type: postUpdates.media_type || null,
      thumbnail_url: postUpdates.thumbnail_url || null,
    } : {}),
  }).eq('id', postId).eq('author_id', authorId).select(`*, author:users!community_posts_author_id_fkey(id, username, avatar)`).single()
  if (result.error || tags === undefined) return result
  const tagsResult = await syncCommunityPostTags(postId, authorId, tags)
  if (tagsResult.error) return { data: result.data, error: tagsResult.error }
  if (postUpdates.media_url !== undefined) {
    const deleteMediaResult = await supabase.from('community_post_media').delete().eq('post_id', postId)
    if (deleteMediaResult.error) return { data: result.data, error: deleteMediaResult.error }
    if (postUpdates.media_url) {
      const mediaResult = await supabase.from('community_post_media').insert({
        post_id: postId,
        media_type: postUpdates.media_type ?? 'image',
        media_url: postUpdates.media_url,
        media_public_id: postUpdates.media_public_id ?? null,
        thumbnail_url: postUpdates.thumbnail_url ?? null,
        alt: result.data.title ?? null,
        sort_order: 0,
      })
      if (mediaResult.error) return { data: result.data, error: mediaResult.error }
    }
  }
  return result
}

export async function fetchCommunityGameVersions(limit = 20) {
  const { data, error } = await supabase.rpc('community_game_versions', { p_limit: limit })
  return { data: (data ?? []) as CommunityGameVersionRow[], error }
}

export async function fetchWeeklyCommunityCreators(limit = 8) {
  const { data, error } = await supabase.rpc('weekly_community_creator_ranking', { p_limit: limit })
  return { data: (data ?? []) as WeeklyCommunityCreatorRow[], error }
}

export async function fetchCommunityPollVote(postId: string, userId?: string) {
  if (!userId) return { data: null, error: null }
  const pollResult = await supabase.from('community_post_polls').select('id').eq('post_id', postId).maybeSingle()
  if (pollResult.error || !pollResult.data) return { data: null, error: pollResult.error }
  const voteResult = await supabase.from('community_post_poll_votes').select('option_id').eq('poll_id', pollResult.data.id).eq('user_id', userId).maybeSingle()
  return { data: voteResult.data?.option_id ?? null, error: voteResult.error }
}

export async function voteCommunityPoll(postId: string, optionId: string, userId: string) {
  const pollResult = await supabase.from('community_post_polls').select('id').eq('post_id', postId).single()
  if (pollResult.error || !pollResult.data) return { data: null, error: pollResult.error ?? new Error('Không tìm thấy bình chọn') }
  return supabase.from('community_post_poll_votes').upsert({ poll_id: pollResult.data.id, option_id: optionId, user_id: userId })
}

export async function fetchCommunityComments(postId: string, cursor?: CommentCursor | null, limit = 12, parentCommentId?: string | null): Promise<CommentPage<CommunityCommentWithUser>> {
  let query = supabase
    .from('community_post_comments')
    // The reaction ledger also references users, so PostgREST needs the
    // comment's explicit FK to disambiguate this relationship.
    .select('*, user:users!community_post_comments_user_id_fkey(id, username, avatar)')
    .eq('post_id', postId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1)
  query = parentCommentId ? query.eq('parent_comment_id', parentCommentId) : query.is('parent_comment_id', null)
  query = applyCommentCursor(query, cursor)
  const { data, error } = await query
  if (error) return toCommentPage([], error, limit)
  if (parentCommentId) return toCommentPage((data ?? []) as unknown as CommunityCommentWithUser[], null, limit)
  const counted = await withReplyCounts('community', (data ?? []) as unknown as CommunityCommentWithUser[])
  return toCommentPage(counted.data, counted.error, limit)
}

export async function fetchCommunityCommentCount(postId: string) {
  return supabase.from('community_post_comments').select('id', { count: 'exact', head: true }).eq('post_id', postId).eq('status', 'visible')
}

export async function fetchCommunityCommentReactionData(commentIds: string[], userId?: string) {
  if (!commentIds.length) return { counts: [] as CommunityCommentReactionSummary[], mine: [] as Array<{ comment_id: string; reaction: CommunityReactionType }>, error: null }
  const countsQuery = supabase
    .from('community_comment_reaction_counts')
    .select('comment_id, reaction, count')
    .in('comment_id', commentIds)
  const mineQuery = userId
    ? supabase.from('community_comment_reactions').select('comment_id, reaction').eq('user_id', userId).in('comment_id', commentIds)
    : Promise.resolve({ data: [], error: null })
  const [countsResult, mineResult] = await Promise.all([countsQuery, mineQuery])
  return {
    counts: (countsResult.data ?? []) as CommunityCommentReactionSummary[],
    mine: (mineResult.data ?? []) as Array<{ comment_id: string; reaction: CommunityReactionType }>,
    error: countsResult.error ?? mineResult.error,
  }
}

export async function setCommunityCommentReaction(commentId: string, userId: string, reaction: CommunityReactionType | null) {
  if (!reaction) return supabase.from('community_comment_reactions').delete().eq('comment_id', commentId).eq('user_id', userId)
  return supabase.from('community_comment_reactions').upsert({ comment_id: commentId, user_id: userId, reaction }, { onConflict: 'comment_id,user_id' })
}

export async function fetchCommunityPollVotes(postId: string) {
  const pollResult = await supabase.from('community_post_polls').select('id').eq('post_id', postId).maybeSingle()
  if (pollResult.error || !pollResult.data) return { data: [] as Array<{ user_id: string; option_id: string }>, error: pollResult.error }
  const voteResult = await supabase.from('community_post_poll_votes').select('user_id, option_id').eq('poll_id', pollResult.data.id)
  return { data: (voteResult.data ?? []) as Array<{ user_id: string; option_id: string }>, error: voteResult.error }
}

export async function createCommunityComment(data: {
  post_id: string
  user_id: string
  content: string
  parent_comment_id?: string | null
  reply_to_comment_id?: string | null
  reply_to_user_id?: string | null
  reply_to_name?: string | null
  image_url?: string | null
  display_name_mode?: 'account' | 'anonymous' | 'alias'
  display_name?: string | null
}) {
  const displayNameMode = data.display_name_mode ?? 'account'
  const displayName = data.display_name?.trim() ?? ''
  if (displayNameMode === 'alias' && (displayName.length < 2 || displayName.length > 32)) {
    return { data: null, error: new Error('Biệt danh phải dài từ 2 đến 32 ký tự.') }
  }
  return supabase.from('community_post_comments').insert({
    ...data,
    content: data.content.trim(),
    parent_comment_id: data.parent_comment_id ?? null,
    image_url: data.image_url ?? null,
    display_name_mode: displayNameMode,
    display_name: displayName || null,
  }).select('*, user:users!community_post_comments_user_id_fkey(id, username, avatar)').single()
}

export async function toggleCommunityLike(postId: string, userId: string, isLiked: boolean) {
  return setCommunityReaction(postId, userId, isLiked ? null : 'like')
}

export async function fetchCommunityLikeState(postId: string, userId?: string) {
  return fetchCommunityReactionState(postId, userId)
}

export async function setCommunityReaction(postId: string, userId: string, reaction: CommunityReactionType | null) {
  if (!reaction) return supabase.from('community_post_likes').delete().eq('post_id', postId).eq('user_id', userId)
  return supabase.from('community_post_likes').upsert({ post_id: postId, user_id: userId, reaction }, { onConflict: 'post_id,user_id' })
}

export async function fetchCommunityReactionState(postId: string, userId?: string) {
  if (!userId) return { reaction: null as CommunityReactionType | null, isLiked: false, error: null }
  const { data, error } = await supabase.from('community_post_likes').select('reaction').eq('post_id', postId).eq('user_id', userId).maybeSingle()
  const reaction = (data?.reaction as CommunityReactionType | null) ?? null
  return { reaction, isLiked: Boolean(reaction), error }
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

export async function fetchCommunityTagFollowState(userId: string, tagId: string) {
  const { data, error } = await supabase.from('community_tag_follows').select('tag_id').eq('user_id', userId).eq('tag_id', tagId).maybeSingle()
  return { isFollowing: Boolean(data), error }
}

export async function toggleCommunityTagFollow(userId: string, tagId: string, isFollowing: boolean) {
  if (isFollowing) return supabase.from('community_tag_follows').delete().eq('user_id', userId).eq('tag_id', tagId)
  return supabase.from('community_tag_follows').insert({ user_id: userId, tag_id: tagId })
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

export type CommunityGuardAction = 'comment' | 'report' | 'post'

export function getCommunityDeviceFingerprint() {
  if (typeof window === 'undefined') return 'server'
  const key = 'football-stories-device-token'
  let token = window.localStorage.getItem(key)
  if (!token) {
    token = crypto.randomUUID()
    window.localStorage.setItem(key, token)
  }
  return token
}

export async function runCommunityGuard(input: {
  action: CommunityGuardAction
  fingerprint?: string
  startedAt?: number
  honeypot?: string
  humanCheck?: boolean
}) {
  const { data, error } = await supabase.functions.invoke('community-guard', {
    body: { ...input, fingerprint: input.fingerprint ?? getCommunityDeviceFingerprint() },
  })
  if (error) {
    const context = error && typeof error === 'object' && 'context' in error ? (error as { context?: unknown }).context : null
    if (typeof Response !== 'undefined' && context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown; requiresHuman?: unknown }
        if (typeof payload.error === 'string') return { ok: false, requiresHuman: payload.requiresHuman === true, error: new Error(payload.error) }
      } catch {
        // Keep the friendly fallback below for non-JSON responses.
      }
    }
    return { ok: false, requiresHuman: false, error: new Error('Không thể kiểm tra chống spam lúc này. Vui lòng thử lại.') }
  }
  return {
    ok: data?.ok !== false,
    requiresHuman: data?.requiresHuman === true,
    error: data?.error ? new Error(String(data.error)) : null,
  }
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

export async function fetchNotifications(userId: string, limit = 30, filter: 'all' | 'unread' | 'mention' | 'replies' = 'all') {
  void userId
  const { data, error } = await supabase.rpc('grouped_notifications', { p_limit: limit, p_filter: filter })
  return { data: (data ?? []) as GroupedNotificationRow[], error }
}

export async function markNotificationRead(id: string) {
  return supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

export async function markNotificationGroupRead(notificationIds: string[]) {
  return supabase.rpc('mark_notification_group_read', { p_notification_ids: notificationIds })
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
  if (data?.error) return { data: null, error: new Error(String(data.error)) }
  if (error) return { data: null, error: await friendlyEdgeFunctionError(error, 'Không thể thực hiện thao tác bảo mật.') }
  return { data, error: null }
}

export async function fetchAuditLogs({ page = 1, limit = 25, action, entityType, search, sort = 'newest' }: { page?: number; limit?: number; action?: string; entityType?: string; search?: string; sort?: 'newest' | 'oldest' } = {}) {
  let query = supabase
    .from('audit_logs')
    .select('*, actor:users!audit_logs_actor_id_fkey(username, avatar)', { count: 'exact' })
    .order('created_at', { ascending: sort === 'oldest' })
    .range((page - 1) * limit, page * limit - 1)
  if (action) query = query.eq('action', action)
  if (entityType) query = query.eq('entity_type', entityType)
  const cleanSearch = search?.trim().replace(/[%,]/g, ' ')
  if (cleanSearch) query = query.or(`action.ilike.%${cleanSearch}%,entity_type.ilike.%${cleanSearch}%`)
  const result = await query
  return { ...result, data: (result.data ?? []) as AuditLogRow[] }
}

export async function fetchAuditLogSummary(days = 30) {
  const { data, error } = await supabase.rpc('admin_audit_summary', { p_days: days })
  return { data: (data ?? {}) as { total?: number; period_total?: number; last_24h?: number; destructive?: number; unique_actors?: number; top_action?: string; top_entity?: string }, error }
}

export async function fetchAdminComments({ page = 1, limit = 20, status, commentType, search, sort = 'newest' }: { page?: number; limit?: number; status?: string; commentType?: 'post' | 'community'; search?: string; sort?: 'newest' | 'oldest' } = {}) {
  const { data, error } = await supabase.rpc('admin_comment_feed', {
    p_limit: limit,
    p_offset: (page - 1) * limit,
    p_status: status || null,
    p_comment_type: commentType || null,
    p_search: search?.trim() || null,
    p_sort: sort,
  })
  return { data: (data ?? []) as AdminModerationCommentRow[], error }
}

export async function fetchCommentRevisions(commentType: 'post' | 'community', commentId: string) {
  const { data, error } = await supabase
    .from('comment_revisions')
    .select('*')
    .eq('comment_type', commentType)
    .eq('comment_id', commentId)
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as CommentRevisionRow[], error }
}

export async function moderateCommentImage(commentType: 'post' | 'community', commentId: string, hidden: boolean) {
  return supabase.rpc('moderate_comment_image', { p_comment_type: commentType, p_comment_id: commentId, p_hidden: hidden })
}

export async function moderateCommentRecord(commentType: 'post' | 'community', commentId: string, action: 'hide' | 'restore' | 'delete') {
  return supabase.rpc('moderate_comment_record', { p_comment_type: commentType, p_comment_id: commentId, p_action: action })
}

export async function fetchContentReports() {
  return supabase.from('content_reports').select('*, reporter:users!content_reports_reporter_id_fkey(username, avatar)').order('created_at', { ascending: false })
}

export async function updateContentReport(id: string, status: 'reviewing' | 'resolved' | 'dismissed') {
  return supabase.from('content_reports').update({ status, resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null }).eq('id', id)
}

export async function uploadAvatar(file: File, userId: string): Promise<{ url: string; publicId: string }> {
  void userId
  const result = await uploadImageToCloudinary(file, 'football-stories/avatars')
  return { url: result.secure_url, publicId: result.public_id }
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
