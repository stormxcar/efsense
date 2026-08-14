import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { hideComment, deleteComment } from '@/services/api'
import { EyeOff, Trash2, Eye } from 'lucide-react'
import { formatRelativeDate, getInitials } from '@/utils'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ConfirmModal'
import ExpandableText from '@/components/ExpandableText'

type AdminComment = {
  id: string
  content: string
  status: 'visible' | 'hidden' | 'deleted' | string
  created_at: string
  user?: { username?: string | null; avatar?: string | null } | null
  post?: { title?: string | null; slug?: string | null } | null
}

export default function AdminComments() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [confirmCommentId, setConfirmCommentId] = useState<string | null>(null)
  const filterLabels = { all: 'Tất cả', visible: 'Đang hiển thị', hidden: 'Đã ẩn' }
  const PAGE_SIZE = 20

  const { data, isLoading } = useQuery({
    queryKey: ['admin-comments', page, filter],
    queryFn: async () => {
      let query = supabase
        .from('comments')
        .select('*, user:users(username, avatar), post:posts(title, slug)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1)
      if (filter !== 'all') query = query.eq('status', filter)
      return query
    },
  })

  const comments = data?.data ?? []
  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const hideMutation = useMutation({
    mutationFn: (id: string) => hideComment(id).then(() => {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-comments'] }); toast.success('Đã ẩn bình luận') },
  })

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('comments').update({ status: 'visible' as string }).eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-comments'] }); toast.success('Đã khôi phục bình luận') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment(id).then(() => {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-comments'] }); toast.success('Đã xóa bình luận') },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Kiểm duyệt bình luận</h1>
        <div className="flex gap-2">
          {(['all', 'visible', 'hidden'] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1) }}
              className={`text-sm px-4 py-2 rounded-xl capitalize transition-all ${filter === f ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'btn-ghost'}`}>
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)
        ) : comments.map((c: AdminComment) => (
          <div key={c.id} className={`card p-5 ${c.status === 'hidden' ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-4">
              {c.user?.avatar ? (
                <img src={c.user.avatar} alt={c.user.username ?? 'Người dùng'} className="w-9 h-9 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                  {getInitials(c.user?.username ?? '?')}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{c.user?.username ?? 'Không xác định'}</span>
                  <span className={`badge text-xs ${c.status === 'visible' ? 'badge-green' : 'badge-orange'}`}>
                    {c.status === 'visible' ? 'Đang hiển thị' : 'Đã ẩn'}
                  </span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{formatRelativeDate(c.created_at)}</span>
                </div>
                <ExpandableText text={c.content} className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }} />
                {c.post && (
                  <Link to={`/posts/${c.post.slug}`}
                    className="text-xs hover:underline" style={{ color: '#60a5fa' }}>
                    Trong bài: {c.post.title}
                  </Link>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {c.status === 'visible' ? (
                  <button onClick={() => hideMutation.mutate(c.id)} className="btn-ghost p-2 text-xs" title="Ẩn bình luận">
                    <EyeOff size={14} style={{ color: '#fb923c' }} />
                  </button>
                ) : (
                  <button onClick={() => restoreMutation.mutate(c.id)} className="btn-ghost p-2 text-xs" title="Khôi phục bình luận">
                    <Eye size={14} style={{ color: '#4ade80' }} />
                  </button>
                )}
                <button onClick={() => setConfirmCommentId(c.id)}
                  className="btn-ghost p-2" style={{ color: '#f87171' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
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
      <ConfirmModal open={Boolean(confirmCommentId)} title="Xóa bình luận?" message="Bình luận sẽ bị xóa khỏi cuộc thảo luận và không thể khôi phục từ giao diện này." confirmLabel="Xóa bình luận" loading={deleteMutation.isPending} onCancel={() => setConfirmCommentId(null)} onConfirm={() => { if (confirmCommentId) deleteMutation.mutate(confirmCommentId, { onSettled: () => setConfirmCommentId(null) }) }} />
    </div>
  )
}
