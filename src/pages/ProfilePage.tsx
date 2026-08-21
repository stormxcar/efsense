import { useState, useRef } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { markMediaAssetsReferenced, updateProfile, uploadAvatar } from '@/services/api'
import PostCard, { PostCardSkeleton } from '@/components/PostCard'
import { Camera, Bookmark, Rss, Edit2, Save, X, Heart, Clock3, ArrowRight, Eye, Sparkles, ChevronLeft, ChevronRight, LayoutDashboard, Library, Users, Settings } from 'lucide-react'
import { getInitials, formatDate, formatRelativeDate } from '@/utils'
import { getReadingHistory, type ReadingHistoryItem } from '@/utils/history'
import { cloudinaryResponsiveImageUrl } from '@/lib/cloudinary'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useProcessing } from '@/hooks/useProcessing'
import type { PostWithDetails, SeriesRow } from '@/types/database'
import { ProfileCollectionsSection, ProfileFollowingSection, ProfileOverviewSection, ProfileSettingsSection } from '@/components/profile/ProfileHub'
import { fetchProfileOverview } from '@/services/profile'

const PROFILE_PAGE_SIZE = 9

function normalizeProfilePost(value: unknown, state: { is_liked?: boolean; is_bookmarked?: boolean } = {}) {
  const post = (Array.isArray(value) ? value[0] : value) as (PostWithDetails | null | undefined)
  if (!post) return null
  return {
    ...post,
    ...state,
    likes_count: Number(post.likes?.[0]?.count ?? post.likes_count ?? 0),
    comments_count: Number(post.comments?.[0]?.count ?? post.comments_count ?? 0),
  }
}

