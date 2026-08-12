import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import NewsletterForm from './NewsletterForm'

export default function Footer() {
  const series = [
    { name: 'Phân tích chiến thuật', slug: 'tactical-analysis' },
    { name: 'Huyền thoại sân cỏ', slug: 'football-legends' },
    { name: 'Lịch sử câu lạc bộ', slug: 'club-history' },
    { name: 'Chuyện World Cup', slug: 'world-cup-stories' },
  ]

  return (
    <footer className="mt-24 border-t" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand */}
          <div className="md:col-span-7">
            <Link to="/" className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)', fontFamily: 'var(--font-family-display)' }}>FS</div>
              <span className="text-2xl font-extrabold uppercase tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>Football Stories</span>
            </Link>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              Những bài viết dành cho người muốn nhìn xa hơn tỷ số: chiến thuật, nhân vật, câu lạc bộ và các khoảnh khắc làm nên bóng đá.
            </p>
            <NewsletterForm />
          </div>

          {/* Series */}
          <div className="md:col-span-3">
            <h4 className="font-semibold text-sm mb-4">Chuyên đề</h4>
            <ul className="space-y-2">
              {series.map(s => (
                <li key={s.slug}>
                  <Link to={`/series/${s.slug}`} className="text-sm transition-colors hover:text-[var(--accent)] inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    {s.name} <ArrowUpRight size={12} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div className="md:col-span-2">
            <h4 className="font-semibold text-sm mb-4">Khám phá</h4>
            <ul className="space-y-2">
              {[
                { label: 'Kho bài viết', href: '/search' },
                { label: 'Đọc nhiều tuần này', href: '/doc-nhieu-tuan-nay' },
                { label: 'Đăng nhập', href: '/login' },
                { label: 'Đăng ký', href: '/register' },
              ].map(l => (
                <li key={l.href}>
                  <Link to={l.href} className="text-sm transition-colors hover:text-[var(--accent)]" style={{ color: 'var(--text-secondary)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Football Stories. Đã đăng ký bản quyền.
          </p>
          <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Link to="/search">Kho bài viết</Link>
            <Link to="/series">Tất cả chuyên đề</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
