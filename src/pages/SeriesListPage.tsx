import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchSeries } from '@/services/api'
import { SERIES_COLORS, SERIES_ICONS, cn } from '@/utils'
import type { SeriesRow } from '@/types/database'
import { ArrowRight } from 'lucide-react'
import Reveal from '@/components/Reveal'

export default function SeriesListPage() {
  const { data: series = [], isLoading } = useQuery({
    queryKey: ['series', 'published'],
    queryFn: () => fetchSeries('published').then(r => r.data ?? []),
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Reveal><div className="max-w-3xl mb-12">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] mb-3" style={{ color: 'var(--accent)' }}>Đọc theo dòng sự kiện</p>
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-[-.035em] leading-[.88] mb-5" style={{ fontFamily: 'var(--font-family-display)' }}>
          Chuyên đề bóng đá
        </h1>
        <p className="text-lg max-w-xl" style={{ color: 'var(--text-secondary)' }}>
          Những tuyến bài được biên tập theo chủ đề, giúp bạn theo dõi trọn vẹn một câu chuyện.
        </p>
      </div></Reveal>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {series.map((s: SeriesRow) => {
            const icon = SERIES_ICONS[s.slug] ?? 'FS'
            const badgeClass = SERIES_COLORS[s.slug] ?? 'badge-blue'
            return (
              <Reveal key={s.id}><Link
                key={s.id}
                to={`/series/${s.slug}`}
                className="card p-8 group flex items-start gap-6"
              >
                {s.thumbnail ? (
                  <img src={s.thumbnail} alt={s.name} loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-xl bg-black/10 object-contain" />
                ) : (
                  <div className="text-5xl shrink-0 transition-transform group-hover:scale-110">{icon}</div>
                )}
                <div className="flex-1">
                  <span className={cn('badge text-xs mb-3 inline-flex', badgeClass)}>{s.name}</span>
                  <h2 className="text-xl font-bold mb-2 group-hover:text-[var(--accent)] transition-colors"
                    style={{ fontFamily: 'var(--font-family-display)' }}>
                    {s.name}
                  </h2>
                  {s.description && (
                    <p className="text-sm line-clamp-2 mb-4" style={{ color: 'var(--text-secondary)' }}>{s.description}</p>
                  )}
                  <span className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                    Đọc chuyên đề <ArrowRight size={14} />
                  </span>
                </div>
              </Link></Reveal>
            )
          })}
        </div>
      )}
    </div>
  )
}
