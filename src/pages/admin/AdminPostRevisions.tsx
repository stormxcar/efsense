import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPostRevisions, fetchPostSnapshot, restorePostRevision } from '@/services/api'
import { ArrowLeft, RotateCcw, History, GitCompareArrows, X } from 'lucide-react'
import { formatRelativeDate } from '@/utils'
import { useProcessing } from '@/hooks/useProcessing'
import toast from 'react-hot-toast'

type Revision = { id: string; post_id: string; version: number; title: string; slug: string; excerpt: string | null; content: string | null; cover_image: string | null; status: string; created_at: string }
type Snapshot = Pick<Revision, 'title' | 'slug' | 'excerpt' | 'content' | 'cover_image' | 'status'>

function plainText(value: string | null) {
  return (value ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function diffLines(current: string, previous: string) {
  const oldLines = current.split(/\r?\n/).filter(Boolean)
  const newLines = previous.split(/\r?\n/).filter(Boolean)
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)
  return [...oldLines.filter(line => !newSet.has(line)).map(line => ({ type: 'remove', line })), ...newLines.filter(line => !oldSet.has(line)).map(line => ({ type: 'add', line }))]
}

export default function AdminPostRevisions() {
  const { id = '' } = useParams<{ id: string }>(); const qc = useQueryClient(); const process = useProcessing()
  const { data = [], isLoading } = useQuery({ queryKey: ['post-revisions', id], enabled: Boolean(id), queryFn: () => fetchPostRevisions(id).then(result => (result.data ?? []) as Revision[]) })
  const { data: currentPost } = useQuery({ queryKey: ['admin-post-snapshot', id], enabled: Boolean(id), queryFn: () => fetchPostSnapshot(id).then(result => result.data as Snapshot | null) })
  const [compare, setCompare] = useState<Revision | null>(null)
  const mutation = useMutation({ mutationFn: (revision: Revision) => process('Đang khôi phục phiên bản bài viết…', async () => { const result = await restorePostRevision(revision); if (result.error) throw result.error }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['post-revisions', id] }); qc.invalidateQueries({ queryKey: ['admin-posts'] }); toast.success('Đã khôi phục thành bản nháp mới') }, onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể khôi phục') })
  const changes = compare && currentPost ? diffLines(plainText(currentPost.content), plainText(compare.content)) : []
  return <div className="p-8"><Link to="/admin/posts" className="btn-ghost text-sm inline-flex mb-5"><ArrowLeft size={15} /> Quay lại bài viết</Link><div className="flex items-center gap-3 mb-6"><History className="text-blue-400" /><div><h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Phiên bản bài viết</h1><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Mỗi lần cập nhật sẽ lưu một bản snapshot để có thể phục hồi.</p></div></div>{isLoading ? <div className="skeleton h-24 rounded-xl" /> : data.length === 0 ? <div className="empty-state">Chưa có phiên bản cũ.</div> : <div className="space-y-3">{data.map(revision => <div key={revision.id} className="card p-5 flex flex-wrap gap-4 items-center"><div className="w-16"><span className="badge badge-blue">v{revision.version}</span></div><div className="flex-1 min-w-60"><strong>{revision.title}</strong><p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatRelativeDate(revision.created_at)} · {revision.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</p></div><button className="btn-ghost text-xs" onClick={() => setCompare(revision)}><GitCompareArrows size={14} /> So sánh</button><button className="btn-secondary text-xs" disabled={mutation.isPending} onClick={() => mutation.mutate(revision)}><RotateCcw size={14} /> Khôi phục bản này</button></div>)}</div>}{compare && <div className="fixed inset-0 z-[180] grid place-items-center p-4"><div className="absolute inset-0 bg-black/70" onClick={() => setCompare(null)} /><div className="relative w-full max-w-5xl max-h-[90dvh] overflow-auto rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}><div className="flex items-center justify-between gap-4 mb-4"><div><h2 className="text-lg font-bold">So sánh v{compare.version} với bản hiện tại</h2><p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Dòng đỏ là nội dung hiện tại không còn trong phiên bản cũ; dòng xanh là nội dung phiên bản cũ sẽ được khôi phục.</p></div><button className="btn-ghost p-2" onClick={() => setCompare(null)} aria-label="Đóng so sánh"><X size={17} /></button></div><div className="grid md:grid-cols-2 gap-3 mb-4"><div className="rounded-xl border p-4" style={{ borderColor: 'rgba(248,113,113,.35)' }}><p className="text-xs font-bold mb-2 text-red-300">Hiện tại</p><h3 className="font-semibold">{currentPost?.title}</h3><pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed">{plainText(currentPost?.content ?? '')}</pre></div><div className="rounded-xl border p-4" style={{ borderColor: 'rgba(74,222,128,.35)' }}><p className="text-xs font-bold mb-2 text-green-300">v{compare.version}</p><h3 className="font-semibold">{compare.title}</h3><pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed">{plainText(compare.content)}</pre></div></div><div className="space-y-1">{changes.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Không có thay đổi nội dung dạng chữ.</p> : changes.map((change, index) => <p key={`${change.type}-${index}`} className={`rounded px-2 py-1 font-mono text-xs ${change.type === 'remove' ? 'bg-red-500/10 text-red-200' : 'bg-green-500/10 text-green-200'}`}>{change.type === 'remove' ? '- ' : '+ '}{change.line}</p>)}</div></div></div>}</div>
}
