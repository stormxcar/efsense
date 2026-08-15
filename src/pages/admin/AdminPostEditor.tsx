import { useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { createPost, updatePost, fetchSeries, fetchTags, fetchTaxonomies, createTag, generateSlug, markMediaAssetsReferenced } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { Save, Eye, ArrowLeft, UploadCloud, X, Plus, Link as LinkIcon, Image, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { uploadImageToCloudinary } from '@/lib/cloudinary'
import GalleryEditor from '@/components/GalleryEditor'
import { useUIStore } from '@/store'
import { useProcessing } from '@/hooks/useProcessing'
import { optionalHttpUrl, requiredText } from '@/utils/validation'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import type { SeriesRow, TagRow } from '@/types/database'

function formatLocalDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function presetDate(preset: string) {
  const date = new Date()
  if (preset === 'one-hour') date.setHours(date.getHours() + 1)
  if (preset === 'tomorrow-morning') { date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0) }
  if (preset === 'tomorrow-evening') { date.setDate(date.getDate() + 1); date.setHours(20, 0, 0, 0) }
  if (preset === 'weekend') {
    const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7
    date.setDate(date.getDate() + daysUntilSaturday)
    date.setHours(9, 0, 0, 0)
  }
  return formatLocalDateTime(date)
}

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'bullet', 'align',
  'blockquote', 'code-block', 'link', 'image',
]

