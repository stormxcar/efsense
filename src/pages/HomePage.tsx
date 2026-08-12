import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, BookOpen, ArrowRight, ArrowLeft, Clock, Eye, Hash, Play } from 'lucide-react'
import { fetchPosts, fetchSeries, fetchTags } from '@/services/api'
import PostCard, { PostCardSkeleton } from '@/components/PostCard'
import { formatNumber, SERIES_ICONS } from '@/utils'
import type { PostWithDetails, SeriesRow, TagRow } from '@/types/database'
import Reveal from '@/components/Reveal'
import NewsTicker from '@/components/NewsTicker'
import HeroTypewriter from '@/components/HeroTypewriter'

export default function HomePage() {
  const [page, setPage] = useState(1)
  const { data: featuredData, isLoading: loadingFeatured } = useQuery({
    queryKey: ['posts', 'featured'],
    queryFn: () => fetchPosts({ featured: true, limit: 1 }).then(r => r.data?.[0] ?? null),
  })
  const { data: latestData, isLoading: loadingLatest } = useQuery({
    queryKey: ['posts', 'latest', page],
    queryFn: () => fetchPosts({ page, limit: 6 }),
    placeholderData: previous => previous,
  })
  const latestPosts = latestData?.data ?? []
  const latestPages = Math.ceil((latestData?.count ?? 0) / 6)
  const { data: series = [], isLoading: loadingSeries } = useQuery({
    queryKey: ['series', 'published'],
    queryFn: () => fetchSeries('published').then(r => r.data ?? []),
  })
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => fetchTags().then(r => r.data ?? []),
  })
  const { data: popularPosts = [] } = useQuery({
    queryKey: ['posts', 'popular'],
    queryFn: () => fetchPosts({ limit: 5 }).then(r => ((r.data ?? []) as PostWithDetails[]).sort((a, b) => b.view_count - a.view_count)),
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Reveal><section className="home-hero grid lg:grid-cols-12 gap-6 items-end pt-12 md:pt-16 pb-10 border-b overflow-hidden isolate" style={{ borderColor: 'var(--border-color)' }}>
        <div className="home-hero-media" aria-hidden="true">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="https://images.unsplash.com/photo-1556816214-6d16c62fbbf6?auto=format&fit=crop&q=82&w=1800"
          >
            <source src="/spain_ngang_dung.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="lg:col-span-8 relative z-10">
          <p className="text-xs font-extrabold uppercase tracking-[.18em] mb-4" style={{ color: 'var(--accent)' }}>Tạp chí bóng đá độc lập</p>
          <h1 className="max-w-4xl text-[clamp(4rem,10vw,8.5rem)] font-black uppercase tracking-[-.045em] leading-[.76] text-balance" style={{ fontFamily: 'var(--font-family-display)' }}>
            Sau mỗi <span style={{ color: 'var(--accent)' }}>tỷ số.</span>
          </h1>
        </div>
        <div className="lg:col-span-4 lg:pb-2 relative z-10 home-hero-copy">
          <p className="text-base md:text-lg leading-relaxed mb-6 max-w-[38ch]" style={{ color: 'var(--text-secondary)' }}>
            Chiến thuật, con người và lịch sử. Những câu chuyện dành cho người yêu bóng đá muốn hiểu sâu hơn.
          </p>
          <HeroTypewriter />
          <Link to="/series" className="btn-primary">Khám phá chuyên đề <ArrowRight size={16} /></Link>
        </div>
      </section></Reveal>
      <NewsTicker />

      <Reveal><section className="py-10 md:py-14">
        <div className="flex items-end justify-between gap-4 mb-6">
          <h2 className="section-heading mb-0">Câu chuyện nổi bật</h2>
          <span className="hidden sm:block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Ban biên tập lựa chọn</span>
        </div>
        {loadingFeatured ? <div className="skeleton h-80 rounded-xl" /> : featuredData ? (
          <PostCard post={featuredData as PostWithDetails} variant="featured" />
        ) : (
          <div className="py-16 border-y text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>Bài viết nổi bật tiếp theo đang được biên tập.</div>
        )}
      </section></Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 py-6">
        <section className="lg:col-span-8">
          <div className="flex items-end justify-between mb-7">
            <h2 className="section-heading mb-0"><Clock size={22} /> Mới nhất</h2>
            <Link to="/search" className="btn-ghost">Xem kho bài viết <ArrowRight size={14} /></Link>
          </div>
          {loadingLatest ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">{[...Array(6)].map((_, i) => <PostCardSkeleton key={i} />)}</div>
          ) : latestPosts.length ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-9">{(latestPosts as PostWithDetails[]).map((post, index) => <Reveal key={post.id} delay={(index % 2) * 80}><PostCard post={post} /></Reveal>)}</div>
              {latestPages > 1 && (
                <nav className="flex justify-center gap-2 mt-10" aria-label="Phân trang bài viết mới">
                  <button className="pagination-button" disabled={page === 1} onClick={() => setPage(value => value - 1)} aria-label="Trang trước"><ArrowLeft size={16} /></button>
                  <span className="h-[2.6rem] flex items-center px-3 text-sm" style={{ color: 'var(--text-muted)' }}>Trang {page}/{latestPages}</span>
                  <button className="pagination-button" disabled={page === latestPages} onClick={() => setPage(value => value + 1)} aria-label="Trang sau"><ArrowRight size={16} /></button>
                </nav>
              )}
            </>
          ) : (
            <div className="py-16 border-y text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>Chưa có bài viết nào được xuất bản.</div>
          )}
        </section>

        <aside className="lg:col-span-4 space-y-10">
          <section className="border-t pt-5" style={{ borderColor: 'var(--accent)' }}>
            <h3 className="font-extrabold mb-4 flex items-center gap-2"><TrendingUp size={18} /> Đọc nhiều nhất</h3>
            <div>
              {popularPosts.slice(0, 5).map((post, i) => (
                <Link key={post.id} to={`/posts/${post.slug}`} className="grid grid-cols-[2rem_1fr] gap-3 py-4 border-b group" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="text-2xl font-black leading-none" style={{ color: 'var(--accent)', fontFamily: 'var(--font-family-display)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="text-sm font-bold leading-snug group-hover:text-[var(--accent)] transition-colors">{post.title}</p>
                    <span className="flex items-center gap-1 text-xs mt-2" style={{ color: 'var(--text-muted)' }}><Eye size={11} /> {formatNumber(post.view_count)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-extrabold mb-4 flex items-center gap-2"><BookOpen size={18} /> Chuyên đề</h3>
            {loadingSeries ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14" />)}</div> : (
              <div className="grid gap-2">
                {series.map((s: SeriesRow) => (
                  <Link key={s.id} to={`/series/${s.slug}`} className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[var(--bg-hover)] group">
                    <span className="text-lg" aria-hidden="true">{SERIES_ICONS[s.slug] ?? '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{s.name}</p>
                      {s.description && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{s.description}</p>}
                    </div>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {tags.length > 0 && (
            <section>
              <h3 className="font-extrabold mb-4 flex items-center gap-2"><Hash size={18} /> Chủ đề</h3>
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 12).map((tag: TagRow) => <Link key={tag.id} to={`/search?tag=${tag.slug}`} className="badge">{tag.name}</Link>)}
              </div>
            </section>
          )}
        </aside>
      </div>

      <Reveal>
        <section className="home-story-film" aria-labelledby="home-film-title">
          <div className="home-story-film-frame">
            <iframe
              src="https://www.youtube-nocookie.com/embed/jVtB706YX-E?rel=0"
              title="Những khoảnh khắc bóng đá kinh điển từ FIFA"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <div className="home-story-film-copy">
            <p className="eyebrow"><Play size={13} /> Vì sao Football Stories tồn tại</p>
            <h2 id="home-film-title">Tỷ số kết thúc.<br />Câu chuyện bắt đầu.</h2>
            <p>
              Chúng tôi đi qua tiếng còi mãn cuộc để kể về ý tưởng chiến thuật, ký ức khán đài,
              bản sắc câu lạc bộ và những con người đã làm bóng đá trở nên đáng nhớ.
            </p>
            <div className="home-story-topics" aria-label="Các chủ đề chính">
              <span>01 · Chiến thuật</span>
              <span>02 · Con người</span>
              <span>03 · Lịch sử</span>
            </div>
            <Link to="/series" className="btn-secondary">Khám phá cách chúng tôi kể chuyện <ArrowRight size={15} /></Link>
          </div>
        </section>
      </Reveal>

      {latestPosts.length > 0 && (
        <Reveal>
          <section className="home-media-preview">
            <div className="home-media-intro">
              <p className="eyebrow">Ảnh & Video</p>
              <h2>Nhịp đập sân cỏ, qua từng khung hình.</h2>
              <p>Một lát cắt thị giác về chiến thuật, lịch sử và cảm xúc phía sau trận đấu.</p>
              <Link to="/media" className="btn-primary">Vào phòng hình ảnh <ArrowRight size={15} /></Link>
            </div>
            <div className="home-media-images">
              {(latestPosts as PostWithDetails[]).slice(0, 3).map((post, index) => (
                <Link key={post.id} to={`/posts/${post.slug}`} className={`home-media-image home-media-image-${index + 1}`}>
                  <img src={post.cover_image ?? ''} alt={post.title} loading="lazy" decoding="async" />
                  <span>{post.title}</span>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  )
}
