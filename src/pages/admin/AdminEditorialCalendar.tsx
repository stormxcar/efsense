import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import { addDays, addMonths, endOfMonth, format, isSameDay, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { vi } from 'date-fns/locale'
import { reschedulePost } from '@/services/api'
import { useProcessing } from '@/hooks/useProcessing'
import toast from 'react-hot-toast'

type CalendarPost = { id: string; title: string; status: string; scheduled_at: string | null; published_at: string | null }

export default function AdminEditorialCalendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [draggedPost, setDraggedPost] = useState<CalendarPost | null>(null)
  const qc = useQueryClient()
  const process = useProcessing()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['admin-editorial-calendar', format(month, 'yyyy-MM')],
    queryFn: async () => {
      const from = startOfMonth(month).toISOString()
      const to = endOfMonth(month).toISOString()
      const result = await supabase.from('posts').select('id,title,status,scheduled_at,published_at').or(`and(scheduled_at.gte.${from},scheduled_at.lte.${to}),and(published_at.gte.${from},published_at.lte.${to})`).order('scheduled_at', { ascending: true, nullsFirst: false })
      if (result.error) throw result.error
      return (result.data ?? []) as CalendarPost[]
    },
  })
  const rescheduleMutation = useMutation({
    mutationFn: ({ post, day }: { post: CalendarPost; day: Date }) => {
      const source = new Date(post.scheduled_at ?? post.published_at ?? new Date().toISOString())
      const next = new Date(day)
      next.setHours(source.getHours(), source.getMinutes(), 0, 0)
      return process('Đang cập nhật lịch xuất bản...', async () => {
        const result = await reschedulePost(post.id, next.toISOString())
        if (result.error) throw result.error
        return result
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-editorial-calendar'] }); qc.invalidateQueries({ queryKey: ['admin-posts'] }); toast.success('Đã dời bài viết sang ngày mới') },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể dời bài viết'),
  })
  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const last = endOfMonth(month)
    const total = Math.ceil((last.getTime() - first.getTime()) / 86400000) + 1
    return Array.from({ length: Math.ceil(total / 7) * 7 }, (_, index) => addDays(first, index))
  }, [month])
  const postsForDay = (day: Date) => data.filter(post => {
    const timestamp = post.scheduled_at ?? post.published_at
    return timestamp ? isSameDay(new Date(timestamp), day) : false
  })

  return <div className="p-8 max-w-7xl mx-auto">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3"><CalendarDays className="text-blue-400" /><div><h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Lịch biên tập</h1><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Lịch cụ thể theo ngày, tháng và năm của toàn bộ nội dung.</p></div></div>
      <div className="flex items-center gap-2"><button className="btn-ghost p-2" onClick={() => setMonth(current => subMonths(current, 1))} aria-label="Tháng trước"><ChevronLeft size={17} /></button><strong className="min-w-40 text-center capitalize">{format(month, 'MMMM yyyy', { locale: vi })}</strong><button className="btn-ghost p-2" onClick={() => setMonth(current => addMonths(current, 1))} aria-label="Tháng sau"><ChevronRight size={17} /></button><button className="btn-secondary text-xs" onClick={() => setMonth(startOfMonth(new Date()))}>Hôm nay</button></div>
    </div>
    {error ? <div className="empty-state">Không thể tải lịch biên tập.</div> : <div className="card overflow-hidden"><div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border-color)' }}>{['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map(day => <div key={day} className="p-3 text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{day}</div>)}</div><div className="grid grid-cols-7">{isLoading ? Array.from({ length: 35 }, (_, index) => <div key={index} className="min-h-32 p-2 border-b border-r" style={{ borderColor: 'var(--border-color)' }}><div className="skeleton h-4 w-8" /></div>) : days.map(day => { const dayPosts = postsForDay(day); const outside = day.getMonth() !== month.getMonth(); return <div key={day.toISOString()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (draggedPost) { rescheduleMutation.mutate({ post: draggedPost, day }); setDraggedPost(null) } }} className={`min-h-32 p-2 border-b border-r transition-colors ${outside ? 'opacity-40' : ''} ${draggedPost ? 'hover:bg-[var(--accent-soft)]' : ''}`} style={{ borderColor: 'var(--border-color)' }}><div className="flex items-center justify-between mb-2"><span className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'text-blue-400' : ''}`}>{format(day, 'd')}</span>{dayPosts.length > 0 && <span className="text-[.65rem]" style={{ color: 'var(--text-muted)' }}>{dayPosts.length} bài</span>}</div><div className="space-y-1">{dayPosts.slice(0, 3).map(post => <Link key={post.id} draggable={post.status !== 'published'} onDragStart={() => { if (post.status !== 'published') setDraggedPost(post) }} to={`/admin/posts/${post.id}/edit`} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[.68rem] truncate ${post.status === 'scheduled' ? 'bg-blue-500/15 text-blue-300' : post.status === 'published' ? 'bg-green-500/15 text-green-300' : 'bg-orange-500/15 text-orange-300'}`} title={post.status === 'published' ? 'Bài đã xuất bản' : 'Kéo thả để đổi ngày'}><GripVertical size={11} className={`shrink-0 opacity-60 ${post.status === 'published' ? 'invisible' : ''}`} />{post.title}</Link>)}{dayPosts.length > 3 && <span className="text-[.65rem]" style={{ color: 'var(--text-muted)' }}>+ {dayPosts.length - 3} bài khác</span>}</div></div> })}</div></div>}
    <div className="flex flex-wrap gap-4 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}><span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-400/60 mr-1" />Đã lên lịch</span><span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-green-400/60 mr-1" />Đã xuất bản</span><span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400/60 mr-1" />Bản nháp</span></div>
  </div>
}
