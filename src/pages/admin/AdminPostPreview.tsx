import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, Eye } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import PostGallery from '@/components/PostGallery'
import { readingTime } from '@/utils'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import type { GalleryImageRow } from '@/types/database'

export default function AdminPostPreview() {
  const { id } = useParams<{ id: string }>()
  const { data: post, isLoading } = useQuery({
    queryKey: ['post-preview', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_gallery_images(*)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  if (isLoading) return <div className="max-w-4xl mx-auto p-8 space-y-4"><div className="skeleton h-8 w-2/3" /><div className="skeleton h-80" /></div>
  if (!post) return <div className="p-8">Không tìm thấy bản xem trước.</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 overflow-x-hidden min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8 p-3 border" style={{ borderColor: 'var(--accent)' }}>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.12em]" style={{ color: 'var(--accent)' }}>Bản xem trước nội bộ</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Trạng thái: {post.status === 'published' ? 'Đã xuất bản' : post.status === 'scheduled' ? 'Đã lên lịch' : 'Bản nháp'}
          </p>
        </div>
        <Link to={`/admin/posts/${post.id}/edit`} className="btn-secondary"><ArrowLeft size={14} /> Quay lại biên tập</Link>
      </div>
      <article className="min-w-0 overflow-hidden">
        <h1 className="text-4xl md:text-6xl font-black uppercase leading-[.9] break-words" style={{ fontFamily: 'var(--font-family-display)' }}>{post.title}</h1>
        <p className="text-lg mt-5" style={{ color: 'var(--text-secondary)' }}>{post.excerpt}</p>
        <div className="flex gap-4 text-xs my-6" style={{ color: 'var(--text-muted)' }}>
          <span className="flex gap-1"><Clock size={13} /> {readingTime(post.content || '')}</span>
          <span className="flex gap-1"><Eye size={13} /> {post.view_count} lượt xem</span>
        </div>
        {post.cover_image && <img src={post.cover_image} alt={post.image_alt || post.title} className="w-full max-h-[34rem] object-cover mb-10" />}
        <div className="ql-content prose-football" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content || '') }} />
        <PostGallery images={(post.post_gallery_images ?? []) as GalleryImageRow[]} />
      </article>
    </div>
  )
}
