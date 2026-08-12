import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, Edit2, Image, PlusCircle, Trash2, Video, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { createTimelineEvent, deleteTimelineEvent, fetchTimelineEvents, updateTimelineEvent, type TimelineEventInput } from '@/services/api'
import type { HistoryTimelineEventWithPost } from '@/types/database'
import { optionalHttpUrl, requiredText, validateHexColor, validateIntegerRange, validateYear } from '@/utils/validation'

type TimelineForm = {
  year: string
  era: string
  title: string
  description: string
  accent_color: string
  post_id: string
  media_url: string
  media_type: '' | 'image' | 'video'
  sort_order: string
  status: 'draft' | 'published'
}

const DEFAULT_FORM: TimelineForm = {
  year: '', era: '', title: '', description: '', accent_color: '#b7f34a', post_id: '', media_url: '', media_type: '', sort_order: '10', status: 'draft',
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại.'
}

function toInput(form: TimelineForm): TimelineEventInput {
  const mediaUrl = optionalHttpUrl(form.media_url, 'URL media')
  if (form.media_type && !mediaUrl) throw new Error('Đã chọn loại media thì cần nhập URL media')
  return {
    year: validateYear(Number(form.year)),
    era: requiredText(form.era, 'Tên thời kỳ', 2, 80),
    title: requiredText(form.title, 'Tiêu đề', 8, 180),
    description: requiredText(form.description, 'Mô tả', 20, 800),
    accent_color: validateHexColor(form.accent_color),
    post_id: form.post_id || null,
    media_url: mediaUrl,
    media_type: form.media_type || null,
    sort_order: validateIntegerRange(Number(form.sort_order), 'Thứ tự', 0, 9999),
    status: form.status,
  }
}