function ProfilePagination({ page, total, loading, onChange }: { page: number; total: number; loading: boolean; onChange: (page: number) => void }) {
  const totalPages = Math.ceil(total / PROFILE_PAGE_SIZE)
  if (totalPages <= 1) return null
  return (
    <nav className="profile-pagination" aria-label="Phân trang nội dung hồ sơ">
      <button type="button" className="btn-ghost profile-pagination-button" onClick={() => onChange(page - 1)} disabled={loading || page <= 1} aria-label="Trang trước">
        <ChevronLeft size={15} />
      </button>
      <span>Trang {page} / {totalPages}</span>
      <button type="button" className="btn-ghost profile-pagination-button" onClick={() => onChange(page + 1)} disabled={loading || page >= totalPages} aria-label="Trang sau">
        <ChevronRight size={15} />
      </button>
    </nav>
  )
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const process = useProcessing()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ username: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'likes' | 'follows'>('bookmarks')
  const [profileSection, setProfileSection] = useState<'overview' | 'library' | 'following' | 'settings'>('overview')
  const [collectionPage, setCollectionPage] = useState(1)
  const [recentReads, setRecentReads] = useState<ReadingHistoryItem[]>(() => getReadingHistory())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isLoading && !user) navigate('/login')
    if (user) setForm({ username: user.username, bio: user.bio ?? '' })
  }, [user, isLoading, navigate])

  useEffect(() => () => {
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  useEffect(() => {
    const syncRecentReads = () => setRecentReads(getReadingHistory())
    window.addEventListener('football-stories:reading-history-changed', syncRecentReads)
    return () => window.removeEventListener('football-stories:reading-history-changed', syncRecentReads)
  }, [])

  const { data: bookmarksResult, isLoading: bookmarksLoading, isFetching: bookmarksFetching } = useQuery({
    queryKey: ['bookmarks', user?.id, collectionPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('post:posts(*, author:users!posts_author_id_fkey(username, avatar), series:series(name, slug), likes(count), comments(count))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range((collectionPage - 1) * PROFILE_PAGE_SIZE, collectionPage * PROFILE_PAGE_SIZE - 1)
      if (error) throw error
      const { count, error: countError } = await supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', user!.id)
      if (countError) throw countError
      return { items: data?.map(b => normalizeProfilePost(b.post, { is_bookmarked: true })).filter(Boolean) ?? [], total: count ?? 0 }
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  })

  const { data: followedResult, isLoading: followedLoading, isFetching: followedFetching } = useQuery({
    queryKey: ['follows', user?.id, collectionPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('series:series(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range((collectionPage - 1) * PROFILE_PAGE_SIZE, collectionPage * PROFILE_PAGE_SIZE - 1)
      if (error) throw error
      const { count, error: countError } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('user_id', user!.id)
      if (countError) throw countError
      return { items: data?.map(f => f.series) ?? [], total: count ?? 0 }
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  })

  const { data: likedPostsResult, isLoading: likedPostsLoading, isFetching: likedPostsFetching } = useQuery({
    queryKey: ['liked-posts', user?.id, collectionPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('likes')
        .select('post:posts(*, author:users!posts_author_id_fkey(username, avatar), series:series(name, slug), likes(count), comments(count))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range((collectionPage - 1) * PROFILE_PAGE_SIZE, collectionPage * PROFILE_PAGE_SIZE - 1)
      if (error) throw error
      const { count, error: countError } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id)
      if (countError) throw countError
      return { items: data?.map(item => normalizeProfilePost(item.post, { is_liked: true })).filter(Boolean) ?? [], total: count ?? 0 }
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  })

  const bookmarks = bookmarksResult?.items ?? []
  const bookmarksTotal = bookmarksResult?.total ?? 0
  const followed = followedResult?.items ?? []
  const followedTotal = followedResult?.total ?? 0
  const likedPosts = likedPostsResult?.items ?? []
  const likedPostsTotal = likedPostsResult?.total ?? 0

  const { data: profileOverview } = useQuery({
    queryKey: ['profile-overview', user?.id],
    queryFn: fetchProfileOverview,
    enabled: !!user,
  })

  const { data: communitySocialCounts } = useQuery({
    queryKey: ['profile-community-social-counts', user?.id],
    queryFn: async () => {
      const results = await Promise.all([
        supabase.from('community_post_bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('community_post_likes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('community_user_relations').select('*', { count: 'exact', head: true }).eq('follower_id', user!.id).eq('relation_type', 'follow'),
        supabase.from('community_tag_follows').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
      ])
      const failed = results.find(result => result.error)
      if (failed?.error) throw failed.error
      return {
        bookmarks: results[0].count ?? 0,
        likes: results[1].count ?? 0,
        users: results[2].count ?? 0,
        tags: results[3].count ?? 0,
      }
    },
    enabled: !!user,
  })

  const savedTotal = bookmarksTotal + (communitySocialCounts?.bookmarks ?? 0)
  const followingTotal = followedTotal + (communitySocialCounts?.users ?? 0) + (communitySocialCounts?.tags ?? 0)
  const favoritesTotal = likedPostsTotal + (communitySocialCounts?.likes ?? 0)
  const readTotal = Math.max(profileOverview?.articles_read ?? 0, recentReads.length)
  const activeTabLoading = activeTab === 'bookmarks' ? bookmarksLoading : activeTab === 'likes' ? likedPostsLoading : followedLoading
  const activeTabFetching = activeTab === 'bookmarks' ? bookmarksFetching : activeTab === 'likes' ? likedPostsFetching : followedFetching

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    try {
      await process('Đang cập nhật ảnh đại diện...', async () => {
        const uploaded = await uploadAvatar(file, user.id)
        const { error } = await updateProfile(user.id, { avatar: uploaded.url })
        if (error) throw error
        await markMediaAssetsReferenced([uploaded.publicId], 'user_avatar', user.id)
      })
      qc.invalidateQueries({ queryKey: ['user'] })
      toast.success('Đã cập nhật ảnh đại diện')
    } catch {
      toast.error('Không thể cập nhật ảnh đại diện')
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await process('Đang lưu thay đổi hồ sơ...', () => updateProfile(user.id, { username: form.username, bio: form.bio }))
      if (error) { toast.error(error.message); return }
      toast.success('Đã cập nhật hồ sơ')
      setEditing(false)
      qc.invalidateQueries()
    } catch {
      toast.error('Kết nối bị gián đoạn. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Profile Header */}
      <div className="card p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative">
            {avatarPreview || user.avatar ? (
              <img src={avatarPreview || user.avatar || undefined} alt={user.username} className="w-24 h-24 rounded-2xl object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-2xl font-bold"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                {getInitials(user.username)}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#3b82f6', color: 'white' }}
            >
              <Camera size={14} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="input text-lg font-bold" placeholder="Username" />
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  className="input resize-none text-sm" rows={2} placeholder="Bio (optional)" maxLength={200} />
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-4 py-2">
                    <Save size={14} /> Lưu
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-ghost text-sm px-3 py-2">
                    <X size={14} /> Hủy
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>{user.username}</h1>
                  <span className={`badge ${user.role === 'admin' ? 'badge-blue' : 'badge-green'} text-xs`}>{user.role}</span>
                  <button onClick={() => setEditing(true)} className="btn-ghost p-1.5 ml-auto">
                    <Edit2 size={15} />
                  </button>
                </div>
                <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                {user.bio && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user.bio}</p>}
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                  Tham gia {formatDate(user.created_at)}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 mt-6 pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-center">
            <p className="text-xl font-bold">{savedTotal}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Đã lưu</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{followingTotal}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Đang theo dõi</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{favoritesTotal}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Yêu thích</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{readTotal}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Đã đọc</p>
          </div>
        </div>
      </div>

      <nav className="profile-hub-nav" aria-label="Điều hướng hồ sơ">
        {([
          { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
          { id: 'library', label: 'Thư viện', icon: Library },
          { id: 'following', label: 'Đang theo dõi', icon: Users },
          { id: 'settings', label: 'Cài đặt', icon: Settings },
        ] as const).map(item => {
          const Icon = item.icon
          return <button key={item.id} type="button" className={profileSection === item.id ? 'active' : ''} onClick={() => setProfileSection(item.id)}><Icon size={16} />{item.label}</button>
        })}
      </nav>

      {profileSection === 'overview' && <ProfileOverviewSection userId={user.id} />}

      {profileSection === 'library' && <>
      <section className="profile-reading-section mb-8" aria-labelledby="profile-reading-heading">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="eyebrow"><Clock3 size={14} /> Dấu chân đọc</p>
            <h2 id="profile-reading-heading" className="section-heading mb-1">Những câu chuyện bạn vừa mở.</h2>
          </div>
          <Link to="/search" className="btn-ghost hidden sm:inline-flex">Khám phá thêm <ArrowRight size={14} /></Link>
        </div>
        {recentReads.length > 0 ? (
          <div className="profile-reading-grid">
            {recentReads.slice(0, 4).map(item => (
              <Link key={item.id} to={`/posts/${item.slug}`} className="profile-reading-item group">
                {item.cover_image ? <img src={cloudinaryResponsiveImageUrl(item.cover_image, 480)} alt={item.title} loading="lazy" decoding="async" /> : <div className="profile-reading-placeholder">FS</div>}
                <div className="profile-reading-copy">
                  <h3 className="line-clamp-2 group-hover:text-[var(--accent)] transition-colors">{item.title}</h3>
                  <span><Eye size={12} /> Đã mở {formatRelativeDate(item.visited_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="profile-reading-empty"><Sparkles size={18} /><span>Bạn chưa mở bài viết nào gần đây.</span><Link to="/search">Tìm một câu chuyện <ArrowRight size={13} /></Link></div>
        )}
      </section>

      <ProfileCollectionsSection userId={user.id} bookmarks={bookmarks as PostWithDetails[]} />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mt-10 mb-6">
        {(['bookmarks', 'likes', 'follows'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setCollectionPage(1) }}
            className={`text-sm px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === tab ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'btn-ghost'
            }`}
          >
            {tab === 'bookmarks'
              ? <><Bookmark size={14} className="inline mr-1" /> Bài viết đã lưu</>
              : tab === 'likes'
                ? <><Heart size={14} className="inline mr-1" /> Bài viết yêu thích</>
                : <><Rss size={14} className="inline mr-1" /> Chuyên đề đang theo dõi</>}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'bookmarks' && (
        activeTabLoading ? (
          <div className="profile-post-grid">{[1, 2, 3, 4, 5, 6].map(item => <PostCardSkeleton key={item} />)}</div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p className="text-4xl mb-3">🔖</p>
            <p>Chưa có bài viết đã lưu. Hãy lưu lại để đọc sau.</p>
          </div>
        ) : (
          <>
          <div className="profile-post-grid">
            {(bookmarks as unknown as Array<PostWithDetails | null>).map(post => post && <PostCard key={post.id} post={post} />)}
          </div>
          <ProfilePagination page={collectionPage} total={bookmarksTotal} loading={activeTabFetching} onChange={setCollectionPage} />
          </>
        )
      )}

      {activeTab === 'likes' && (
        activeTabLoading ? (
          <div className="profile-post-grid">{[1, 2, 3, 4, 5, 6].map(item => <PostCardSkeleton key={item} />)}</div>
        ) : likedPosts.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <Heart size={36} className="mx-auto mb-3" />
            <p>Bạn chưa yêu thích bài viết nào.</p>
          </div>
        ) : (
          <>
          <div className="profile-post-grid">
            {(likedPosts as unknown as Array<PostWithDetails | null>).map(post => post && <PostCard key={post.id} post={post} />)}
          </div>
          <ProfilePagination page={collectionPage} total={likedPostsTotal} loading={activeTabFetching} onChange={setCollectionPage} />
          </>
        )
      )}

      {activeTab === 'follows' && (
        activeTabLoading ? (
          <div className="profile-post-grid">{[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="card p-5 h-24 skeleton" />)}</div>
        ) : followed.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p className="text-4xl mb-3">📚</p>
            <p>Bạn chưa theo dõi chuyên đề nào.</p>
          </div>
        ) : (
          <>
          <div className="profile-post-grid">
            {(followed as unknown as Array<SeriesRow | null>).map(series => series && (
              <Link key={series.id} to={`/series/${series.slug}`}
                className="card p-5 flex items-center gap-4 hover:border-blue-500/30">
                <span className="text-3xl">{({ 'tactical-analysis': '🎯', 'football-legends': '⭐', 'club-history': '🏛️', 'world-cup-stories': '🏆' } as Record<string, string>)[series.slug] ?? '📰'}</span>
                <div>
                  <p className="font-semibold">{series.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{series.description}</p>
                </div>
              </Link>
            ))}
          </div>
          <ProfilePagination page={collectionPage} total={followedTotal} loading={activeTabFetching} onChange={setCollectionPage} />
          </>
        )
      )}
      </>}

      {profileSection === 'following' && <ProfileFollowingSection userId={user.id} />}
      {profileSection === 'settings' && <ProfileSettingsSection userId={user.id} />}
    </div>
  )
}
