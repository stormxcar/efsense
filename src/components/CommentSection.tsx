import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, ImageIcon, X, Reply, Trash2, EyeOff, AlertCircle } from 'lucide-react'
import {
  fetchComments,
  createComment,
  deleteComment,
  hideComment,
  uploadCommentImage,
} from '@/services/api'
import { formatRelativeDate, getInitials } from '@/utils'
import type { CommentWithUser } from '@/types/database'
import toast from 'react-hot-toast'
import { useProcessing } from '@/hooks/useProcessing'

interface Props {
  postId: string
  currentUser: { id: string; username: string; avatar: string | null; role: string } | null
}

export default function CommentSection({ postId, currentUser }: Props) {
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const process = useProcessing()

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => fetchComments(postId).then(r => r.data ?? []),
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Ảnh phải nhỏ hơn 3 MB'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Chỉ hỗ trợ ảnh JPG, PNG và WebP')
      return
    }
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !content.trim()) return
    setSubmitting(true)
    try {
      const { error } = await process('Đang đăng bình luận...', async () => {
        let image_url: string | null = null
        if (image) image_url = await uploadCommentImage(image, currentUser.id)
        return createComment({
          post_id: postId,
          user_id: currentUser.id,
          content: content.trim(),
          parent_comment_id: replyTo?.id ?? null,
          image_url,
        })
      })
      if (error) throw error
      setContent('')
      setImage(null)
      setImagePreview(null)
      setReplyTo(null)
      qc.invalidateQueries({ queryKey: ['comments', postId] })
      toast.success('Đã đăng bình luận')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đăng bình luận')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa bình luận này?')) return
    await deleteComment(id)
    qc.invalidateQueries({ queryKey: ['comments', postId] })
    toast.success('Đã xóa bình luận')
  }

  const handleHide = async (id: string) => {
    await hideComment(id)
    qc.invalidateQueries({ queryKey: ['comments', postId] })
    toast.success('Đã ẩn bình luận')
  }

  const totalComments = comments.reduce((acc: number, c: CommentWithUser) => acc + 1 + (c.replies?.length ?? 0), 0)

  return (
    <section className="mt-12">
      <h3 className="section-heading">
        <span className="text-2xl">💬</span>
        Bình luận <span className="text-lg font-normal" style={{ color: 'var(--text-muted)' }}>({totalComments})</span>
      </h3>

      {/* Comment Form */}
      {currentUser ? (
        <form onSubmit={handleSubmit} className="card p-5 mb-8">
          {replyTo && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg text-sm" style={{ background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>
              <Reply size={14} />
              <span>Đang trả lời <strong>@{replyTo.username}</strong></span>
              <button type="button" onClick={() => setReplyTo(null)} className="ml-auto">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex gap-3">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.username} className="w-9 h-9 rounded-lg shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                {getInitials(currentUser.username)}
              </div>
            )}
            <div className="flex-1 space-y-3">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Viết bình luận..."
                rows={3}
                className="input resize-none"
                maxLength={1000}
              />
              {imagePreview && (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="preview" className="max-h-32 rounded-lg" />
                  <button
                    type="button"
                    onClick={() => { setImage(null); setImagePreview(null) }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost text-xs px-2 py-1"
                  title="Đính kèm ảnh"
                >
                  <ImageIcon size={15} /> Ảnh
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
                <button
                  type="submit"
                  disabled={submitting || !content.trim()}
                  className="btn-primary text-sm px-4 py-2"
                >
                  {submitting ? <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <><Send size={14} /> Đăng</>}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="card p-5 mb-8 text-center" style={{ color: 'var(--text-secondary)' }}>
          <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Vui lòng <Link to="/login" className="text-blue-400 hover:underline">đăng nhập</Link> để bình luận.</p>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="skeleton w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-28" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          <p className="text-4xl mb-3">💬</p>
          <p>Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment: CommentWithUser) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              onReply={(id, username) => {
                setReplyTo({ id, username })
                textareaRef.current?.focus()
              }}
              onDelete={handleDelete}
              onHide={handleHide}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function CommentItem({
  comment, currentUser, onReply, onDelete, onHide, isReply = false
}: {
  comment: CommentWithUser
  currentUser: { id: string; role: string } | null
  onReply: (id: string, username: string) => void
  onDelete: (id: string) => void
  onHide: (id: string) => void
  isReply?: boolean
}) {
  const isOwn = currentUser?.id === comment.user_id
  const isAdmin = currentUser?.role === 'admin'
  return (
    <div className={`flex gap-3 ${isReply ? 'ml-12 mt-4' : ''}`}>
      {comment.user?.avatar ? (
        <img src={comment.user.avatar} alt={comment.user.username} className="w-9 h-9 rounded-lg shrink-0 object-cover" />
      ) : (
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
          {getInitials(comment.user?.username ?? '?')}
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold">{comment.user?.username ?? 'Không xác định'}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatRelativeDate(comment.created_at)}</span>
        </div>
        <div className="card p-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p className="whitespace-pre-wrap">{comment.content}</p>
          {comment.image_url && (
            <img src={comment.image_url} alt="comment attachment" className="mt-2 max-h-48 rounded-lg" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          {!isReply && currentUser && (
            <button
              onClick={() => onReply(comment.id, comment.user?.username ?? '')}
              className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
            >
              <Reply size={12} /> Trả lời
            </button>
          )}
          {isOwn && (
            <button onClick={() => onDelete(comment.id)} className="btn-ghost text-xs px-2 py-1 flex items-center gap-1" style={{ color: '#f87171' }}>
              <Trash2 size={12} /> Xóa
            </button>
          )}
          {isAdmin && !isOwn && (
            <button onClick={() => onHide(comment.id)} className="btn-ghost text-xs px-2 py-1 flex items-center gap-1" style={{ color: '#fb923c' }}>
              <EyeOff size={12} /> Hide
            </button>
          )}
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-4 pl-4 border-l-2" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUser={currentUser}
                onReply={onReply}
                onDelete={onDelete}
                onHide={onHide}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