export default function AdminPostEditor() {
  const { id } = useParams<{ id?: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const editorRef = useRef<ReactQuill>(null)
  const process = useProcessing()
  const startProcessing = useUIStore(state => state.startProcessing)
  const stopProcessing = useUIStore(state => state.stopProcessing)

  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    cover_image: '',
    image_alt: '',
    image_credit: '',
    image_source_url: '',
    series_id: '',
    status: 'draft' as 'draft' | 'published' | 'scheduled',
    scheduled_at: '',
    league_id: '',
    club_id: '',
    player_id: '',
    season_id: '',
    featured: false,
    meta_title: '',
    meta_desc: '',
    tagIds: [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverInputMode, setCoverInputMode] = useState<'upload' | 'url'>('upload')
  const [coverUrlInput, setCoverUrlInput] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [schedulePreset, setSchedulePreset] = useState('')
  const [showInsertedImagePreview, setShowInsertedImagePreview] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const uploadedAssetIdsRef = useRef<Set<string>>(new Set())

  const uploadArticleImage = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp,image/avif'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const loadingToast = toast.loading('Đang tải ảnh nội dung lên Cloudinary...')
      try {
        const result = await process('Đang tải ảnh nội dung lên Cloudinary...', () => uploadImageToCloudinary(file, 'football-stories/articles'))
        uploadedAssetIdsRef.current.add(result.public_id)
        const editor = editorRef.current?.getEditor()
        if (!editor) return
        const range = editor.getSelection(true) ?? { index: Math.max(0, editor.getLength() - 1), length: 0 }
        editor.insertEmbed(range.index, 'image', result.secure_url, 'user')
        editor.setSelection(range.index + 1)
        window.requestAnimationFrame(() => setForm(current => ({ ...current, content: editor.root.innerHTML })))
        toast.success('Đã chèn ảnh vào bài viết', { id: loadingToast })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể tải ảnh', { id: loadingToast })
      }
    }
    input.click()
  }, [process])

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: [] }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['clean'],
      ],
      handlers: { image: uploadArticleImage },
    },
  }), [uploadArticleImage])

  const handleEditorPaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(event.clipboardData.files).find(item => item.type.startsWith('image/'))
    if (!file) return
    event.preventDefault()
    void process('Đang tải ảnh đã dán lên Cloudinary...', async () => {
      const result = await uploadImageToCloudinary(file, 'football-stories/articles')
      uploadedAssetIdsRef.current.add(result.public_id)
      const editor = editorRef.current?.getEditor()
      if (!editor) return
      const range = editor.getSelection(true) ?? { index: Math.max(0, editor.getLength() - 1), length: 0 }
      editor.insertEmbed(range.index, 'image', result.secure_url, 'user')
      editor.setSelection(range.index + 1)
      window.requestAnimationFrame(() => setForm(current => ({ ...current, content: editor.root.innerHTML })))
      toast.success('Đã tải ảnh dán lên Cloudinary')
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể tải ảnh đã dán'))
  }, [process])

  // Load existing post if editing
  useQuery({
    queryKey: ['post-edit', id],
    queryFn: async () => {
      if (!id) return null
      const { data } = await supabase.from('posts')
        .select('*, post_tags(tag_id)')
        .eq('id', id).single()
      if (data) {
        setForm({
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt ?? '',
          content: data.content ?? '',
          cover_image: data.cover_image ?? '',
          image_alt: data.image_alt ?? '',
          image_credit: data.image_credit ?? '',
          image_source_url: data.image_source_url ?? '',
          series_id: data.series_id ?? '',
          status: data.status as 'draft' | 'published' | 'scheduled',
          featured: data.featured,
          meta_title: data.meta_title ?? '',
          meta_desc: data.meta_desc ?? '',
          scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString().slice(0, 16) : '',
          league_id: data.league_id ?? '',
          club_id: data.club_id ?? '',
          player_id: data.player_id ?? '',
          season_id: data.season_id ?? '',
          tagIds: data.post_tags?.map((pt: { tag_id: string }) => pt.tag_id) ?? [],
        })
        if (data.scheduled_at) setSchedulePreset('custom')
        if (data.cover_image) setCoverUrlInput(data.cover_image)
      }
      return data
    },
    enabled: isEditing,
  })

  const { data: seriesList = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => fetchSeries().then(r => r.data ?? []),
  })
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => fetchTags().then(r => r.data ?? []),
  })
  const { data: taxonomies } = useQuery({
    queryKey: ['taxonomies'],
    queryFn: fetchTaxonomies,
  })

  const validatePostField = (field: string, value: string) => {
    if (field === 'title' && value.trim() && value.trim().length < 8) return 'Tiêu đề cần ít nhất 8 ký tự.'
    if (field === 'slug' && value.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim().toLowerCase())) return 'Slug chỉ gồm chữ thường, số và dấu gạch ngang.'
    if (field === 'excerpt' && value.length > 320) return 'Mô tả ngắn không được vượt quá 320 ký tự.'
    if (field === 'meta_title' && value.length > 70) return 'Tiêu đề SEO không được vượt quá 70 ký tự.'
    if (field === 'meta_desc' && value.length > 160) return 'Mô tả SEO không được vượt quá 160 ký tự.'
    return ''
  }

  const updatePostField = (field: string, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
    setFieldErrors(current => ({ ...current, [field]: validatePostField(field, value) }))
  }

  const handleTitleChange = (title: string) => {
    const nextSlug = !isEditing ? generateSlug(title) : form.slug
    setForm(f => ({ ...f, title, ...(!isEditing ? { slug: nextSlug } : {}) }))
    setFieldErrors(current => ({ ...current, title: validatePostField('title', title), ...(!isEditing ? { slug: validatePostField('slug', nextSlug) } : {}) }))
  }

  // Upload cover via file
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setCoverPreview(localUrl)
    setUploadingCover(true)
    try {
      const result = await process('Đang tải ảnh bìa lên Cloudinary...', () => uploadImageToCloudinary(file, 'football-stories/covers'))
      uploadedAssetIdsRef.current.add(result.public_id)
      setForm(f => ({ ...f, cover_image: result.secure_url }))
      URL.revokeObjectURL(localUrl)
      setCoverPreview('')
      setCoverUrlInput(result.secure_url)
      toast.success('Đã lưu ảnh bìa trên Cloudinary')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải ảnh bìa')
    } finally {
      setUploadingCover(false)
      e.target.value = ''
    }
  }

  // Cover via URL
  const handleCoverUrl = async () => {
    if (!coverUrlInput.trim()) return
    setCoverPreview(coverUrlInput.trim())
    setUploadingCover(true)
    try {
      const result = await process('Đang sao chép ảnh URL vào Cloudinary...', () => uploadImageToCloudinary(coverUrlInput, 'football-stories/covers'))
      uploadedAssetIdsRef.current.add(result.public_id)
      setForm(f => ({ ...f, cover_image: result.secure_url }))
      setCoverPreview('')
      setCoverUrlInput(result.secure_url)
      toast.success('Đã sao chép ảnh URL vào Cloudinary')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu ảnh từ URL')
    } finally {
      setUploadingCover(false)
    }
  }

  const handleAddTag = async () => {
    if (!newTagName.trim()) return
    const slug = generateSlug(newTagName)
    const { data, error } = await createTag(newTagName.trim(), slug)
    if (error) { toast.error('Tag already exists'); return }
    if (data) {
      setForm(f => ({ ...f, tagIds: [...f.tagIds, data.id] }))
      qc.invalidateQueries({ queryKey: ['tags'] })
      setNewTagName('')
    }
  }

  const handleContentChange = useCallback((value: string) => {
    setForm(f => ({ ...f, content: value }))
  }, [])

  const handleSubmit = async (status: 'draft' | 'published' | 'scheduled') => {
    if (!user) return toast.error('Phiên đăng nhập đã hết hạn')
    let validatedTitle: string
    let validatedSlug: string
    let validatedContent: string
    try {
      validatedTitle = requiredText(form.title, 'Tiêu đề', 8, 180)
      validatedSlug = form.slug.trim().toLowerCase()
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(validatedSlug) || validatedSlug.length > 180) throw new Error('Slug chỉ được dùng chữ thường, số và dấu gạch ngang')
      validatedContent = form.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      if (status === 'published' && validatedContent.length < 80) throw new Error('Bài viết xuất bản cần ít nhất 80 ký tự nội dung')
      if (form.excerpt.length > 320) throw new Error('Mô tả ngắn không được vượt quá 320 ký tự')
      if (form.meta_title.length > 70 || form.meta_desc.length > 160) throw new Error('Tiêu đề SEO tối đa 70 ký tự, mô tả SEO tối đa 160 ký tự')
      if (form.cover_image) optionalHttpUrl(form.cover_image, 'Ảnh bìa')
      if (form.image_source_url) optionalHttpUrl(form.image_source_url, 'Nguồn ảnh')
      if (status === 'scheduled') {
        if (!form.scheduled_at) throw new Error('Vui lòng chọn thời gian xuất bản')
        if (new Date(form.scheduled_at).getTime() <= Date.now()) throw new Error('Thời gian xuất bản phải ở tương lai')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dữ liệu bài viết chưa hợp lệ'
      if (message.includes('Tiêu đề')) setFieldErrors(current => ({ ...current, title: message }))
      if (message.includes('Slug')) setFieldErrors(current => ({ ...current, slug: message }))
      if (message.includes('Mô tả ngắn')) setFieldErrors(current => ({ ...current, excerpt: message }))
      toast.error(error instanceof Error ? error.message : 'Dữ liệu bài viết chưa hợp lệ')
      return
    }
    setSaving(true)
    startProcessing(status === 'published' ? 'Đang xuất bản bài viết...' : status === 'scheduled' ? 'Đang lên lịch bài viết...' : 'Đang lưu bản nháp...')
    try {
      const payload = {
        ...form,
        title: validatedTitle,
        slug: validatedSlug,
        status,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        author_id: user.id,
      }
      const result = isEditing
        ? await updatePost(id!, payload)
        : await createPost(payload)
      if (result.error) throw result.error
      const savedPostId = result.data?.id || id
      if (savedPostId && uploadedAssetIdsRef.current.size) {
        await markMediaAssetsReferenced([...uploadedAssetIdsRef.current], 'post', savedPostId)
        uploadedAssetIdsRef.current.clear()
      }
      if (status === 'published') {
        const postId = savedPostId
        if (postId) void supabase.functions.invoke('newsletter-dispatch', { body: { postId } })
      }
      // Invalidate all related queries so lists refresh immediately
      await qc.invalidateQueries({ queryKey: ['admin-posts'] })
      await qc.invalidateQueries({ queryKey: ['admin-stats'] })
      await qc.invalidateQueries({ queryKey: ['posts'] })
      await qc.invalidateQueries({ queryKey: ['admin-recent-posts'] })
      toast.success(status === 'published' ? 'Đã xuất bản bài viết' : status === 'scheduled' ? 'Đã lên lịch xuất bản' : 'Đã lưu bản nháp')
      navigate('/admin/posts')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể lưu bài viết')
    } finally {
      setSaving(false)
      stopProcessing()
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/admin/posts')} className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>
          {isEditing ? 'Chỉnh sửa bài viết' : 'Bài viết mới'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Editor ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Tiêu đề *</label>
            <input value={form.title} onChange={e => handleTitleChange(e.target.value)}
              className={`input text-lg font-semibold ${fieldErrors.title ? 'auth-input-error' : ''}`} aria-invalid={Boolean(fieldErrors.title)} placeholder="Nhập tiêu đề bài viết..." />
            {fieldErrors.title && <p className="auth-field-error">{fieldErrors.title}</p>}
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium mb-2">Slug</label>
            <input value={form.slug} onChange={e => updatePostField('slug', e.target.value)}
              className={`input font-mono text-sm ${fieldErrors.slug ? 'auth-input-error' : ''}`} aria-invalid={Boolean(fieldErrors.slug)} placeholder="article-slug" />
            {fieldErrors.slug && <p className="auth-field-error">{fieldErrors.slug}</p>}
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium mb-2">Tóm tắt</label>
            <textarea value={form.excerpt} onChange={e => updatePostField('excerpt', e.target.value)}
              className={`input resize-none ${fieldErrors.excerpt ? 'auth-input-error' : ''}`} aria-invalid={Boolean(fieldErrors.excerpt)} rows={2} placeholder="Tóm tắt ngắn nội dung bài viết..." maxLength={320} />
            {fieldErrors.excerpt && <p className="auth-field-error">{fieldErrors.excerpt}</p>}
          </div>

          {/* Rich Text Editor */}
          <div>
            <label className="block text-sm font-medium mb-2">Nội dung</label>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }} onPaste={handleEditorPaste}>
              <ReactQuill
                ref={editorRef}
                theme="snow"
                value={form.content}
                onChange={handleContentChange}
                modules={quillModules}
                formats={quillFormats}
                style={{ minHeight: '400px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                placeholder="Viết nội dung bài... Ảnh chèn từ thanh công cụ sẽ được lưu trên Cloudinary."
              />
            </div>
            {form.content && /<img\b/i.test(form.content) && <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Xem trước nội dung đã chèn ảnh</p>
                <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setShowInsertedImagePreview(value => !value)} aria-expanded={showInsertedImagePreview} aria-label={showInsertedImagePreview ? 'Thu gọn xem trước nội dung' : 'Mở rộng xem trước nội dung'}>
                  {showInsertedImagePreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showInsertedImagePreview ? 'Thu gọn' : 'Mở rộng'}
                </button>
              </div>
              {showInsertedImagePreview && <div className="ql-content prose-football max-h-[34rem] overflow-y-auto" dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.content) }} />}
            </div>}
          </div>

          {/* SEO */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-sm">Thiết lập SEO</h3>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tiêu đề SEO</label>
              <input value={form.meta_title} onChange={e => updatePostField('meta_title', e.target.value)}
                className={`input text-sm ${fieldErrors.meta_title ? 'auth-input-error' : ''}`} aria-invalid={Boolean(fieldErrors.meta_title)} placeholder="Tiêu đề hiển thị trên công cụ tìm kiếm..." />
              {fieldErrors.meta_title && <p className="auth-field-error">{fieldErrors.meta_title}</p>}
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Mô tả SEO</label>
              <textarea value={form.meta_desc} onChange={e => updatePostField('meta_desc', e.target.value)}
                className={`input resize-none text-sm ${fieldErrors.meta_desc ? 'auth-input-error' : ''}`} aria-invalid={Boolean(fieldErrors.meta_desc)} rows={2} placeholder="Mô tả hiển thị trên công cụ tìm kiếm..." maxLength={160} />
              {fieldErrors.meta_desc && <p className="auth-field-error">{fieldErrors.meta_desc}</p>}
            </div>
          </div>
          {id && <GalleryEditor postId={id} />}
          {!id && (
            <div className="card p-5 text-sm" style={{ color: 'var(--text-muted)' }}>
              Lưu bài viết dưới dạng bản nháp trước để thêm gallery ảnh.
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">
          {/* Publish Actions */}
          <div className="card p-5 space-y-3">
            <button
              onClick={() => handleSubmit('published')}
              disabled={saving || !form.title}
              className="btn-primary w-full justify-center disabled:opacity-50"
            >
              {saving
                ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <><Save size={15} /> Xuất bản ngay</>
              }
            </button>
            <button
              onClick={() => handleSubmit('draft')}
              disabled={saving || !form.title}
              className="btn-secondary w-full justify-center disabled:opacity-50"
            >
              Lưu bản nháp
            </button>
            <label className="block text-xs font-semibold pt-2">Thời gian xuất bản</label>
            <select value={schedulePreset} onChange={event => { const preset = event.target.value; setSchedulePreset(preset); if (preset && preset !== 'custom') setForm(current => ({ ...current, scheduled_at: presetDate(preset) })) }} className="input text-sm">
              <option value="">Chọn nhanh thời gian</option>
              <option value="one-hour">Sau 1 giờ</option>
              <option value="tomorrow-morning">Ngày mai lúc 09:00</option>
              <option value="tomorrow-evening">Ngày mai lúc 20:00</option>
              <option value="weekend">Thứ bảy tuần này lúc 09:00</option>
              <option value="custom">Tự chọn ngày và giờ</option>
            </select>
            {schedulePreset === 'custom' && <input
              type="datetime-local"
              value={form.scheduled_at}
              min={formatLocalDateTime(new Date())}
              onChange={event => setForm(current => ({ ...current, scheduled_at: event.target.value }))}
              className="input text-sm"
            />}
            <button
              onClick={() => handleSubmit('scheduled')}
              disabled={saving || !form.title || !form.scheduled_at}
              className="btn-secondary w-full justify-center disabled:opacity-50"
            >
              Lên lịch xuất bản
            </button>
            {id && form.slug && (
              <a href={`/admin/posts/${id}/preview`} target="_blank" rel="noopener"
                className="btn-ghost w-full justify-center text-sm">
                <Eye size={14} /> Xem trước bản nháp
              </a>
            )}
          </div>

          {/* Cover Image */}
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-3">Ảnh bìa</h3>

            {/* Mode Toggle */}
            <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
              <button onClick={() => setCoverInputMode('upload')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${coverInputMode === 'upload' ? 'bg-blue-500 text-white' : ''}`}
                style={coverInputMode !== 'upload' ? { color: 'var(--text-muted)' } : {}}>
                <UploadCloud size={12} /> Tải tệp
              </button>
              <button onClick={() => setCoverInputMode('url')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${coverInputMode === 'url' ? 'bg-blue-500 text-white' : ''}`}
                style={coverInputMode !== 'url' ? { color: 'var(--text-muted)' } : {}}>
                <LinkIcon size={12} /> Dán URL
              </button>
            </div>

            {(form.cover_image || coverPreview || coverUrlInput) ? (
              <div className="relative">
                <img src={form.cover_image || coverPreview || coverUrlInput} alt="Xem trước ảnh bìa" className="w-full rounded-xl object-cover h-32" />
                {uploadingCover && <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-xs text-white">Đang lưu lên Cloudinary...</span>}
                <button onClick={() => { setForm(f => ({ ...f, cover_image: '' })); setCoverUrlInput(''); if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview); setCoverPreview('') }}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600">
                  <X size={12} className="text-white" />
                </button>
              </div>
            ) : coverInputMode === 'upload' ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-blue-500/50 transition-colors"
                style={{ borderColor: 'var(--border-color)' }}>
                {uploadingCover
                  ? <span className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                  : <>
                    <Image size={24} className="mb-2" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Chọn ảnh để tải lên</span>
                    <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PNG, JPG, WEBP</span>
                  </>
                }
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              </label>
            ) : (
              <div className="space-y-2">
                <input
                  value={coverUrlInput}
                  onChange={e => setCoverUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCoverUrl()}
                  className="input text-sm"
                  placeholder="https://example.com/image.jpg"
                />
                <button onClick={handleCoverUrl} disabled={uploadingCover} className="btn-primary w-full justify-center text-sm py-2 disabled:opacity-50">
                  {uploadingCover ? 'Đang lưu lên Cloudinary...' : 'Lưu ảnh từ URL'}
                </button>
              </div>
            )}
            <div className="space-y-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <input value={form.image_alt} onChange={event => setForm(current => ({ ...current, image_alt: event.target.value }))} className="input text-sm" placeholder="Mô tả ảnh cho người dùng đọc màn hình" />
              <input value={form.image_credit} onChange={event => setForm(current => ({ ...current, image_credit: event.target.value }))} className="input text-sm" placeholder="Tác giả / nguồn ghi công" />
              <input type="url" value={form.image_source_url} onChange={event => setForm(current => ({ ...current, image_source_url: event.target.value }))} className="input text-sm" placeholder="URL nguồn ảnh gốc" />
            </div>
          </div>

          {/* Series */}
          <div className="card p-5">
            <label className="block font-semibold text-sm mb-3">Chuyên đề</label>
            <select value={form.series_id} onChange={e => setForm(f => ({ ...f, series_id: e.target.value }))}
              className="input text-sm">
              <option value="">Không có chuyên đề</option>
              {(seriesList as SeriesRow[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm">Phân loại bóng đá</h3>
            {([
              ['league_id', 'Giải đấu', taxonomies?.leagues ?? []],
              ['club_id', 'Câu lạc bộ', taxonomies?.clubs ?? []],
              ['player_id', 'Cầu thủ', taxonomies?.players ?? []],
              ['season_id', 'Mùa giải', taxonomies?.seasons ?? []],
            ] as const).map(([key, label, options]) => (
              <label key={key} className="block text-xs">
                <span className="block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <select value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} className="input text-sm">
                  <option value="">Không chọn</option>
                  {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
            ))}
          </div>

          {/* Tags */}
          <div className="card p-5">
            <label className="block font-semibold text-sm mb-3">Thẻ nội dung</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {(tags as TagRow[]).map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setForm(f => ({
                    ...f,
                    tagIds: f.tagIds.includes(tag.id)
                      ? f.tagIds.filter(t => t !== tag.id)
                      : [...f.tagIds, tag.id]
                  }))}
                  className={`badge text-xs cursor-pointer transition-all ${form.tagIds.includes(tag.id) ? 'badge-blue' : ''}`}
                  style={!form.tagIds.includes(tag.id) ? { background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' } : {}}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                className="input text-sm h-8 flex-1"
                placeholder="Thẻ mới..."
              />
              <button onClick={handleAddTag} className="btn-primary px-3 py-1 text-sm">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Featured */}
          <div className="card p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <span className="text-sm font-medium">Bài viết nổi bật</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
