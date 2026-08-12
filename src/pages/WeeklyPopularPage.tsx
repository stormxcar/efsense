import { useQuery } from '@tanstack/react-query'
import { Flame, Eye } from 'lucide-react'
import PostCard, { PostCardSkeleton } from '@/components/PostCard'
import Reveal from '@/components/Reveal'
import { fetchWeeklyPopularPosts } from '@/services/api'
import type { PostWithDetails } from '@/types/database'

export default function WeeklyPopularPage() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts', 'weekly-popular'],
    queryFn: () => fetchWeeklyPopularPosts(20).then(result => result.data as PostWithDetails[]),
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <Reveal>
        <header className="max-w-4xl mb-12 md:mb-16">
          <p className="eyebrow"><Flame size={14} /> Bảng xếp hạng 7 ngày</p>
          <h1 className="text-[clamp(4rem,10vw,8rem)] font-black uppercase tracking-[-.045em] leading-[.78] mt-4" style={{ fontFamily: 'var(--font-family-display)' }}>
            Đọc nhiều<br />tuần này.
          </h1>
          <p className="max-w-xl mt-7 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Những câu chuyện được độc giả Football Stories quan tâm nhất trong bảy ngày gần đây.
          </p>
        </header>
      </Reveal>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{[1,2,3,4,5,6].map(item => <PostCardSkeleton key={item} />)}</div>
      ) : posts.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
          {posts.map((post, index) => (
            <Reveal key={post.id} delay={(index % 3) * 70}>
              <div className="relative">
                <span className="absolute top-3 left-3 z-10 badge bg-[var(--accent)] text-[var(--accent-ink)]">
                  {String(index + 1).padStart(2, '0')} · <Eye size={11} /> {post.weekly_views}
                </span>
                <PostCard post={post} />
              </div>
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="py-20 border-y text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          Bảng xếp hạng sẽ xuất hiện sau khi có dữ liệu đọc trong tuần.
        </div>
      )}
    </div>
  )
}
