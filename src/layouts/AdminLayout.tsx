import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, FileText, Layers, Users, MessageSquare,
  Flag, ChevronLeft, Shield, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { useEffect, useState } from 'react'

export default function AdminLayout() {
  const { user, isAdmin, isLoading } = useAuth()
  const navigate = useNavigate()
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
    if (!isLoading && (!user || !isAdmin)) {
      navigate('/', { replace: true })
    }
  }, [user, isAdmin, isLoading, navigate])

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

  if (!user || !isAdmin) return null

  const navItems = [
    { to: '/admin', label: 'Tổng quan', Icon: LayoutDashboard },
    { to: '/admin/posts', label: 'Bài viết', Icon: FileText },
    { to: '/admin/series', label: 'Chuyên đề', Icon: Layers },
    { to: '/admin/users', label: 'Người dùng', Icon: Users },
    { to: '/admin/comments', label: 'Bình luận', Icon: MessageSquare },
    { to: '/admin/reports', label: 'Báo cáo', Icon: Flag },
  ]

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
          {navItems.map(({ to, label, Icon }) => (
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
        <Outlet />
      </main>
    </div>
  )
}
