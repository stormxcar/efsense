import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPostRevisions, restorePostRevision } from '@/services/api'
import { ArrowLeft, RotateCcw, History } from 'lucide-react'
import { formatRelativeDate } from '@/utils'
import { useProcessing } from '@/hooks/useProcessing'
import toast from 'react-hot-toast'

type Revision = { id: string; post_id: string; version: number; title: string; slug: string; excerpt: string | null; content: string | null; cover_image: string | null; status: string; created_at: string }

export default function AdminPostRevisions() {
  const { id = '' } = useParams<{ id: string }>(); const qc = useQueryClient(); const process = useProcessing()
  const { data = [], isLoading } = useQuery({ queryKey: ['post-revisions', id], enabled: Boolean(id), queryFn: () => fetchPostRevisions(id).then(result => (result.data ?? []) as Revision[]) })
  const mutation = useMutation({ mutationFn: (revision: Revision) => process('Đang khôi phục phiên bản bài viết…', async () => { const result = await restorePostRevision(revision); if (result.error) throw result.error }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['post-revisions', id] }); qc.invalidateQueries({ queryKey: ['admin-posts'] }); toast.success('Đã khôi phục thành bản nháp mới') }, onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể khôi phục') })
  return <div className="p-8"><Link to="/admin/posts" className="btn-ghost text-sm inline-flex mb-5"><ArrowLeft size={15} /> Quay lại bài viết</Link><div className="flex items-center gap-3 mb-6"><History className="text-blue-400" /><div><h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Phiên bản bài viết</h1><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Mỗi lần cập nhật sẽ lưu một bản snapshot để có thể phục hồi.</p></div></div>{isLoading ? <div className="skeleton h-24 rounded-xl" /> : data.length === 0 ? <div className="empty-state">Chưa có phiên bản cũ.</div> : <div className="space-y-3">{data.map(revision => <div key={revision.id} className="card p-5 flex flex-wrap gap-4 items-center"><div className="w-16"><span className="badge badge-blue">v{revision.version}</span></div><div className="flex-1 min-w-60"><strong>{revision.title}</strong><p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatRelativeDate(revision.created_at)} · {revision.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</p></div><button className="btn-secondary text-xs" disabled={mutation.isPending} onClick={() => mutation.mutate(revision)}><RotateCcw size={14} /> Khôi phục bản này</button></div>)}</div>}</div>
}
