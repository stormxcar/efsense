import { Link } from 'react-router-dom'

const items = [
  ['Phân tích chiến thuật', '/series/tactical-analysis'],
  ['Huyền thoại sân cỏ', '/series/football-legends'],
  ['Chuyện World Cup', '/series/world-cup-stories'],
  ['Lịch sử câu lạc bộ', '/series/club-history'],
  ['Kho bài viết mới', '/search'],
] as const

function TickerItems({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="news-ticker-track" aria-hidden={hidden || undefined}>
      {items.map(([label, href]) => (
        <Link key={`${label}-${hidden}`} to={href} tabIndex={hidden ? -1 : undefined}>
          <span>Đọc tiếp</span>{label}
        </Link>
      ))}
    </div>
  )
}

export default function NewsTicker() {
  return (
    <nav className="news-ticker" aria-label="Chuyên mục nổi bật">
      <div className="news-ticker-label">Trên sân cỏ</div>
      <div className="news-ticker-window">
        <div className="news-ticker-motion">
          <TickerItems />
          <TickerItems hidden />
        </div>
      </div>
    </nav>
  )
}
