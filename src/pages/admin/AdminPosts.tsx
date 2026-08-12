import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { deletePost } from '@/services/api'
import { PlusCircle, Edit2, Trash2, Eye, Search, Heart, MessageCircle } from 'lucide-react'
import { formatDate, formatNumber } from '@/utils'
import Tooltip from '@/components/Tooltip'
import toast from 'react-hot-toast'

const PAGE_SIZE = 15

export default function AdminPosts() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'published' | 'scheduled' | 'draft'>('all')
  const filterLabels = { all: 'Tất cả', published: 'Đã xuất bản', scheduled: 'Đã lên lịch', draft: 'Bản nháp' }
  const statusLabels = { published: 'Đã xuất bản', scheduled: 'Đã lên lịch', draft: 'Bản nháp' }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-posts', page, search, filter],
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select('*, author:users!posts_author_id_fkey(username), series:series(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1)
      if (filter !== 'all') query = query.eq('status', filter)
      if (search) query = query.ilike('title', `%${search}%`)
      return query
    },
  })

  const posts = data?.data ?? []
  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Count drafts for badge
  const { data: draftCount } = useQuery({
    queryKey: ['admin-posts-draft-count'],
    queryFn: async () => {
      const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'draft')
      return count ?? 0
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePost(id).then(() => {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-posts'] }); toast.success('Đã xóa bài viết') },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Quản lý bài viết</h1>
        <Link to="/admin/posts/new" className="btn-primary text-sm">
          <PlusCircle size={15} /> Bài viết mới
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Tìm bài viết..." className="input pl-9 h-9 text-sm w-52" />
        </div>
        {(['all', 'published', 'scheduled', 'draft'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1) }}
            className={`text-sm px-4 py-2 rounded-xl capitalize transition-all relative ${filter === f ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'btn-ghost'}`}>
            {filterLabels[f]}
            {f === 'draft' && (draftCount ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[.6rem] font-bold" style={{ background: '#f97316', color: '#fff' }}>
                {(draftCount ?? 0) > 99 ? '99+' : draftCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {['Tiêu đề', 'Tác giả', 'Chuyên đề', 'Trạng thái', 'Lượt xem', 'Ngày tạo', 'Thao tác'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>)}
                  </tr>
                ))
              ) : posts.map((post: any) => (
                <tr key={post.id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3">
                    <p className="font-medium truncate max-w-xs">{post.title}</p>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{post.author?.username ?? '-'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{post.series?.name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${post.status === 'published' ? 'badge-green' : 'badge-orange'}`}>
                      {statusLabels[post.status as keyof typeof statusLabels] ?? post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{formatNumber(post.view_count)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(post.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Tooltip content="Xem trước bài viết" placement="top">
                        <Link to={`/admin/posts/${post.id}/preview`} target="_blank" className="btn-ghost px-2 py-1 text-xs">
                          <Eye size={13} />
                        </Link>
                      </Tooltip>
                      <Tooltip content="Chỉnh sửa bài viết" placement="top">
                        <Link to={`/admin/posts/${post.id}/edit`} className="btn-ghost px-2 py-1 text-xs">
                          <Edit2 size={13} />
                        </Link>
                      </Tooltip>
                      <Tooltip content="Xóa bài viết" placement="top">
                        <button onClick={() => { if (confirm('Bạn có chắc muốn xóa bài viết này?')) deleteMutation.mutate(post.id) }}
                          className="btn-ghost px-2 py-1 text-xs" style={{ color: '#f87171' }}>
                          <Trash2 size={13} />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-40">Trang trước</button>
          <span className="text-sm px-4" style={{ color: 'var(--text-secondary)' }}>Trang {page}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-40">Trang sau</button>
        </div>
      )}
    </div>
  )
}
