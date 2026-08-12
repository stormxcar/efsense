import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Clock, Eye, MessageCircle, Heart, Flame, Sparkles } from 'lucide-react'
import type { PostWithDetails } from '@/types/database'
import { formatDate, readingTime, cn, SERIES_COLORS, SERIES_ICONS, formatNumber } from '@/utils'
import { fetchPostBySlug } from '@/services/api'
import Tooltip from './Tooltip'

interface Props {
  post: PostWithDetails
  variant?: 'default' | 'featured' | 'compact'
}

/** Returns true if post was published within 24 hours */
function isNew(post: PostWithDetails): boolean {
  const date = post.published_at ?? post.created_at
  if (!date) return false
  return Date.now() - new Date(date).getTime() < 24 * 60 * 60 * 1000
}

/** Returns true if post is considered HOT */
function isHot(post: PostWithDetails): boolean {
  return (post.likes_count ?? 0) >= 20 || post.view_count >= 500
}

export default function PostCard({ post, variant = 'default' }: Props) {
  const queryClient = useQueryClient()
  const seriesSlug = post.series?.slug ?? ''
  const badgeClass = SERIES_COLORS[seriesSlug] ?? 'badge-blue'
  const seriesIcon = SERIES_ICONS[seriesSlug] ?? ''
  const prefetchPost = () => {
    void queryClient.prefetchQuery({
      queryKey: ['post', post.slug],
      queryFn: async () => {
        const result = await fetchPostBySlug(post.slug, false)
        if (result.error) throw result.error
        return result.data
      },
      staleTime: 60_000,
    })
  }
  const intentProps = {
    onMouseEnter: prefetchPost,
    onFocus: prefetchPost,
    onTouchStart: prefetchPost,
  }

  if (variant === 'compact') {
    return (
      <Link to={`/posts/${post.slug}`} {...intentProps} className="flex items-start gap-3 p-3 rounded-lg transition-all group hover:bg-[var(--bg-hover)]">
        {post.cover_image && (
          <div className="relative shrink-0">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-16 h-16 rounded-lg object-cover"
              loading="lazy"
              decoding="async"
            />
            {isNew(post) && !isHot(post) && (
              <span className="absolute -top-1 -right-1 text-[.5rem] font-black px-1 py-0.5 rounded-sm" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', lineHeight: 1 }}>MỚI</span>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
            {post.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {post.published_at ? formatDate(post.published_at) : formatDate(post.created_at)}
            </p>
            <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Eye size={10} /> {formatNumber(post.view_count)}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  if (variant === 'featured') {
    return (
      <Link to={`/posts/${post.slug}`} {...intentProps} className="card group overflow-hidden relative grid md:grid-cols-[1.25fr_.75fr] min-h-80">
        <div className="overflow-hidden relative">
          {post.cover_image ? (
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover min-h-56 transition-transform duration-500 group-hover:scale-105"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full min-h-56 flex items-center justify-center text-6xl font-black"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--font-family-display)' }}>
              FS
            </div>
          )}
        </div>
        <div className="p-6 md:p-8 flex flex-col">
          <span className="text-xs font-extrabold uppercase tracking-[.14em] mb-5" style={{ color: 'var(--accent)' }}>Bài viết nổi bật</span>
          {post.series && (
            <span className={cn('badge text-xs self-start mb-3', badgeClass)}>
              {seriesIcon} {post.series.name}
            </span>
          )}
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold uppercase leading-[.95] tracking-tight mb-4 group-hover:text-[var(--accent)] transition-colors line-clamp-3" style={{ fontFamily: 'var(--font-family-display)' }}>
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="text-sm line-clamp-3 mb-4" style={{ color: 'var(--text-secondary)' }}>{post.excerpt}</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-auto pt-6">
            <div className="flex items-center gap-2">
              <Tooltip content={post.author?.username ?? 'Ban biên tập'} placement="top">
                {post.author?.avatar ? (
                  <img src={post.author.avatar} alt={post.author.username} className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
                    {post.author?.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </Tooltip>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{post.author?.username}</span>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Tooltip content={`${formatNumber(post.view_count)} lượt xem`} placement="top">
                <span className="flex items-center gap-1"><Eye size={12} /> {formatNumber(post.view_count)}</span>
              </Tooltip>
              <Tooltip content={`${formatNumber(post.likes_count ?? 0)} lượt thích`} placement="top">
                <span className="flex items-center gap-1"><Heart size={12} /> {formatNumber(post.likes_count ?? 0)}</span>
              </Tooltip>
              <Tooltip content={`${post.comments_count ?? 0} bình luận`} placement="top">
                <span className="flex items-center gap-1"><MessageCircle size={12} /> {post.comments_count ?? 0}</span>
              </Tooltip>
              <Tooltip content={post.content ? readingTime(post.content) : '3 phút đọc'} placement="top">
                <span className="hidden md:flex items-center gap-1"><Clock size={12} /> {post.content ? readingTime(post.content) : '3 phút đọc'}</span>
              </Tooltip>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  const hot = isHot(post)
  const fresh = isNew(post)

  return (
    <Link to={`/posts/${post.slug}`} {...intentProps} className="card group overflow-hidden flex flex-col">
      <div className="overflow-hidden relative">
        {post.cover_image ? (
          <img
            src={post.cover_image}
            alt={post.title}
            className="post-card-image"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full flex items-center justify-center text-5xl font-black"
            style={{ aspectRatio: '16/10', background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--font-family-display)' }}>
            FS
          </div>
        )}
        {/* Feature badges */}
        {hot && (
          <span className="post-badge post-badge-hot" aria-label="Bài viết nổi bật">
            <Flame size={10} />
            HOT
          </span>
        )}
        {!hot && fresh && (
          <span className="post-badge post-badge-new" aria-label="Bài viết mới">
            <Sparkles size={10} />
            MỚI
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        {post.series && <span className="text-[.68rem] font-extrabold uppercase tracking-[.12em] mb-3" style={{ color: 'var(--accent)' }}>{post.series.name}</span>}
        <h3 className="font-extrabold text-xl uppercase leading-[1.02] tracking-tight mb-3 group-hover:text-[var(--accent)] transition-colors line-clamp-2" style={{ fontFamily: 'var(--font-family-display)' }}>
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm line-clamp-2 mb-3 flex-1" style={{ color: 'var(--text-secondary)' }}>{post.excerpt}</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Tooltip content={post.author?.username ?? 'Ban biên tập'} placement="top">
              {post.author?.avatar ? (
                <img src={post.author.avatar} alt={post.author.username} className="w-6 h-6 rounded-md shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
                  {post.author?.username?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
            </Tooltip>
            <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{post.author?.username ?? 'Ban biên tập'}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
            <Tooltip content={`${formatNumber(post.likes_count ?? 0)} lượt thích`} placement="top">
              <span className="flex items-center gap-1 cursor-default">
                <Heart size={11} /> {formatNumber(post.likes_count ?? 0)}
              </span>
            </Tooltip>
            <Tooltip content={`${post.comments_count ?? 0} bình luận`} placement="top">
              <span className="flex items-center gap-1 cursor-default">
                <MessageCircle size={11} /> {post.comments_count ?? 0}
              </span>
            </Tooltip>
            <Tooltip content={post.content ? readingTime(post.content) : '3 phút đọc'} placement="top">
              <span className="hidden sm:flex items-center gap-1 cursor-default">
                <Clock size={11} /> {post.content ? readingTime(post.content) : '3 phút'}
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    </Link>
  )
}

// Skeleton loader
export function PostCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className="flex items-start gap-3 p-3">
        <div className="skeleton w-16 h-16 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-full" />
          <div className="skeleton h-3 w-2/3" />
        </div>
      </div>
    )
  }
  return (
    <div className="card overflow-hidden">
      <div className="skeleton" style={{ aspectRatio: '16/9' }} />
      <div className="p-5 space-y-3">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  )
}
