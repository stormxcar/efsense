import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, Bookmark, Clock, Eye, Calendar, Tag, ArrowLeft, Search, BookOpen } from 'lucide-react'
import {
  fetchPostBySlug,
  fetchRelatedPosts,
  toggleLike,
  toggleBookmark,
  getUserInteractions,
} from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import CommentSection from '@/components/CommentSection'
import PostCard from '@/components/PostCard'
import { formatDate, readingTime, formatNumber, SERIES_COLORS, SERIES_ICONS, cn, getInitials } from '@/utils'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { saveReadingHistory } from '@/utils/history'
import SocialShare from '@/components/SocialShare'
import ReadingProgress from '@/components/ReadingProgress'
import type { PostWithDetails } from '@/types/database'
import ArticleSeo from '@/components/ArticleSeo'
import PostGallery from '@/components/PostGallery'

type PostInteractions = {
  isLiked: boolean
  isBookmarked: boolean
}

export default function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [likeAdjustment, setLikeAdjustment] = useState<{ postId: string; value: number } | null>(null)

  const findCachedPost = () => {
    const entries = queryClient.getQueriesData<unknown>({ queryKey: ['posts'] })
    for (const [, value] of entries) {
      if (!value) continue
      if (typeof value === 'object' && 'slug' in value && (value as PostWithDetails).slug === slug) {
        return value as PostWithDetails
      }
      if (typeof value === 'object' && 'data' in value) {
        const rows = (value as { data?: PostWithDetails[] }).data
        const match = rows?.find(item => item.slug === slug)
        if (match) return match
      }
    }
    return undefined
  }

  const { data: post, isLoading, isError, refetch } = useQuery({
    queryKey: ['post', slug],
    queryFn: async () => {
      if (!slug) return null
      const result = await fetchPostBySlug(slug)
      if (result.error) throw result.error
      return result.data
    },
    enabled: !!slug,
    placeholderData: findCachedPost,
    retry: 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: related = [] } = useQuery({
    queryKey: ['related', post?.id],
    queryFn: () => post ? fetchRelatedPosts(post.id, post.series_id).then(r => r.data ?? []) : [],
    enabled: !!post?.id,
  })

  const interactionKey = ['post-interactions', user?.id, post?.id] as const
  const { data: interactions } = useQuery<PostInteractions>({
    queryKey: interactionKey,
    queryFn: () => getUserInteractions(user!.id, post!.id),
    enabled: !!user?.id && !!post?.id,
  })

  useEffect(() => {
    if (!post) return
    saveReadingHistory({
      id: post.id,
      slug: post.slug,
      title: post.title,
      cover_image: post.cover_image,
    })
  }, [post])

  const likeMutation = useMutation({
    mutationFn: async (wasLiked: boolean) => {
      const { error } = await toggleLike(user!.id, post!.id, wasLiked)
      if (error) throw error
    },
    onMutate: async (wasLiked) => {
      await queryClient.cancelQueries({ queryKey: interactionKey })
      const previous = queryClient.getQueryData<PostInteractions>(interactionKey)
      queryClient.setQueryData<PostInteractions>(interactionKey, current => ({
        isLiked: !wasLiked,
        isBookmarked: current?.isBookmarked ?? false,
      }))
      setLikeAdjustment({ postId: post!.id, value: wasLiked ? -1 : 1 })
      return { previous }
    },
    onError: (_error, _wasLiked, context) => {
      queryClient.setQueryData(interactionKey, context?.previous)
      setLikeAdjustment(null)
      toast.error('Chưa thể cập nhật lượt thích')
    },
    onSuccess: (_data, wasLiked) => toast.success(wasLiked ? 'Đã bỏ yêu thích' : 'Đã thêm vào bài viết yêu thích'),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['liked-posts', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['post', slug] }),
        queryClient.invalidateQueries({ queryKey: interactionKey }),
      ])
      setLikeAdjustment(null)
    },
  })

  const bookmarkMutation = useMutation({
    mutationFn: async (wasBookmarked: boolean) => {
      const { error } = await toggleBookmark(user!.id, post!.id, wasBookmarked)
      if (error) throw error
    },
    onMutate: async (wasBookmarked) => {
      await queryClient.cancelQueries({ queryKey: interactionKey })
      const previous = queryClient.getQueryData<PostInteractions>(interactionKey)
      queryClient.setQueryData<PostInteractions>(interactionKey, current => ({
        isLiked: current?.isLiked ?? false,
        isBookmarked: !wasBookmarked,
      }))
      return { previous }
    },
    onError: (_error, _wasBookmarked, context) => {
      queryClient.setQueryData(interactionKey, context?.previous)
      toast.error('Chưa thể cập nhật danh sách đã lưu')
    },
    onSuccess: (_data, wasBookmarked) => toast.success(wasBookmarked ? 'Đã bỏ khỏi danh sách lưu' : 'Đã lưu bài viết'),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] }),
      queryClient.invalidateQueries({ queryKey: interactionKey }),
    ]),
  })

  const isLiked = interactions?.isLiked ?? false
  const isBookmarked = interactions?.isBookmarked ?? false
  const likeCount = Math.max(
    0,
    (post?.likes?.[0]?.count ?? 0) + (likeAdjustment && post && likeAdjustment.postId === post.id ? likeAdjustment.value : 0),
  )

  if (isLoading) return <PostDetailSkeleton />
  if (isError) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <Search size={42} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
      <h1 className="text-2xl font-extrabold">Chưa thể tải bài viết</h1>
      <p className="mt-2 mb-6" style={{ color: 'var(--text-muted)' }}>Kết nối dữ liệu đang chậm hoặc tạm thời bị gián đoạn.</p>
      <button type="button" onClick={() => refetch()} className="btn-primary">Thử tải lại</button>
    </div>
  )
  if (!post) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center" style={{ color: 'var(--text-muted)' }}>
      <Search size={42} className="mx-auto mb-4" />
      <p className="text-xl">Không tìm thấy bài viết</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">Về trang chủ</Link>
    </div>
  )

  const seriesSlug = (post as any).series?.slug ?? ''
  const badgeClass = SERIES_COLORS[seriesSlug] ?? 'badge-blue'
  const seriesIcon = SERIES_ICONS[seriesSlug] ?? '📰'
  const tags = (post as any).post_tags?.map((pt: any) => pt.tag) ?? []

  return (
    <>
      <ReadingProgress />
      <ArticleSeo post={post as PostWithDetails} />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link to="/" className="btn-ghost text-sm inline-flex items-center gap-2">
            <ArrowLeft size={15} /> Trang chủ
          </Link>
        </div>

        {/* Series badge */}
        {(post as any).series && (
          <Link to={`/series/${(post as any).series.slug}`}>
            <span className={cn('badge text-sm mb-4 inline-flex', badgeClass)}>
              {seriesIcon} {(post as any).series.name}
            </span>
          </Link>
        )}

        <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>{post.excerpt}</p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8 pb-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            {(post as any).author?.avatar ? (
              <img src={(post as any).author.avatar} alt={(post as any).author.username} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
                {getInitials((post as any).author?.username ?? '?')}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{(post as any).author?.username ?? 'Ban biên tập'}</p>
              {(post as any).author?.bio && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(post as any).author.bio}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><Calendar size={13} /> {post.published_at ? formatDate(post.published_at) : formatDate(post.created_at)}</span>
            <span className="flex items-center gap-1"><Clock size={13} /> {post.content ? readingTime(post.content) : '3 phút đọc'}</span>
            <span className="flex items-center gap-1"><Eye size={13} /> {formatNumber(post.view_count)} lượt xem</span>
          </div>
        </div>

        {/* Cover image */}
        {post.cover_image && (
          <div className="rounded-2xl overflow-hidden mb-10">
            <img
              src={post.cover_image}
              alt={post.image_alt || post.title}
              className="w-full object-cover max-h-[500px]"
            />
          </div>
        )}
        {(post.image_credit || post.image_source_url) && (
          <p className="text-xs -mt-7 mb-10 text-right" style={{ color: 'var(--text-muted)' }}>
            Ảnh: {post.image_source_url
              ? <a href={post.image_source_url} target="_blank" rel="noreferrer" className="hover:text-[var(--accent)]">{post.image_credit || 'Nguồn ảnh'}</a>
              : post.image_credit}
          </p>
        )}

        {/* Content rendered from Quill HTML */}
        <div
          className="ql-content prose-football mb-10"
          dangerouslySetInnerHTML={{ __html: post.content ?? '' }}
        />
        <PostGallery images={(post as PostWithDetails).post_gallery_images ?? []} />

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <Tag size={15} style={{ color: 'var(--text-muted)' }} />
            {tags.map((tag: any) => (
              <Link key={tag.id} to={`/search?tag=${tag.slug}`}>
                <span className="badge badge-blue text-xs hover:scale-105 transition-transform">#{tag.name}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 py-6 border-y mb-5" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => { if (!user) { toast.error('Vui lòng đăng nhập để thích bài viết'); return } likeMutation.mutate(isLiked) }}
            disabled={likeMutation.isPending}
            className={cn('btn-secondary gap-2 px-4 py-2', isLiked && 'text-red-400 border-red-400/30 bg-red-500/10')}
          >
            <Heart size={16} className={isLiked ? 'fill-red-400' : ''} />
            {formatNumber(likeCount)} lượt thích
          </button>
          <button
            onClick={() => { if (!user) { toast.error('Vui lòng đăng nhập để lưu bài viết'); return } bookmarkMutation.mutate(isBookmarked) }}
            disabled={bookmarkMutation.isPending}
            className={cn('btn-secondary gap-2 px-4 py-2', isBookmarked && 'text-blue-400 border-blue-400/30 bg-blue-500/10')}
          >
            <Bookmark size={16} className={isBookmarked ? 'fill-blue-400' : ''} />
            {isBookmarked ? 'Đã lưu' : 'Lưu bài'}
          </button>
        </div>
        <SocialShare
          postId={post.id}
          url={typeof window !== 'undefined' ? window.location.href : ''}
          title={post.title}
          description={post.excerpt}
        />

        {/* Comments */}
        <CommentSection postId={post.id} currentUser={user} />

        {/* Related Posts */}
        {related.length > 0 && (
          <section className="mt-16">
            <h3 className="section-heading"><BookOpen size={22} /> Cùng chuyên đề</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {related.map((rp: any) => <PostCard key={rp.id} post={rp} />)}
            </div>
          </section>
        )}
      </article>
    </>
  )
}

function PostDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="skeleton h-8 w-3/4 rounded" />
      <div className="skeleton h-6 w-full rounded" />
      <div className="skeleton h-5 w-48 rounded" />
      <div className="skeleton rounded-2xl" style={{ aspectRatio: '16/7' }} />
      <div className="space-y-3">
        {[1,2,3,4,5,6].map(i => <div key={i} className={`skeleton h-4 rounded ${i % 3 === 0 ? 'w-2/3' : 'w-full'}`} />)}
      </div>
    </div>
  )
}
