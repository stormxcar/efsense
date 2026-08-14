import { useEffect, useRef, useState } from 'react'
import { Clock3, FileText, Layers, Search, Sparkles, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

type QuickLink = { label: string; href: string; hint?: string }
type SearchItem = { id: string; title: string; hint: string; href: string; kind: 'page' | 'post' | 'series' | 'user' }

const HISTORY_KEY = 'football-stories-admin-search-history'

const kindIcons = {
  page: Sparkles,
  post: FileText,
  series: Layers,
  user: Users,
}

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

export default function AdminCommandSearch({ quickLinks }: { quickLinks: QuickLink[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [results, setResults] = useState<SearchItem[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (!open) return
    const historyTimer = window.setTimeout(() => setHistory(readHistory()), 0)
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(historyTimer)
      window.clearTimeout(focusTimer)
    }
  }, [open])

  useEffect(() => {
    const term = query.trim()
    let cancelled = false
    if (!term) {
      const resetTimer = window.setTimeout(() => {
        if (cancelled) return
        setResults([])
        setIsSearching(false)
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(resetTimer)
      }
    }
    const searchingTimer = window.setTimeout(() => setIsSearching(true), 0)
    const timer = window.setTimeout(async () => {
      const [postsResult, seriesResult, usersResult] = await Promise.all([
        supabase.from('posts').select('id,title,status').ilike('title', `%${term}%`).order('updated_at', { ascending: false }).limit(5),
        supabase.from('series').select('id,name,status').ilike('name', `%${term}%`).order('updated_at', { ascending: false }).limit(3),
        user?.role === 'admin'
          ? supabase.from('users').select('id,username,email,role').or(`username.ilike.%${term}%,email.ilike.%${term}%`).limit(3)
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      const pageResults = quickLinks
        .filter(link => `${link.label} ${link.hint ?? ''}`.toLowerCase().includes(term.toLowerCase()))
        .slice(0, 4)
        .map(link => ({ id: link.href, title: link.label, hint: link.hint ?? 'Khu vực quản trị', href: link.href, kind: 'page' as const }))
      const postResults = (postsResult.data ?? []).map(post => ({ id: post.id, title: post.title, hint: `Bài viết · ${post.status === 'published' ? 'Đã xuất bản' : post.status === 'scheduled' ? 'Đã lên lịch' : 'Bản nháp'}`, href: `/admin/posts/${post.id}/edit`, kind: 'post' as const }))
      const seriesResults = (seriesResult.data ?? []).map(series => ({ id: series.id, title: series.name, hint: `Chuyên đề · ${series.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}`, href: `/admin/series`, kind: 'series' as const }))
      const userResults = (usersResult.data ?? []).map(member => ({ id: member.id, title: member.username || member.email, hint: `Người dùng · ${member.role}`, href: `/admin/users`, kind: 'user' as const }))
      setResults([...pageResults, ...postResults, ...seriesResults, ...userResults])
      setIsSearching(false)
    }, 260)
    return () => {
      cancelled = true
      window.clearTimeout(searchingTimer)
      window.clearTimeout(timer)
    }
  }, [query, quickLinks, user?.role])

  const remember = (value: string) => {
    const next = [value, ...history.filter(item => item !== value)].slice(0, 6)
    setHistory(next)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }

  const goTo = (item: SearchItem | QuickLink) => {
    const value = 'title' in item ? item.title : item.label
    remember(value)
    setOpen(false)
    setQuery('')
    navigate(item.href)
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={`admin-sidebar-toggle ${open ? 'text-blue-400 bg-blue-500/10' : ''}`}
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Đóng tìm kiếm quản trị' : 'Mở tìm kiếm quản trị'}
        aria-expanded={open}
        title="Tìm kiếm quản trị"
      >
        {open ? <X size={18} /> : <Search size={18} />}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[120] w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-2xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
            <Search size={17} style={{ color: 'var(--text-muted)' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Escape') setOpen(false)
                if (event.key === 'Enter' && results[0]) goTo(results[0])
              }}
              placeholder="Tìm bài viết, chuyên đề, người dùng..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {isSearching && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Đang tìm...</span>}
          </div>

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-3">
            {!query.trim() ? (
              <>
                <div className="mb-4 flex items-center justify-between px-1">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}><Clock3 size={13} /> Tìm gần đây</p>
                  {history.length > 0 && <button type="button" className="text-xs text-blue-400 hover:underline" onClick={clearHistory}>Xóa lịch sử</button>}
                </div>
                {history.length > 0 ? <div className="mb-4 flex flex-wrap gap-2">{history.map(item => <button key={item} type="button" className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:border-blue-400/60" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} onClick={() => setQuery(item)}>{item}</button>)}</div> : <p className="mb-4 px-1 text-sm" style={{ color: 'var(--text-muted)' }}>Các tìm kiếm gần đây sẽ xuất hiện ở đây.</p>}
                <p className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}><Sparkles size={13} /> Gợi ý quản trị</p>
                <div className="space-y-1">{quickLinks.slice(0, 6).map(link => <button key={link.href} type="button" className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5" onClick={() => goTo(link)}><span><span className="block text-sm">{link.label}</span><span className="mt-0.5 block text-xs" style={{ color: 'var(--text-muted)' }}>{link.hint}</span></span><span className="text-xs" style={{ color: 'var(--text-muted)' }}>Mở</span></button>)}</div>
              </>
            ) : results.length > 0 ? (
              <div className="space-y-1">{results.map(item => { const Icon = kindIcons[item.kind]; return <button key={`${item.kind}-${item.id}`} type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5" onClick={() => goTo(item)}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon size={15} /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.title}</span><span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--text-muted)' }}>{item.hint}</span></span></button> })}</div>
            ) : !isSearching ? (
              <div className="px-2 py-8 text-center"><Search size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} /><p className="text-sm">Không tìm thấy mục quản trị phù hợp.</p><p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Thử tên bài viết, chuyên đề hoặc người dùng khác.</p></div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
