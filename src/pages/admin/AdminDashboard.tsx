import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { FileText, Users, MessageSquare, Flag, Eye, TrendingUp, PlusCircle, BarChart2, Heart, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { format, subDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import TooltipComp from '@/components/Tooltip'

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [posts, users, comments, reports, likes, shares] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('comments').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('likes').select('*', { count: 'exact', head: true }),
        supabase.from('post_shares').select('*', { count: 'exact', head: true }),
      ])
      return {
        posts: posts.count ?? 0,
        users: users.count ?? 0,
        comments: comments.count ?? 0,
        pendingReports: reports.count ?? 0,
        likes: likes.count ?? 0,
        shares: shares.count ?? 0,
      }
    },
  })

  const { data: recentPosts = [] } = useQuery({
    queryKey: ['admin-recent-posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, author:users!posts_author_id_fkey(username), series:series(name)')
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
  })

  // Chart Data Fetching
  const { data: chartData } = useQuery({
    queryKey: ['admin-charts'],
    queryFn: async () => {
      // Fetch posts from last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString()
      const { data: postsData } = await supabase
        .from('posts')
        .select('created_at, view_count')
        .gte('created_at', thirtyDaysAgo)

      const { data: seriesData } = await supabase
        .from('series')
        .select('name, posts(id)')

      // Process Line Chart (posts per day)
      const dateMap: Record<string, { posts: number; views: number }> = {}
      for (let i = 29; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'dd MMM', { locale: vi })
        dateMap[d] = { posts: 0, views: 0 }
      }
      postsData?.forEach(p => {
        const d = format(new Date(p.created_at), 'dd MMM', { locale: vi })
        if (dateMap[d]) {
          dateMap[d].posts += 1
          dateMap[d].views += p.view_count || 0
        }
      })
      const trendData = Object.keys(dateMap).map(k => ({ date: k, ...dateMap[k] }))

      // Process Bar Chart (posts per series)
      const distributionData = seriesData?.map((s: any) => ({
        name: s.name,
        posts: s.posts?.length || 0
      })).sort((a: any, b: any) => b.posts - a.posts).slice(0, 5) || []

      return { trendData, distributionData }
    }
  })

  const statCards = [
    { label: 'Tổng bài viết', value: stats?.posts ?? 0, Icon: FileText, color: '#3b82f6', href: '/admin/posts' },
    { label: 'Tổng người dùng', value: stats?.users ?? 0, Icon: Users, color: '#8b5cf6', href: '/admin/users' },
    { label: 'Bình luận', value: stats?.comments ?? 0, Icon: MessageSquare, color: '#10b981', href: '/admin/comments' },
    { label: 'Lượt thích', value: stats?.likes ?? 0, Icon: Heart, color: '#ef476f', href: '/admin/posts' },
    { label: 'Lượt chia sẻ', value: stats?.shares ?? 0, Icon: Share2, color: '#06b6d4', href: '/admin/posts' },
    { label: 'Báo cáo chờ xử lý', value: stats?.pendingReports ?? 0, Icon: Flag, color: '#f97316', href: '/admin/reports' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Tổng quan</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Theo dõi hoạt động mới nhất của Football Stories</p>
        </div>
        <Link to="/admin/posts/new" className="btn-primary">
          <PlusCircle size={16} /> Bài viết mới
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {statCards.map(({ label, value, Icon, color, href }) => (
          <TooltipComp key={label} content={`Nhấn để quản lý ${label.toLowerCase()}`} placement="bottom">
            <Link to={href} className="card p-5 hover:scale-[1.02] transition-all relative w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}20`, color }}>
                  <Icon size={20} />
                </div>
                {/* Urgent badge for pending reports */}
                {label === 'Báo cáo chờ xử lý' && value > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[.65rem] font-black animate-pulse"
                    style={{ background: '#ef4444', color: '#fff', boxShadow: '0 0 0 3px rgba(239,68,68,.2)' }}
                  >
                    {value > 99 ? '99+' : value}
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>{value}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
            </Link>
          </TooltipComp>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h2 className="font-bold mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-400" /> Xu hướng lượt xem trong 30 ngày
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData?.trendData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="views" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '12px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Line type="monotone" dataKey="views" name="Lượt xem" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-bold mb-6 flex items-center gap-2">
            <BarChart2 size={18} className="text-purple-400" /> Số bài theo chuyên đề
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData?.distributionData || []} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={12} width={100} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '12px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="posts" name="Bài viết" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold flex items-center gap-2"><TrendingUp size={18} className="text-blue-400" /> Bài viết gần đây</h2>
          <Link to="/admin/posts" className="btn-ghost text-sm">Xem tất cả</Link>
        </div>
        <div className="space-y-3">
          {recentPosts.map((post: any) => (
            <div key={post.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{post.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  bởi {post.author?.username ?? 'Quản trị viên'} · {post.series?.name ?? 'Chưa có chuyên đề'}
                </p>
              </div>
              <span className={`badge text-xs ${post.status === 'published' ? 'badge-green' : 'badge-orange'}`}>
                {post.status === 'published' ? 'Đã xuất bản' : post.status === 'scheduled' ? 'Đã lên lịch' : 'Bản nháp'}
              </span>
              <div className="flex items-center gap-1 text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                <Eye size={12} /> {post.view_count}
              </div>
              <Link to={`/admin/posts/${post.id}/edit`} className="btn-ghost text-xs px-2 py-1">Chỉnh sửa</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
