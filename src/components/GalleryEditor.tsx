import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import CloudinaryImageField from './CloudinaryImageField'
import type { GalleryImageRow } from '@/types/database'
import { useProcessing } from '@/hooks/useProcessing'

export default function GalleryEditor({ postId }: { postId: string }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState({ image_url: '', image_alt: '', caption: '', image_credit: '', image_source_url: '' })
  const process = useProcessing()
  const { data: images = [] } = useQuery({
    queryKey: ['gallery-admin', postId],
    queryFn: async () => {
      const { data, error } = await supabase.from('post_gallery_images').select('*').eq('post_id', postId).order('sort_order')
      if (error) throw error
      return (data ?? []) as GalleryImageRow[]
    },
  })

  const add = async () => {
    if (!draft.image_url || !draft.image_alt.trim()) {
      toast.error('Ảnh gallery cần URL và mô tả alt')
      return
    }
    try {
      await process('Đang thêm ảnh vào gallery...', async () => {
        const { error } = await supabase.from('post_gallery_images').insert({
          ...draft,
          post_id: postId,
          sort_order: images.length,
        })
        if (error) throw error
      })
      setDraft({ image_url: '', image_alt: '', caption: '', image_credit: '', image_source_url: '' })
      await queryClient.invalidateQueries({ queryKey: ['gallery-admin', postId] })
      toast.success('Đã thêm ảnh vào gallery')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể thêm ảnh vào gallery')
    }
  }

  const remove = async (id: string) => {
    try {
      await process('Đang xóa ảnh khỏi gallery...', async () => {
        const { error } = await supabase.from('post_gallery_images').delete().eq('id', id)
        if (error) throw error
        await queryClient.invalidateQueries({ queryKey: ['gallery-admin', postId] })
      })
      toast.success('Đã xóa ảnh khỏi gallery')
    } catch {
      toast.error('Không thể xóa ảnh khỏi gallery')
    }
  }

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Gallery trong bài</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ảnh có lightbox, caption và ghi nguồn ở trang công khai.</p>
      </div>
      {images.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-2">
          {images.map(image => (
            <div key={image.id} className="relative">
              <img src={image.image_url} alt={image.image_alt} className="w-full aspect-square object-cover rounded-lg" />
              <button type="button" onClick={() => remove(image.id)} className="absolute top-1 right-1 share-utility" aria-label="Xóa ảnh"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <CloudinaryImageField value={draft.image_url} onChange={image_url => setDraft(current => ({ ...current, image_url }))} folder="football-stories/articles" label="Ảnh mới" />
      <input value={draft.image_alt} onChange={event => setDraft(current => ({ ...current, image_alt: event.target.value }))} className="input text-sm" placeholder="Mô tả ảnh (bắt buộc)" />
      <input value={draft.caption} onChange={event => setDraft(current => ({ ...current, caption: event.target.value }))} className="input text-sm" placeholder="Chú thích ảnh" />
      <div className="grid sm:grid-cols-2 gap-2">
        <input value={draft.image_credit} onChange={event => setDraft(current => ({ ...current, image_credit: event.target.value }))} className="input text-sm" placeholder="Tác giả / nguồn ảnh" />
        <input type="url" value={draft.image_source_url} onChange={event => setDraft(current => ({ ...current, image_source_url: event.target.value }))} className="input text-sm" placeholder="URL nguồn gốc" />
      </div>
      <button type="button" onClick={add} className="btn-primary">Thêm vào gallery</button>
    </section>
  )
}
