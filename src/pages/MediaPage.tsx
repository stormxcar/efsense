import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Camera, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import Reveal from '@/components/Reveal'
import { fetchPosts } from '@/services/api'
import type { PostWithDetails } from '@/types/database'

export default function MediaPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'media'],
    queryFn: () => fetchPosts({ limit: 8 }),
  })
  const posts = (data?.data ?? []) as unknown as PostWithDetails[]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <Reveal>
        <header className="media-page-heading">
          <p className="eyebrow"><Camera size={14} /> Ảnh & Video</p>
          <h1>Những khoảnh khắc<br />không cần lời bình.</h1>
          <p>Góc nhìn giàu hình ảnh về sân cỏ, khán đài và những con người tạo nên bóng đá.</p>
        </header>
      </Reveal>

      <Reveal>
        <section className="media-video" aria-labelledby="video-title">
          <div className="media-video-copy">
            <span className="badge"><Play size={12} /> Phòng chiếu</span>
            <h2 id="video-title">Những khoảnh khắc World Cup đi cùng năm tháng</h2>
            <p>Tuyển tập chính thức từ FIFA, nhìn lại cảm xúc, bàn thắng và những biểu tượng của giải đấu lớn nhất hành tinh.</p>
            <a href="https://www.youtube.com/watch?v=jVtB706YX-E" target="_blank" rel="noreferrer" className="btn-secondary">
              Xem trên YouTube <ArrowRight size={15} />
            </a>
          </div>
          <div className="media-video-frame">
            <iframe
              src="https://www.youtube-nocookie.com/embed/jVtB706YX-E"
              title="Những khoảnh khắc FIFA World Cup kinh điển"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>
      </Reveal>

      <section className="pt-16 md:pt-24" aria-labelledby="photo-heading">
        <div className="flex items-end justify-between gap-4 mb-7">
          <h2 id="photo-heading" className="section-heading mb-0">Bóng đá qua ống kính</h2>
          <Link to="/search" className="btn-ghost">Xem tất cả <ArrowRight size={14} /></Link>
        </div>
        {isLoading ? (
          <div className="media-grid">{[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="skeleton min-h-64" />)}</div>
        ) : (
          <div className="media-grid">
            {posts.map((post, index) => (
              <Reveal key={post.id} delay={(index % 3) * 70}>
                <Link to={`/posts/${post.slug}`} className="media-tile">
                  <img src={post.cover_image ?? ''} alt="" loading="lazy" decoding="async" />
                  <div>
                    <span>{index + 1 < 10 ? `0${index + 1}` : index + 1}</span>
                    <h3>{post.title}</h3>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
