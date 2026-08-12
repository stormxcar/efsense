import { ArrowLeft, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="min-h-[100dvh] grid place-items-center px-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl text-center">
        <p className="text-sm font-extrabold uppercase tracking-[.18em] mb-5" style={{ color: 'var(--accent)' }}>404 · Hết giờ</p>
        <h1 className="text-[clamp(5rem,18vw,10rem)] font-black uppercase leading-[.7] tracking-[-.05em]" style={{ fontFamily: 'var(--font-family-display)' }}>Việt vị.</h1>
        <p className="mt-8 mb-8 mx-auto max-w-[38ch]" style={{ color: 'var(--text-secondary)' }}>Trang này đã nằm ngoài đường biên. Hãy trở về trang chủ hoặc tìm trong kho bài viết.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary"><ArrowLeft size={16} /> Về trang chủ</Link>
          <Link to="/search" className="btn-secondary"><Search size={16} /> Tìm bài viết</Link>
        </div>
      </div>
    </main>
  )
}
