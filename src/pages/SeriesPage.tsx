import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSeriesBySlug, fetchPosts, toggleFollow } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import PostCard, { PostCardSkeleton } from '@/components/PostCard'
import { BookmarkIcon, ArrowLeft, ArrowRight, Rss } from 'lucide-react'
import { useState } from 'react'
import { SERIES_ICONS } from '@/utils'
import toast from 'react-hot-toast'
import type { PostWithDetails } from '@/types/database'

const PAGE_SIZE = 9

export default function SeriesPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const { data: series, isLoading: loadingSeries } = useQuery({
    queryKey: ['series', slug],
    queryFn: () => slug ? fetchSeriesBySlug(slug).then(r => r.data) : null,
    enabled: !!slug,
  })

  const { data: postsData, isLoading: loadingPosts } = useQuery({
    queryKey: ['posts', 'series', series?.id, page],
    queryFn: () => series ? fetchPosts({ seriesId: series.id, page, limit: PAGE_SIZE }) : null,
    enabled: !!series?.id,
  })

  const followKey = ['series-follow', user?.id, series?.id] as const
  const { data: isFollowing = false } = useQuery({
    queryKey: followKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('series_id')
        .eq('user_id', user!.id)
        .eq('series_id', series!.id)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
    enabled: !!user?.id && !!series?.id,
  })

  const followMutation = useMutation({
    mutationFn: async (wasFollowing: boolean) => {
      const { error } = await toggleFollow(user!.id, series!.id, wasFollowing)
      if (error) throw error
    },
    onMutate: (wasFollowing) => {
      queryClient.setQueryData(followKey, !wasFollowing)
    },
    onError: (_error, wasFollowing) => {
      queryClient.setQueryData(followKey, wasFollowing)
      toast.error('Chưa thể cập nhật theo dõi chuyên đề')
    },
    onSuccess: (_data, wasFollowing) => toast.success(wasFollowing ? 'Đã bỏ theo dõi chuyên đề' : 'Đã theo dõi chuyên đề'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: followKey }),
  })

  const posts = postsData?.data ?? []
  const totalCount = postsData?.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  if (!slug) return null
  const icon = SERIES_ICONS[slug] ?? 'FS'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/series" className="btn-ghost text-sm mb-6 inline-flex items-center gap-2">
        <ArrowLeft size={15} /> Tất cả chuyên đề
      </Link>

      {loadingSeries ? (
        <div className="skeleton h-48 rounded-2xl mb-8" />
      ) : series && (
        <div className="relative rounded-xl overflow-hidden p-8 mb-10"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {series.thumbnail ? (
              <img src={series.thumbnail} alt={series.name} loading="lazy" decoding="async" className="w-24 h-24 rounded-xl object-cover" />
            ) : (
              <div className="text-6xl">{icon}</div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-family-display)' }}>{series.name}</h1>
              {series.description && (
                <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>{series.description}</p>
              )}
              <div className="flex items-center gap-4">
                <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <BookmarkIcon size={14} /> {totalCount} bài viết
                </span>
                {user && (
                  <button
                    onClick={() => followMutation.mutate(isFollowing)}
                    disabled={followMutation.isPending}
                    className={isFollowing ? 'btn-secondary text-sm px-4 py-2' : 'btn-primary text-sm px-4 py-2'}
                  >
                    <Rss size={14} /> {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 className="section-heading">Bài viết</h2>

      {loadingPosts ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <PostCardSkeleton key={i} />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <p className="text-5xl mb-4">{icon}</p>
          <p>Chuyên đề này chưa có bài viết. Hãy quay lại sau.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {(posts as unknown as PostWithDetails[]).map(post => <PostCard key={post.id} post={post} />)}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="pagination-button" aria-label="Trang trước"><ArrowLeft size={16} /></button>
              <span className="text-sm px-4" style={{ color: 'var(--text-secondary)' }}>
                Trang {page}/{totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="pagination-button" aria-label="Trang sau"><ArrowRight size={16} /></button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
