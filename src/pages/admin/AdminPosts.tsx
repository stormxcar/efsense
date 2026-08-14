import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { deletePost, updatePostsBulk } from '@/services/api'
import { PlusCircle, Edit2, Trash2, Eye } from 'lucide-react'
import { formatDate, formatNumber } from '@/utils'
import Tooltip from '@/components/Tooltip'
import toast from 'react-hot-toast'
import type { PostRow } from '@/types/database'
import ConfirmModal from '@/components/ConfirmModal'
import AdminListSearch from '@/components/AdminListSearch'

const PAGE_SIZE = 15

export default function AdminPosts() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'published' | 'scheduled' | 'draft'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'popular'>('newest')
  const [confirmPostId, setConfirmPostId] = useState<string | null>(null)
  const filterLabels = { all: 'Tất cả', published: 'Đã xuất bản', scheduled: 'Đã lên lịch', draft: 'Bản nháp' }
  const statusLabels = { published: 'Đã xuất bản', scheduled: 'Đã lên lịch', draft: 'Bản nháp' }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-posts', page, search, filter, sort],
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select('*, author:users!posts_author_id_fkey(username), series:series(name)', { count: 'exact' })
        .order(sort === 'popular' ? 'view_count' : 'created_at', { ascending: sort === 'oldest' })
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
  const bulkMutation = useMutation({
    mutationFn: async (action: 'published' | 'draft' | 'delete') => {
      if (!selected.length) throw new Error('Hãy chọn ít nhất một bài viết')
      if (action === 'delete') { const result = await Promise.all(selected.map(id => deletePost(id))); const error = result.find(item => item.error)?.error; if (error) throw error }
      else { const result = await updatePostsBulk(selected, action); if (result.error) throw result.error }
    },
    onSuccess: () => { setSelected([]); qc.invalidateQueries({ queryKey: ['admin-posts'] }); toast.success('Đã áp dụng thao tác hàng loạt') },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể xử lý hàng loạt'),
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
        <AdminListSearch value={search} onChange={value => { setSearch(value); setPage(1) }} placeholder="Tìm bài viết..." storageKey="football-stories-admin-posts-search" suggestions={['Pressing', 'Positional Play', 'Bóng đá Việt Nam', 'eFootball']} />
        <select value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(1) }} className="input h-9 w-auto text-sm" aria-label="Sắp xếp bài viết">
          <option value="newest">Mới cập nhật</option>
          <option value="oldest">Cũ nhất</option>
          <option value="popular">Nhiều lượt xem</option>
        </select>
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
      {selected.length > 0 && <div className="card p-3 mb-4 flex flex-wrap items-center gap-2"><span className="text-sm">Đã chọn {selected.length} bài</span><button className="btn-primary text-xs" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate('published')}>Xuất bản</button><button className="btn-secondary text-xs" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate('draft')}>Chuyển bản nháp</button><button className="btn-ghost text-xs" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate('delete')}>Xóa</button></div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {['', 'Tiêu đề', 'Tác giả', 'Chuyên đề', 'Trạng thái', 'Lượt xem', 'Ngày tạo', 'Thao tác'].map(h => (
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
              ) : (posts as Array<PostRow & { author?: { username?: string }; series?: { name?: string } }>).map(post => (
                <tr key={post.id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(post.id)} onChange={event => setSelected(current => event.target.checked ? [...current, post.id] : current.filter(id => id !== post.id))} aria-label={`Chọn ${post.title}`} /></td>
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
                      <Tooltip content="Xem phiên bản cũ" placement="top"><Link to={`/admin/posts/${post.id}/revisions`} className="btn-ghost px-2 py-1 text-xs"><span className="sr-only">Phiên bản</span>↺</Link></Tooltip>
                      <Tooltip content="Xóa bài viết" placement="top">
                        <button onClick={() => setConfirmPostId(post.id)}
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
      <ConfirmModal open={Boolean(confirmPostId)} title="Xóa bài viết?" message="Bài viết sẽ bị xóa khỏi hệ thống cùng các liên kết liên quan. Thao tác này không thể hoàn tác." confirmLabel="Xóa bài viết" loading={deleteMutation.isPending} onCancel={() => setConfirmPostId(null)} onConfirm={() => { if (confirmPostId) deleteMutation.mutate(confirmPostId, { onSettled: () => setConfirmPostId(null) }) }} />
    </div>
  )
}
