import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchPosts, fetchTaxonomies, recordUserActivity } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import PostCard, { PostCardSkeleton } from '@/components/PostCard'
import Reveal from '@/components/Reveal'
import { useDebounce } from '@/hooks/useDebounce'
import { clearSearchHistory, getReadingHistory, getSearchHistory, removeSearchHistory, saveSearchHistory } from '@/utils/history'
import { Search, X, Clock3, History, ArrowLeft, ArrowRight, TrendingUp } from 'lucide-react'
import type { PostWithDetails } from '@/types/database'

const PAGE_SIZE = 9
const POPULAR_SEARCHES = ['Bóng đá Việt Nam', 'Chiến thuật', 'World Cup', 'Premier League', 'Huyền thoại sân cỏ']

export default function SearchPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [input, setInput] = useState(searchParams.get('q') ?? '')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [history, setHistory] = useState<string[]>(() => getSearchHistory())
  const [recentReads] = useState(() => getReadingHistory())
  const [leagueId, setLeagueId] = useState(searchParams.get('league') ?? '')
  const [clubId, setClubId] = useState(searchParams.get('club') ?? '')
  const [playerId, setPlayerId] = useState(searchParams.get('player') ?? '')
  const [seasonId, setSeasonId] = useState(searchParams.get('season') ?? '')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'popular'>((searchParams.get('sort') as 'newest' | 'oldest' | 'popular') ?? 'newest')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const query = useDebounce(input.trim(), 400)

  const suggestions = useMemo(() => {
    const normalized = input.trim().toLocaleLowerCase('vi')
    const pool = [...new Set([...history, ...POPULAR_SEARCHES])]
    return pool.filter(term => !normalized || term.toLocaleLowerCase('vi').includes(normalized)).slice(0, 6)
  }, [history, input])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) setSearchFocused(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    const next: Record<string, string> = {}
    if (query) next.q = query
    if (page > 1) next.page = String(page)
    if (leagueId) next.league = leagueId
    if (clubId) next.club = clubId
    if (playerId) next.player = playerId
    if (seasonId) next.season = seasonId
    if (sort !== 'newest') next.sort = sort
    setSearchParams(next, { replace: true })
  }, [query, page, leagueId, clubId, playerId, seasonId, sort, setSearchParams])

  useEffect(() => {
    if (query.length < 2) return
    const timer = window.setTimeout(() => {
      saveSearchHistory(query)
      setHistory(getSearchHistory())
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!user?.id || query.length < 2) return
    void recordUserActivity(user.id, 'search', null, null, { query })
  }, [query, user?.id])

  const { data: taxonomies } = useQuery({
    queryKey: ['taxonomies'],
    queryFn: fetchTaxonomies,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', query, page, leagueId, clubId, playerId, seasonId, sort],
    queryFn: () => fetchPosts({
      page,
      limit: PAGE_SIZE,
      search: query.length >= 2 ? query : undefined,
      leagueId,
      clubId,
      playerId,
      seasonId,
      sort,
    }),
    placeholderData: previous => previous,
  })

  const posts = (data?.data ?? []) as unknown as PostWithDetails[]
  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const selectHistory = (term: string) => {
    setInput(term)
    setPage(1)
    setSearchFocused(false)
  }

  const removeHistoryItem = (term: string) => {
    removeSearchHistory(term)
    setHistory(getSearchHistory())
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      <Reveal className="search-page-header">
        <header className="max-w-3xl mb-10">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] mb-3" style={{ color: 'var(--accent)' }}>Kho lưu trữ</p>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-[-.035em] leading-[.88] mb-6" style={{ fontFamily: 'var(--font-family-display)' }}>
            Tìm câu chuyện bạn quan tâm
          </h1>
          <div ref={searchBoxRef} className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={input}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={event => { if (event.key === 'Escape') setSearchFocused(false) }}
              onChange={event => { setInput(event.target.value); setPage(1); setSearchFocused(true) }}
              placeholder="Tìm cầu thủ, câu lạc bộ, chiến thuật..."
              aria-label="Tìm kiếm bài viết"
              className="input pl-12 pr-12 h-14 text-base"
            />
            {input && (
              <button type="button" onClick={() => setInput('')} aria-label="Xóa nội dung tìm kiếm" className="btn-ghost absolute right-2 top-1/2 -translate-y-1/2 p-2">
                <X size={17} />
              </button>
            )}
            {searchFocused && suggestions.length > 0 && (
              <div className="search-suggestions-panel" role="listbox" aria-label="Gợi ý tìm kiếm nhanh">
                <p className="search-suggestions-label">{input.trim() ? 'Gợi ý phù hợp' : 'Tìm nhanh'}</p>
                {suggestions.map(term => {
                  const fromHistory = history.some(item => item.toLocaleLowerCase('vi') === term.toLocaleLowerCase('vi'))
                  return (
                    <button key={term} type="button" role="option" className="search-suggestion-row" onMouseDown={event => event.preventDefault()} onClick={() => selectHistory(term)}>
                      {fromHistory ? <History size={15} /> : <TrendingUp size={15} />}
                      <span>{term}</span>
                      <ArrowRight size={14} className="ml-auto" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Kết quả tự động cập nhật sau khi bạn ngừng nhập.
          </p>
        </header>
      </Reveal>

      <Reveal className="search-filter-panel">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.12em]" style={{ color: 'var(--accent)' }}>Bộ lọc chi tiết</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Thu hẹp kết quả theo dữ liệu bóng đá.</p>
        </div>
        {([
          ['Giải đấu', leagueId, setLeagueId, taxonomies?.leagues ?? []],
          ['Câu lạc bộ', clubId, setClubId, taxonomies?.clubs ?? []],
          ['Cầu thủ', playerId, setPlayerId, taxonomies?.players ?? []],
          ['Mùa giải', seasonId, setSeasonId, taxonomies?.seasons ?? []],
        ] as const).map(([label, value, setter, options]) => (
          <label key={label} className="text-xs">
            <span className="block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <select value={value} onChange={event => { setter(event.target.value); setPage(1) }} className="input text-sm">
              <option value="">Tất cả</option>
              {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
        ))}
        <label className="text-xs">
          <span className="block mb-1" style={{ color: 'var(--text-muted)' }}>Sắp xếp</span>
          <select value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(1) }} className="input text-sm">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="popular">Đọc nhiều nhất</option>
          </select>
        </label>
        {(leagueId || clubId || playerId || seasonId || sort !== 'newest') && (
          <button type="button" className="btn-ghost text-xs self-end" onClick={() => {
            setLeagueId(''); setClubId(''); setPlayerId(''); setSeasonId(''); setSort('newest'); setPage(1)
          }}>Xóa bộ lọc</button>
        )}
      </Reveal>

      {!query && history.length > 0 && (
        <Reveal className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><History size={17} /> Tìm kiếm gần đây</h2>
            <button type="button" className="btn-ghost text-xs" onClick={() => { clearSearchHistory(); setHistory([]) }}>Xóa lịch sử</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map(term => (
              <span key={term} className="search-history-chip">
                <button type="button" onClick={() => selectHistory(term)}>{term}</button>
                <button type="button" onClick={() => removeHistoryItem(term)} aria-label={`Xóa ${term} khỏi lịch sử`}><X size={12} /></button>
              </span>
            ))}
          </div>
        </Reveal>
      )}

      {!query && (
        <Reveal className="mb-12">
          <h2 className="font-bold flex items-center gap-2 mb-3"><TrendingUp size={17} /> Chủ đề được quan tâm</h2>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map(term => (
              <button key={term} type="button" className="badge search-suggestion" onClick={() => selectHistory(term)}>{term}</button>
            ))}
          </div>
        </Reveal>
      )}

      {!query && recentReads.length > 0 && (
        <Reveal className="mb-12">
          <h2 className="section-heading text-3xl"><Clock3 size={21} /> Vừa đọc gần đây</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentReads.slice(0, 4).map(item => (
              <Link key={item.id} to={`/posts/${item.slug}`} className="group border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                {item.cover_image && <img src={item.cover_image} alt={item.title} loading="lazy" decoding="async" className="w-full aspect-[16/9] object-cover rounded-lg mb-3" />}
                <p className="font-bold text-sm leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">{item.title}</p>
              </Link>
            ))}
          </div>
        </Reveal>
      )}

      <section aria-busy={isFetching}>
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="section-heading mb-1">{query ? 'Kết quả tìm kiếm' : 'Bài viết mới nhất'}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {query ? `${total} bài viết phù hợp với “${query}”` : `${total} bài viết trong kho`}
            </p>
          </div>
          {isFetching && !isLoading && <span className="text-xs" style={{ color: 'var(--accent)' }}>Đang cập nhật...</span>}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => <PostCardSkeleton key={index} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 border-y text-center" style={{ borderColor: 'var(--border-color)' }}>
            <Search size={36} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p className="text-lg font-bold">Chưa tìm thấy bài viết phù hợp</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Hãy thử từ khóa ngắn hơn hoặc tìm theo tên cầu thủ, đội bóng.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-9">
            {posts.map((post, index) => <Reveal key={post.id} delay={(index % 3) * 70}><PostCard post={post} /></Reveal>)}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-12" aria-label="Phân trang">
            <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1} className="pagination-button" aria-label="Trang trước"><ArrowLeft size={16} /></button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).filter(value => value === 1 || value === totalPages || Math.abs(value - page) <= 1).map(value => (
              <button key={value} onClick={() => setPage(value)} className={`pagination-button ${page === value ? 'active' : ''}`} aria-current={page === value ? 'page' : undefined}>{value}</button>
            ))}
            <button onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="pagination-button" aria-label="Trang sau"><ArrowRight size={16} /></button>
          </nav>
        )}
      </section>
    </div>
  )
}
