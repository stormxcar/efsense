import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, FileText, Layers, Users, MessageSquare,
  Flag, ChevronLeft, Shield, PanelLeftClose, PanelLeftOpen, History, ClipboardList, ShieldAlert, CalendarDays, HardDrive, ShieldCheck
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminCommandSearch from '@/components/AdminCommandSearch'

export default function AdminLayout() {
  const { user, isStaff, canEditContent, canModerateContent, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mfaRequired, setMfaRequired] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed')
    return saved === null ? window.matchMedia('(max-width: 767px)').matches : saved === 'true'
  })

  const toggleSidebar = () => {
    setCollapsed(current => {
      const next = !current
      localStorage.setItem('admin-sidebar-collapsed', String(next))
      return next
    })
  }

  useEffect(() => {
    if (!isLoading && (!user || !isStaff)) {
      navigate('/', { replace: true })
    }
  }, [user, isStaff, isLoading, navigate])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    const checkMfa = async () => {
      const [{ data: assurance }, { data: factors }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])
      const hasVerifiedFactor = (factors?.totp ?? []).some(factor => factor.status === 'verified')
      setMfaRequired(Boolean(hasVerifiedFactor && assurance?.currentLevel !== 'aal2'))
    }
    void checkMfa()
    const refresh = () => { void checkMfa() }
    window.addEventListener('football-stories-mfa-verified', refresh)
    return () => window.removeEventListener('football-stories-mfa-verified', refresh)
  }, [user])

  useEffect(() => {
    if (mfaRequired && location.pathname !== '/admin/security') navigate('/admin/security', { replace: true })
  }, [mfaRequired, location.pathname, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg-primary)' }}>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i}
              className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Đang xác minh quyền quản trị...</p>
      </div>
    )
  }

  if (!user || !isStaff) return null

  const navItems = [
    { to: '/admin', label: 'Tổng quan', Icon: LayoutDashboard },
    { to: '/admin/posts', label: 'Bài viết', Icon: FileText },
    { to: '/admin/series', label: 'Chuyên đề', Icon: Layers },
    ...(user.role === 'admin' ? [{ to: '/admin/users', label: 'Người dùng', Icon: Users }] : []),
    ...(user.role === 'admin' || user.role === 'moderator' ? [{ to: '/admin/comments', label: 'Bình luận', Icon: MessageSquare }, { to: '/admin/reports', label: 'Báo cáo', Icon: Flag }] : []),
    { to: '/admin/timeline', label: 'Dòng thời gian', Icon: History },
    { to: '/admin/calendar', label: 'Lịch biên tập', Icon: CalendarDays },
    { to: '/admin/media-library', label: 'Thư viện media', Icon: HardDrive },
    ...(user.role === 'admin' ? [{ to: '/admin/audit-log', label: 'Nhật ký quản trị', Icon: ClipboardList }] : []),
    ...(user.role === 'admin' || user.role === 'moderator' ? [{ to: '/admin/moderation', label: 'Hàng đợi kiểm duyệt', Icon: ShieldAlert }] : []),
    ...(user.role === 'admin' ? [{ to: '/admin/security', label: 'Bảo mật 2FA', Icon: ShieldCheck }] : []),
  ]
  const visibleNavItems = navItems.filter(item => {
    if (['/admin/posts', '/admin/series', '/admin/timeline', '/admin/calendar'].includes(item.to)) return canEditContent
    if (['/admin/comments', '/admin/reports', '/admin/moderation'].includes(item.to)) return canModerateContent
    return true
  })

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-60'} admin-sidebar shrink-0 flex flex-col border-r`}
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <div className={`${collapsed ? 'px-2' : 'px-4'} py-4 border-b`} style={{ borderColor: 'var(--border-color)' }}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
              <Shield size={17} />
            </div>
            {!collapsed && <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Trang quản trị</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Football Stories</p>
            </div>}
            {!collapsed && (
              <button type="button" onClick={toggleSidebar} className="admin-sidebar-toggle" title="Thu gọn thanh bên" aria-label="Thu gọn thanh bên">
                <PanelLeftClose size={17} />
              </button>
            )}
          </div>
          {collapsed && (
            <button type="button" onClick={toggleSidebar} className="admin-sidebar-toggle mt-3 mx-auto" title="Mở rộng thanh bên" aria-label="Mở rộng thanh bên">
              <PanelLeftOpen size={17} />
            </button>
          )}
        </div>

        <nav className={`${collapsed ? 'px-2' : 'px-3'} flex-1 py-4 space-y-1`}>
          {visibleNavItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                    : 'hover:bg-white/5'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? undefined : 'var(--text-secondary)',
              })}
              title={collapsed ? label : undefined}
              aria-label={label}
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={`${collapsed ? 'px-2' : 'px-3'} py-4 border-t space-y-1`} style={{ borderColor: 'var(--border-color)' }}>
          {!collapsed && <p className="px-3 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Đăng nhập với <strong style={{ color: 'var(--text-primary)' }}>{user?.username}</strong>
          </p>}
          <Link to="/"
            className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2 px-3'} py-2 text-sm rounded-xl hover:bg-white/5 transition-colors`}
            style={{ color: 'var(--text-secondary)' }}
            title={collapsed ? 'Về trang chính' : undefined}
            aria-label="Về trang chính">
            <ChevronLeft size={15} /> {!collapsed && 'Về trang chính'}
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <header className="sticky top-0 z-[110] flex h-16 items-center justify-between border-b px-4 md:px-6" style={{ background: 'color-mix(in srgb, var(--bg-primary) 90%, transparent)', borderColor: 'var(--border-color)', backdropFilter: 'blur(14px)' }}>
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Không gian quản trị</p>
            <p className="truncate text-sm font-semibold">Football Stories</p>
          </div>
          <div className="flex items-center gap-3">
            <AdminCommandSearch quickLinks={visibleNavItems.map(item => ({ label: item.label, href: item.to, hint: 'Khu vực quản trị' }))} />
            <span className="hidden text-xs sm:inline" style={{ color: 'var(--text-muted)' }}>{user.role === 'admin' ? 'Quản trị viên' : user.role === 'editor' ? 'Biên tập viên' : user.role === 'moderator' ? 'Kiểm duyệt viên' : 'Cộng tác viên'}</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
