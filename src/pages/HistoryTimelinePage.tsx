import { useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Clock3, Landmark, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import Reveal from '@/components/Reveal'
import Magnetic from '@/components/Magnetic'
import { fetchTimelineEvents } from '@/services/api'
import type { HistoryTimelineEventWithPost } from '@/types/database'

export default function HistoryTimelinePage() {
  const [era, setEra] = useState('Tất cả')
  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['timeline-events', 'published'],
    queryFn: () => fetchTimelineEvents('published').then(result => {
      if (result.error) throw result.error
      return result.data
    }),
  })
  const eras = useMemo(() => ['Tất cả', ...new Set(events.map(item => item.era))], [events])
  const filtered = era === 'Tất cả' ? events : events.filter(item => item.era === era)

  return (
    <div className="history-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      <Reveal><header className="history-heading">
        <p className="eyebrow"><Landmark size={14} /> Dòng thời gian bóng đá</p>
        <h1>Những mốc<br /><em>không phai.</em></h1>
        <p>Một timeline tương tác để đi qua những ý tưởng, con người và trận đấu đã thay đổi lịch sử bóng đá.</p>
      </header></Reveal>

      {events.length > 0 && <Reveal delay={80}><div className="history-filters" role="tablist" aria-label="Lọc thời kỳ bóng đá">
        {eras.map(item => <button key={item} type="button" className={era === item ? 'active' : ''} onClick={() => setEra(item)}>{item}</button>)}
      </div></Reveal>}

      {isLoading ? <div className="history-timeline">{[1, 2, 3].map(item => <div key={item} className="history-event"><div className="skeleton h-6" /><div className="history-event-card history-event-skeleton"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-8 w-4/5" /><div className="skeleton h-16" /></div></div>)}</div>
        : error ? <div className="empty-state"><h2>Không thể tải timeline</h2><p>Kiểm tra kết nối rồi thử lại.</p><button className="btn-secondary" onClick={() => void refetch()}>Thử lại</button></div>
        : filtered.length === 0 ? <div className="empty-state"><h2>Timeline đang được biên tập</h2><p>Các cột mốc mới sẽ sớm được cập nhật.</p></div>
        : <section className="history-timeline" aria-label="Các cột mốc bóng đá">
          {filtered.map((item: HistoryTimelineEventWithPost, index) => <Reveal key={item.id} delay={(index % 3) * 70}>
            <article className="history-event" style={{ '--event-color': item.accent_color } as CSSProperties}>
              <div className="history-event-marker"><span>{item.year}</span></div>
              <div className="history-event-card">
                <div className="history-event-meta"><CalendarDays size={14} /> {item.era} <span><Clock3 size={13} /> {index + 1} / {filtered.length}</span></div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                {item.media_url && item.media_type === 'image' && <img src={item.media_url} alt={item.title} className="history-event-media" loading="lazy" />}
                {item.media_url && item.media_type === 'video' && <video src={item.media_url} className="history-event-media" controls playsInline preload="metadata" />}
                <Magnetic><Link to={item.post ? `/posts/${item.post.slug}` : `/search?q=${encodeURIComponent(item.era)}`} className="btn-ghost">{item.post ? 'Đọc bài liên quan' : 'Khám phá bài liên quan'} <ArrowRight size={15} /></Link></Magnetic>
              </div>
            </article>
          </Reveal>)}
        </section>}

      <Reveal><section className="history-next"><Trophy size={25} /><div><strong>Lịch sử vẫn đang được viết tiếp.</strong><span>Gửi cho chúng tôi cột mốc bạn muốn thấy trong timeline.</span></div><Link to="/cong-dong" className="btn-secondary">Tham gia cộng đồng</Link></section></Reveal>
    </div>
  )
}
