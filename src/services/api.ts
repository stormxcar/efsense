import { supabase } from '@/lib/supabase'
import { uploadImageToCloudinary } from '@/lib/cloudinary'
import type { UserRow } from '@/types/database'

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
      *,
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
    (postData as any).published_at = new Date().toISOString()
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

export async function updateUserRole(id: string, role: 'admin' | 'user') {
  return supabase.from('users').update({ role }).eq('id', id)
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
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
