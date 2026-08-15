import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Bell, Menu, X, LogOut, User, Settings,
  BookmarkIcon, ChevronDown, Sun, Moon, BookOpen, FileText, Compass, ArrowRight
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useUnreadNotifications } from '@/hooks/useAuth'
import { useUIStore, useThemeStore } from '@/store'
import { fetchPosts, fetchSeries, signOut } from '@/services/api'
import { getInitials, cn } from '@/utils'
import NotificationDropdown from './NotificationDropdown'
import Tooltip from './Tooltip'
import toast from 'react-hot-toast'
import { useProcessing } from '@/hooks/useProcessing'
import { getSearchHistory, saveSearchHistory } from '@/utils/history'
import { useDebounce } from '@/hooks/useDebounce'

const HEADER_SEARCH_SUGGESTIONS = ['Chiến thuật', 'Bóng đá Việt Nam', 'World Cup', 'Premier League', 'eFootball']
const HEADER_SITE_SECTIONS = [
  { label: 'Cộng đồng eFootball', href: '/cong-dong', keywords: 'cộng đồng efootball reels thảo luận' },
  { label: 'Ảnh & Video', href: '/media', keywords: 'ảnh video media' },
  { label: 'Đọc nhiều tuần này', href: '/doc-nhieu-tuan-nay', keywords: 'đọc nhiều phổ biến' },
  { label: 'Dòng thời gian bóng đá', href: '/lich-su', keywords: 'lịch sử timeline dòng thời gian' },
  { label: 'Tất cả chuyên đề', href: '/series', keywords: 'chuyên đề series' },
]

