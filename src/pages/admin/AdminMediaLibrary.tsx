import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDrive, Video, Image as ImageIcon, ScanSearch, Trash2, CheckSquare } from 'lucide-react'
import { cleanupOrphanMediaAssets, fetchOrphanMediaAssets } from '@/services/api'
import { useProcessing } from '@/hooks/useProcessing'
import ConfirmModal from '@/components/ConfirmModal'
import toast from 'react-hot-toast'

type OrphanAsset = { id: string; public_id: string; secure_url: string; resource_type: string; folder: string | null; owner_id: string | null; created_at: string; last_seen_at: string }

export default function AdminMediaLibrary() {
  const qc = useQueryClient()
  const process = useProcessing()
  const [selected, setSelected] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { data: assets = [], isLoading, isFetching, error } = useQuery({
    queryKey: ['admin-media-orphans'],
    queryFn: () => fetchOrphanMediaAssets(300).then(result => { if (result.error) throw result.error; return (result.data ?? []) as OrphanAsset[] }),
  })
  const cleanupMutation = useMutation({
    mutationFn: () => process('Đang dọn media không còn được sử dụng...', async () => {
      const result = await cleanupOrphanMediaAssets(selected)
      if (result.error) throw result.error
      return result.data ?? 0
    }),
    onSuccess: count => { setSelected([]); setConfirmOpen(false); qc.invalidateQueries({ queryKey: ['admin-media-orphans'] }); toast.success(`Đã gỡ ${count} tài sản khỏi thư viện media`) },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể dọn media'),
  })
  const allSelected = assets.length > 0 && selected.length === assets.length
  const toggleAll = () => setSelected(allSelected ? [] : assets.map(asset => asset.id))

  return <div className="p-8"><div className="flex flex-wrap items-start justify-between gap-4 mb-6"><div className="flex items-center gap-3"><HardDrive className="text-blue-400" /><div><h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Thư viện media</h1><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Quét tài sản Cloudinary không còn được bài viết, chuyên đề, timeline hoặc Reels tham chiếu.</p></div></div><div className="flex items-center gap-2"><button className="btn-secondary text-sm" onClick={() => qc.invalidateQueries({ queryKey: ['admin-media-orphans'] })} disabled={isFetching}><ScanSearch size={15} /> {isFetching ? 'Đang quét...' : 'Quét lại'}</button><button className="btn-danger text-sm" onClick={() => setConfirmOpen(true)} disabled={selected.length === 0 || cleanupMutation.isPending}><Trash2 size={15} /> Dọn {selected.length > 0 ? `(${selected.length})` : ''}</button></div></div><div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm"><CheckSquare size={16} style={{ color: 'var(--accent)' }} /><strong>{assets.length}</strong><span style={{ color: 'var(--text-muted)' }}>tài sản có khả năng mồ côi</span></div>{assets.length > 0 && <button type="button" className="btn-ghost text-xs" onClick={toggleAll}>{allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>}</div>{error ? <div className="empty-state">Không thể quét media. Hãy kiểm tra quyền admin và thử lại.</div> : isLoading ? <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map(item => <div key={item} className="skeleton aspect-video rounded-xl" />)}</div> : assets.length === 0 ? <div className="empty-state"><ScanSearch size={28} className="mx-auto mb-3" /><h2>Không có media mồ côi</h2><p className="mt-1">Thư viện media hiện không có tài sản nào cần dọn.</p></div> : <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{assets.map(asset => <label key={asset.id} className={`card overflow-hidden cursor-pointer transition-all ${selected.includes(asset.id) ? 'ring-2 ring-[var(--accent)]' : ''}`}><div className="relative aspect-video bg-black/20 flex items-center justify-center">{asset.resource_type === 'video' ? <><Video size={26} className="text-blue-300" /><span className="absolute bottom-2 left-2 text-[.65rem] bg-black/60 px-1.5 py-1 rounded">Video</span></> : <img src={asset.secure_url} alt="Media chưa được tham chiếu" className="w-full h-full object-cover" loading="lazy" />}</div><div className="p-3"><div className="flex items-start gap-2"><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected(current => current.includes(asset.id) ? current.filter(id => id !== asset.id) : [...current, asset.id])} aria-label={`Chọn ${asset.public_id}`} /><div className="min-w-0"><p className="text-xs truncate">{asset.public_id}</p><p className="text-[.68rem] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{asset.folder ?? 'Không có thư mục'}</p></div></div></div></label>)}</div>}<p className="mt-5 text-xs" style={{ color: 'var(--text-muted)' }}><ImageIcon size={13} className="inline mr-1" /> Bước dọn chỉ gỡ bản ghi khỏi media registry. Việc xóa vật lý trên Cloudinary cần Edge Function có API secret riêng.</p><ConfirmModal open={confirmOpen} title="Dọn media đã chọn?" message="Các tài sản được chọn chỉ được gỡ khỏi thư viện registry sau khi hệ thống kiểm tra lại chúng không còn được tham chiếu. Thao tác không xóa trực tiếp trên Cloudinary." confirmLabel="Gỡ khỏi thư viện" loading={cleanupMutation.isPending} onCancel={() => setConfirmOpen(false)} onConfirm={() => cleanupMutation.mutate()} /></div>
}
