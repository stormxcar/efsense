import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchSeries, createSeries, updateSeries, deleteSeries, generateSlug
} from '@/services/api'
import { PlusCircle, Edit2, Trash2, Check, X } from 'lucide-react'
import { formatDate, SERIES_ICONS } from '@/utils'
import type { SeriesRow } from '@/types/database'
import toast from 'react-hot-toast'
import CloudinaryImageField from '@/components/CloudinaryImageField'
import { optionalHttpUrl, requiredText } from '@/utils/validation'
import ConfirmModal from '@/components/ConfirmModal'

const DEFAULT_FORM = { name: '', slug: '', description: '', thumbnail: '', status: 'draft' as 'draft' | 'published' }

function validateSeriesForm(form: typeof DEFAULT_FORM) {
  const name = requiredText(form.name, 'Tên chuyên đề', 2, 120)
  const slug = form.slug.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) throw new Error('Slug chỉ được dùng chữ thường, số và dấu gạch ngang')
  const description = form.description.trim()
  if (description.length > 500) throw new Error('Mô tả chuyên đề không được vượt quá 500 ký tự')
  return { name, slug, description: description || undefined, thumbnail: optionalHttpUrl(form.thumbnail, 'Ảnh đại diện') ?? undefined, status: form.status }
}

export default function AdminSeries() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [confirmSeriesId, setConfirmSeriesId] = useState<string | null>(null)

  const { data: series = [], isLoading } = useQuery({
    queryKey: ['admin-series'],
    queryFn: () => fetchSeries().then(r => r.data ?? []),
  })

  const createMutation = useMutation({
    mutationFn: () => createSeries(validateSeriesForm(form)).then(result => { if (result.error) throw result.error }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-series'] }); setShowNew(false); setForm(DEFAULT_FORM); toast.success('Đã tạo chuyên đề') },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Không thể tạo chuyên đề'),
  })

  const updateMutation = useMutation({
    mutationFn: () => updateSeries(editing!, validateSeriesForm(form)).then(result => { if (result.error) throw result.error }),
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Không thể cập nhật chuyên đề'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-series'] }); setEditing(null); toast.success('Đã cập nhật chuyên đề') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSeries(id).then(() => {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-series'] }); toast.success('Đã xóa chuyên đề') },
  })

  const startEdit = (s: SeriesRow) => {
    setEditing(s.id)
    setForm({ name: s.name, slug: s.slug, description: s.description ?? '', thumbnail: s.thumbnail ?? '', status: s.status })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Quản lý chuyên đề</h1>
        <button onClick={() => { setShowNew(true); setForm(DEFAULT_FORM) }} className="btn-primary text-sm">
          <PlusCircle size={15} /> Chuyên đề mới
        </button>
      </div>

      {/* New Series Form */}
      {showNew && (
        <div className="card p-6 mb-6 animate-fade-in-up">
          <h3 className="font-semibold mb-4">Tạo chuyên đề mới</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tên chuyên đề *</label>
              <input value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: generateSlug(e.target.value) }))}
                className="input text-sm" placeholder="Tên chuyên đề" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Slug</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="input text-sm font-mono" placeholder="series-slug" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Mô tả</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="input resize-none text-sm" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <CloudinaryImageField
                value={form.thumbnail}
                onChange={thumbnail => setForm(current => ({ ...current, thumbnail }))}
                folder="football-stories/series"
                label="Ảnh đại diện chuyên đề"
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Trạng thái</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'draft' | 'published' }))}
                className="input text-sm">
                <option value="draft">Bản nháp</option>
                <option value="published">Đã xuất bản</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
              className="btn-primary text-sm flex items-center justify-center min-w-[120px]">
              {createMutation.isPending ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : 'Lưu chuyên đề'}
            </button>
            <button onClick={() => setShowNew(false)} disabled={createMutation.isPending} className="btn-ghost text-sm disabled:opacity-50">Hủy</button>
          </div>
        </div>
      )}

      {/* Series List */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)
        ) : series.map((s: SeriesRow) => (
          <div key={s.id} className="card p-5">
            {editing === s.id ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input text-sm" />
                <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  className="input text-sm font-mono" />
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input text-sm sm:col-span-2" placeholder="Mô tả" />
                <div className="sm:col-span-2">
                  <CloudinaryImageField
                    value={form.thumbnail}
                    onChange={thumbnail => setForm(current => ({ ...current, thumbnail }))}
                    folder="football-stories/series"
                    label="Ảnh đại diện chuyên đề"
                  />
                </div>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'draft' | 'published' }))}
                  className="input text-sm">
                  <option value="draft">Bản nháp</option>
                  <option value="published">Đã xuất bản</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="btn-primary text-sm px-3 py-1.5 disabled:opacity-50">
                    {updateMutation.isPending ? <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> : <Check size={14} />} Lưu
                  </button>
                  <button onClick={() => setEditing(null)} disabled={updateMutation.isPending} className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-50">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-3xl">{SERIES_ICONS[s.slug] ?? '📰'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold">{s.name}</p>
                    <span className={`badge text-xs ${s.status === 'published' ? 'badge-green' : 'badge-orange'}`}>
                      {s.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                    </span>
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{s.description || s.slug}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Tạo ngày {formatDate(s.created_at)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(s)} disabled={deleteMutation.isPending || updateMutation.isPending} className="btn-ghost p-2 disabled:opacity-50"><Edit2 size={14} /></button>
                  <button onClick={() => setConfirmSeriesId(s.id)}
                    disabled={deleteMutation.isPending || updateMutation.isPending}
                    className="btn-ghost p-2 disabled:opacity-50" style={{ color: '#f87171' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <ConfirmModal open={Boolean(confirmSeriesId)} title="Xóa chuyên đề?" message="Chuyên đề sẽ bị xóa và các bài viết sẽ được gỡ liên kết khỏi chuyên đề này." confirmLabel="Xóa chuyên đề" loading={deleteMutation.isPending} onCancel={() => setConfirmSeriesId(null)} onConfirm={() => { if (confirmSeriesId) deleteMutation.mutate(confirmSeriesId, { onSettled: () => setConfirmSeriesId(null) }) }} />
    </div>
  )
}