export default function Header() {
  const { user, isAdmin } = useAuth()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const { theme, toggleTheme } = useThemeStore()
  const unreadCount = useUnreadNotifications(user?.id)
  const navigate = useNavigate()
  const process = useProcessing()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const searchFormRef = useRef<HTMLFormElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const headerSearchHistory = useMemo(() => searchOpen ? getSearchHistory() : [], [searchOpen])
  const debouncedHeaderSearch = useDebounce(searchQuery.trim(), 350)
  const { data: globalSearch, isFetching: globalSearchLoading } = useQuery({
    queryKey: ['header-global-search', debouncedHeaderSearch],
    queryFn: async () => {
      const [postsResult, seriesResult] = await Promise.all([
        fetchPosts({ search: debouncedHeaderSearch, limit: 4 }),
        fetchSeries('published'),
      ])
      const series = (seriesResult.data ?? []).filter(item => {
        const term = debouncedHeaderSearch.toLocaleLowerCase('vi')
        return item.name.toLocaleLowerCase('vi').includes(term) || item.description?.toLocaleLowerCase('vi').includes(term)
      }).slice(0, 3)
      return { posts: (postsResult.data ?? []).slice(0, 4), series }
    },
    enabled: searchOpen && debouncedHeaderSearch.length >= 2,
    staleTime: 60_000,
  })
  const headerSuggestions = useMemo(() => {
    const term = searchQuery.trim().toLocaleLowerCase('vi')
    return [...new Set([...headerSearchHistory, ...HEADER_SEARCH_SUGGESTIONS])]
      .filter(item => !term || item.toLocaleLowerCase('vi').includes(term))
      .slice(0, 5)
  }, [headerSearchHistory, searchQuery])
  const sectionSuggestions = useMemo(() => {
    const term = searchQuery.trim().toLocaleLowerCase('vi')
    return HEADER_SITE_SECTIONS.filter(section => !term || `${section.label} ${section.keywords}`.toLocaleLowerCase('vi').includes(term))
  }, [searchQuery])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (searchFormRef.current && !searchFormRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      saveSearchHistory(searchQuery)
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  const selectHeaderSuggestion = (term: string) => {
    saveSearchHistory(term)
    navigate(`/search?q=${encodeURIComponent(term)}`)
    setSearchOpen(false)
    setSearchQuery('')
  }

  const handleSignOut = async () => {
    await process('Đang đăng xuất...', () => signOut())
    toast.success('Đã đăng xuất')
    navigate('/')
  }

  const navLinks = [
    { href: '/', label: 'Trang chủ' },
    { href: '/search', label: 'Khám phá' },
    { href: '/media', label: 'Ảnh & Video' },
    { href: '/cong-dong', label: 'Cộng đồng eFootball' },
    { href: '/doc-nhieu-tuan-nay', label: 'Đọc nhiều' },
  ]
  const seriesLinks = [
    { href: '/series/tactical-analysis', label: 'Phân tích chiến thuật' },
    { href: '/series/football-legends', label: 'Huyền thoại sân cỏ' },
    { href: '/series/club-history', label: 'Lịch sử câu lạc bộ' },
    { href: '/series/world-cup-stories', label: 'Chuyện World Cup' },
  ]

  const isDark = theme === 'dark'

  return (
    <header className="sticky top-0 z-50"
      style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(18px)', borderBottom: '1px solid var(--border-color)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex items-center justify-between h-[68px]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0" aria-label="Trang chủ Football Stories">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xl"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)', fontFamily: 'var(--font-family-display)' }}>FS</div>
            <div className="leading-none">
              <span className="block text-[1.05rem] font-extrabold uppercase tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>Football</span>
              <span className="block text-[.66rem] font-bold uppercase tracking-[.2em]" style={{ color: 'var(--accent)' }}>Stories</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn('nav-link', location.pathname === link.href && 'active')}
              >
                {link.label}
              </Link>
            ))}
            <div className="relative group">
              <Link to="/series" className={cn('nav-link flex items-center gap-1', location.pathname.startsWith('/series') && 'active')}>
                Chuyên đề <ChevronDown size={13} />
              </Link>
              <div className="absolute left-0 top-full w-64 p-2 card opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition-all">
                <Link to="/series" className="block px-3 py-2 text-sm font-bold rounded-md hover:bg-[var(--bg-hover)]">Tất cả chuyên đề</Link>
                <Link to="/lich-su" className="block px-3 py-2 text-sm rounded-md hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-secondary)' }}>Dòng thời gian bóng đá</Link>
                <div className="my-1 border-t" style={{ borderColor: 'var(--border-color)' }} />
                {seriesLinks.map(item => <Link key={item.href} to={item.href} className="block px-3 py-2 text-sm rounded-md hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-secondary)' }}>{item.label}</Link>)}
              </div>
            </div>
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-1.5">
            {/* Search */}
            {searchOpen ? (
              <form ref={searchFormRef} onSubmit={handleSearch} className="header-search-form flex items-center gap-2 animate-fade-in-up">
                <div className="header-search-field">
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false) }}
                    placeholder="Tìm bài viết..."
                    aria-label="Tìm bài viết"
                    className="input w-48 h-9 text-sm"
                    style={{ padding: '0.4rem 0.75rem' }}
                  />
                  {(debouncedHeaderSearch.length >= 2 || headerSuggestions.length > 0 || sectionSuggestions.length > 0) && (
                    <div className="header-search-suggestions" role="listbox" aria-label="Tìm kiếm toàn website">
                      {debouncedHeaderSearch.length >= 2 ? (
                        <>
                          {globalSearchLoading && <p className="header-search-status">Đang tìm trên website...</p>}
                          {!globalSearchLoading && globalSearch?.series.length === 0 && globalSearch.posts.length === 0 && <p className="header-search-status">Chưa có kết quả phù hợp.</p>}
                          {!globalSearchLoading && globalSearch?.series.length ? <>
                            <p className="search-suggestions-label">Chuyên đề</p>
                            {globalSearch.series.map(series => <Link key={series.id} role="option" className="search-suggestion-row" to={`/series/${series.slug}`} onClick={() => setSearchOpen(false)}><BookOpen size={14} /><span>{series.name}</span><ArrowRight size={14} className="ml-auto" /></Link>)}
                          </> : null}
                          {!globalSearchLoading && globalSearch?.posts.length ? <>
                            <p className="search-suggestions-label">Bài viết</p>
                            {globalSearch.posts.map(post => <Link key={post.id} role="option" className="search-suggestion-row" to={`/posts/${post.slug}`} onClick={() => setSearchOpen(false)}><FileText size={14} /><span className="line-clamp-1">{post.title}</span><ArrowRight size={14} className="ml-auto shrink-0" /></Link>)}
                          </> : null}
                        </>
                      ) : (
                        <>
                          {sectionSuggestions.length > 0 && <>
                            <p className="search-suggestions-label">Mục trên website</p>
                            {sectionSuggestions.map(section => <Link key={section.href} role="option" className="search-suggestion-row" to={section.href} onClick={() => setSearchOpen(false)}><Compass size={14} /><span>{section.label}</span><ArrowRight size={14} className="ml-auto" /></Link>)}
                          </>}
                          <p className="search-suggestions-label">Tìm nhanh</p>
                          {headerSuggestions.map(term => <button key={term} type="button" role="option" className="search-suggestion-row" onMouseDown={e => e.preventDefault()} onClick={() => selectHeaderSuggestion(term)}><Search size={14} /><span>{term}</span><ArrowRight size={14} className="ml-auto" /></button>)}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Tooltip content="Đóng tìm kiếm" placement="bottom">
                  <button type="button" onClick={() => setSearchOpen(false)} className="btn-ghost p-2" aria-label="Đóng tìm kiếm">
                    <X size={16} />
                  </button>
                </Tooltip>
              </form>
            ) : (
              <Tooltip content="Tìm kiếm bài viết" placement="bottom">
                <button onClick={() => setSearchOpen(true)} className="btn-ghost p-2" aria-label="Mở tìm kiếm">
                  <Search size={18} />
                </button>
              </Tooltip>
            )}

            {/* Theme Toggle */}
            <Tooltip content={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} placement="bottom">
              <button
                onClick={toggleTheme}
                className="btn-ghost p-2 relative overflow-hidden"
                aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                style={{ transition: 'all 0.3s ease' }}
              >
                {isDark
                  ? <Sun size={18} className="text-yellow-400" />
                  : <Moon size={18} />
                }
              </button>
            </Tooltip>

            {/* Notifications */}
            {user && (
              <div ref={notifRef} className="relative">
                <Tooltip content={unreadCount > 0 ? `${unreadCount > 99 ? '99+' : unreadCount} thông báo chưa đọc` : 'Thông báo'} placement="bottom">
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="btn-ghost p-2 relative"
                    aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="badge-count">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                </Tooltip>
                {notifOpen && (
                  <NotificationDropdown userId={user.id} onClose={() => setNotifOpen(false)} />
                )}
              </div>
            )}

            {/* User Menu */}
            {user ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 btn-ghost px-2 py-1.5"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
                      {getInitials(user.username)}
                    </div>
                  )}
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 card py-1 animate-fade-in-up" style={{ zIndex: 100 }}>
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{user.username}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                      {isAdmin && <span className="badge badge-blue mt-1 text-xs">Quản trị viên</span>}
                    </div>
                    <Link to="/profile" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}>
                      <User size={15} /> Hồ sơ
                    </Link>
                    <Link to="/profile" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}>
                      <BookmarkIcon size={15} /> Bài viết đã lưu
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                        style={{ color: 'var(--accent)' }}>
                        <Settings size={15} /> Trang quản trị
                      </Link>
                    )}
                    <hr style={{ borderColor: 'var(--border-color)', margin: '4px 0' }} />
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-white/5"
                      style={{ color: 'var(--danger)' }}
                    >
                      <LogOut size={15} /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-primary text-sm px-4 py-2">Đăng nhập</Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <Tooltip content={sidebarOpen ? 'Đóng menu' : 'Mở menu điều hướng'} placement="bottom">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden btn-ghost p-2" aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'}>
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {sidebarOpen && (
        <div className="lg:hidden border-t animate-fade-in-up"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
          <nav className="px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn('nav-link', location.pathname === link.href && 'active')}
                onClick={() => setSidebarOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <Link to="/series" className="nav-link font-bold" onClick={() => setSidebarOpen(false)}>Tất cả chuyên đề</Link>
              <Link to="/lich-su" className="nav-link pl-6 text-sm" onClick={() => setSidebarOpen(false)}>Dòng thời gian bóng đá</Link>
              {seriesLinks.map(item => <Link key={item.href} to={item.href} className="nav-link pl-6 text-sm" onClick={() => setSidebarOpen(false)}>{item.label}</Link>)}
            </div>
            {!user && (
              <div className="mt-2 pt-2 border-t flex flex-col gap-1" style={{ borderColor: 'var(--border-color)' }}>
                <Link to="/login" className="btn-primary justify-center" onClick={() => setSidebarOpen(false)}>Đăng nhập</Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