export default function AdminTimeline() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<TimelineForm>(DEFAULT_FORM)
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['admin-timeline'],
    queryFn: () => fetchTimelineEvents().then(result => {
      if (result.error) throw result.error
      return result.data
    }),
  })
  const { data: posts = [] } = useQuery({
    queryKey: ['admin-timeline-post-options'],
    queryFn: async () => {
      const result = await supabase.from('posts').select('id, title').order('published_at', { ascending: false }).limit(100)
      if (result.error) throw result.error
      return result.data ?? []
    },
  })
  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.sort_order - b.sort_order || a.year - b.year), [events])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = toInput(form)
      if (editing) return updateTimelineEvent(editing, input)
      return createTimelineEvent(input)
    },
    onSuccess: async ({ error: saveError }) => {
      if (saveError) throw saveError
      await qc.invalidateQueries({ queryKey: ['admin-timeline'] })
      await qc.invalidateQueries({ queryKey: ['timeline-events'] })
      setEditing(null)
      setShowNew(false)
      setForm(DEFAULT_FORM)
      toast.success(editing ? 'Đã cập nhật cột mốc' : 'Đã tạo cột mốc')
    },
    onError: error => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTimelineEvent,
    onSuccess: async ({ error: deleteError }) => {
      if (deleteError) throw deleteError
      await qc.invalidateQueries({ queryKey: ['admin-timeline'] })
      await qc.invalidateQueries({ queryKey: ['timeline-events'] })
      toast.success('Đã xóa cột mốc')
    },
    onError: error => toast.error(getErrorMessage(error)),
  })

  const openCreate = () => { setEditing(null); setForm({ ...DEFAULT_FORM, sort_order: String((sortedEvents.at(-1)?.sort_order ?? 0) + 10) }); setShowNew(true) }
  const openEdit = (event: HistoryTimelineEventWithPost) => {
    setEditing(event.id)
    setShowNew(false)
    setForm({ year: String(event.year), era: event.era, title: event.title, description: event.description, accent_color: event.accent_color, post_id: event.post_id ?? '', media_url: event.media_url ?? '', media_type: event.media_type ?? '', sort_order: String(event.sort_order), status: event.status })
  }
  const setField = <K extends keyof TimelineForm>(key: K, value: TimelineForm[K]) => setForm(current => ({ ...current, [key]: value }))
  const move = (event: HistoryTimelineEventWithPost, direction: -1 | 1) => {
    const index = sortedEvents.findIndex(item => item.id === event.id)
    const target = sortedEvents[index + direction]
    if (!target) return
    const currentOrder = event.sort_order
    const targetOrder = target.sort_order
    updateTimelineEvent(event.id, { sort_order: targetOrder }).then(async result => {
      if (result.error) throw result.error
      const swap = await updateTimelineEvent(target.id, { sort_order: currentOrder })
      if (swap.error) throw swap.error
      await qc.invalidateQueries({ queryKey: ['admin-timeline'] })
      await qc.invalidateQueries({ queryKey: ['timeline-events'] })
    }).catch(error => toast.error(getErrorMessage(error)))
  }

  const editor = (editing || showNew) && (
    <div className="card p-6 mb-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">{editing ? 'Chỉnh sửa cột mốc' : 'Tạo cột mốc mới'}</h2><button className="btn-ghost p-2" onClick={() => { setEditing(null); setShowNew(false) }}><X size={16} /></button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Năm *<input className="input mt-1 text-sm" type="number" min="1800" max="2100" value={form.year} onChange={event => setField('year', event.target.value)} /></label>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Thứ tự *<input className="input mt-1 text-sm" type="number" min="0" max="9999" value={form.sort_order} onChange={event => setField('sort_order', event.target.value)} /></label>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Thời kỳ *<input className="input mt-1 text-sm" maxLength={80} value={form.era} onChange={event => setField('era', event.target.value)} placeholder="Ví dụ: Cách mạng chiến thuật" /></label>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Màu nhấn *<input className="input mt-1 text-sm" type="text" maxLength={7} value={form.accent_color} onChange={event => setField('accent_color', event.target.value)} placeholder="#b7f34a" /></label>
        <label className="text-xs md:col-span-2" style={{ color: 'var(--text-muted)' }}>Tiêu đề *<input className="input mt-1 text-sm" maxLength={180} value={form.title} onChange={event => setField('title', event.target.value)} /></label>
        <label className="text-xs md:col-span-2" style={{ color: 'var(--text-muted)' }}>Mô tả *<textarea className="input mt-1 text-sm resize-y" rows={4} maxLength={800} value={form.description} onChange={event => setField('description', event.target.value)} /></label>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Bài viết liên quan<select className="input mt-1 text-sm" value={form.post_id} onChange={event => setField('post_id', event.target.value)}><option value="">Không gắn bài viết</option>{posts.map(post => <option key={post.id} value={post.id}>{post.title}</option>)}</select></label>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Trạng thái<select className="input mt-1 text-sm" value={form.status} onChange={event => setField('status', event.target.value as TimelineForm['status'])}><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option></select></label>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>URL ảnh/video<input className="input mt-1 text-sm" value={form.media_url} onChange={event => setField('media_url', event.target.value)} placeholder="https://..." /></label>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Loại media<select className="input mt-1 text-sm" value={form.media_type} onChange={event => setField('media_type', event.target.value as TimelineForm['media_type'])}><option value="">Không có</option><option value="image">Ảnh</option><option value="video">Video</option></select></label>
      </div>
      <div className="flex gap-2 mt-5"><button className="btn-primary text-sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'Đang lưu...' : <><Check size={14} /> Lưu cột mốc</>}</button><button className="btn-ghost text-sm" disabled={saveMutation.isPending} onClick={() => { setEditing(null); setShowNew(false) }}>Hủy</button></div>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8"><div><h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Dòng thời gian bóng đá</h1><p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Quản lý mốc lịch sử, media và liên kết bài viết.</p></div><button className="btn-primary text-sm" onClick={openCreate}><PlusCircle size={15} /> Cột mốc mới</button></div>
      {editor}
      {isLoading ? <div className="space-y-3">{[1, 2, 3].map(item => <div key={item} className="skeleton h-24 rounded-xl" />)}</div> : error ? <div className="empty-state"><h2>Không thể tải timeline</h2><p>Kiểm tra quyền quản trị và kết nối Supabase.</p></div> : <div className="space-y-3">{sortedEvents.map((event, index) => <div key={event.id} className="card p-5"><div className="flex flex-wrap items-center gap-4"><span className="text-2xl font-black" style={{ color: event.accent_color }}>{event.year}</span><div className="flex-1 min-w-[15rem]"><div className="flex flex-wrap items-center gap-2"><strong>{event.title}</strong><span className={`badge text-xs ${event.status === 'published' ? 'badge-green' : 'badge-orange'}`}>{event.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</span></div><p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{event.era} · thứ tự {event.sort_order}{event.post ? ` · ${event.post.title}` : ''}</p></div><div className="flex items-center gap-1"><button className="btn-ghost p-2" title="Đưa lên" disabled={index === 0} onClick={() => move(event, -1)}><ArrowUp size={15} /></button><button className="btn-ghost p-2" title="Đưa xuống" disabled={index === sortedEvents.length - 1} onClick={() => move(event, 1)}><ArrowDown size={15} /></button><button className="btn-ghost p-2" title="Chỉnh sửa" onClick={() => openEdit(event)}><Edit2 size={15} /></button><button className="btn-ghost p-2" title="Xóa" style={{ color: '#f87171' }} onClick={() => { if (window.confirm('Xóa cột mốc này?')) deleteMutation.mutate(event.id) }}><Trash2 size={15} /></button></div></div><p className="text-sm mt-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{event.description}</p><div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{event.media_type === 'image' ? <><Image size={13} /> Có ảnh</> : event.media_type === 'video' ? <><Video size={13} /> Có video</> : 'Chưa có media'}</div></div>)}</div>}
    </div>
  )
}
