import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, ImageIcon, X, Reply, Trash2, EyeOff, AlertCircle } from 'lucide-react'
import {
  fetchComments,
  fetchCommentReplies,
  fetchCommentCount,
  createComment,
  deleteComment,
  hideComment,
  getCommunityDeviceFingerprint,
  markMediaAssetsReferenced,
  runCommunityGuard,
  uploadCommentImage,
} from '@/services/api'
import type { CommentCursor } from '@/services/api'
import { formatRelativeDate, getInitials } from '@/utils'
import type { CommentWithUser } from '@/types/database'
import toast from 'react-hot-toast'
import { useProcessing } from '@/hooks/useProcessing'
import ConfirmModal from '@/components/ConfirmModal'
import { cloudinaryImageSrcSet, cloudinaryResponsiveImageUrl } from '@/lib/cloudinary'

interface Props {
  postId: string
  currentUser: { id: string; username: string; avatar: string | null; role: string } | null
}

type ReplyTarget = {
  parentId: string
  commentId: string
  userId: string
  username: string
}

export default function CommentSection({ postId, currentUser }: Props) {
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [humanCheckRequired, setHumanCheckRequired] = useState(false)
  const [humanCheck, setHumanCheck] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const startedAt = useRef(Date.now())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const uploadedImageRef = useRef<{ signature: string; url: string; publicId: string } | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const process = useProcessing()
  const draftKey = currentUser ? `football-stories-comment-draft:${postId}:${currentUser.id}` : null

  const commentsQuery = useInfiniteQuery({
    queryKey: ['comments', postId],
    initialPageParam: null as CommentCursor | null,
    queryFn: async ({ pageParam }) => {
      const result = await fetchComments(postId, pageParam)
      if (result.error) throw result.error
      return result
    },
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    retry: 1,
  })
  const { data: commentCount } = useQuery({ queryKey: ['comment-count', postId], queryFn: () => fetchCommentCount(postId) })
  const comments = commentsQuery.data?.pages.flatMap(page => page.data) ?? []
  const isLoading = commentsQuery.isLoading
  const isError = commentsQuery.isError
  const error = commentsQuery.error
  const refetch = commentsQuery.refetch

  useEffect(() => () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  useEffect(() => {
    setDraftReady(false)
    setContent('')
    setReplyTo(null)
    if (!draftKey) return
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? 'null') as { content?: string; replyTo?: ReplyTarget | null } | null
      if (saved?.content) setContent(saved.content)
      if (saved?.replyTo?.parentId) setReplyTo(saved.replyTo)
    } catch {
      localStorage.removeItem(draftKey)
    }
    setDraftReady(true)
  }, [draftKey])

  useEffect(() => {
    if (!draftKey || !draftReady) return
    const timer = window.setTimeout(() => {
      if (content.trim() || replyTo) localStorage.setItem(draftKey, JSON.stringify({ content, replyTo, savedAt: Date.now() }))
      else localStorage.removeItem(draftKey)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [content, draftKey, draftReady, replyTo])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Ảnh phải nhỏ hơn 3 MB'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Chỉ hỗ trợ ảnh JPG, PNG và WebP')
      return
    }
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    uploadedImageRef.current = null
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !content.trim()) return
    setSubmitting(true)
    try {
      const { error } = await process('Đang đăng bình luận...', async () => {
        const guard = await runCommunityGuard({ action: 'comment', fingerprint: getCommunityDeviceFingerprint(), startedAt: startedAt.current, honeypot, humanCheck })
        if (!guard.ok) {
          if (guard.requiresHuman) {
            setHumanCheckRequired(true)
            throw new Error('Vui lòng xác nhận bạn là người dùng thật rồi gửi lại.')
          }
          throw guard.error ?? new Error('Bạn đang thao tác quá nhanh. Vui lòng thử lại sau.')
        }
        let image_url: string | null = null
        let imagePublicId: string | null = null
        if (image) {
          const signature = `${image.name}:${image.size}:${image.lastModified}`
          const cached = uploadedImageRef.current?.signature === signature ? uploadedImageRef.current : null
          const uploaded: { signature: string; url: string; publicId: string } = cached || { signature, ...await uploadCommentImage(image, currentUser.id) }
          uploadedImageRef.current = uploaded
          image_url = uploaded.url
          imagePublicId = uploaded.publicId
        }
        const result = await createComment({
          post_id: postId,
          user_id: currentUser.id,
          content: content.trim(),
          parent_comment_id: replyTo?.parentId ?? null,
          reply_to_comment_id: replyTo?.commentId ?? null,
          reply_to_user_id: replyTo?.userId ?? null,
          reply_to_name: replyTo?.username ?? null,
          image_url,
        })
        if (result.error) throw result.error
        if (imagePublicId && result.data?.id) await markMediaAssetsReferenced([imagePublicId], 'comment', result.data.id)
        return result
      })
      if (error) throw error
      setContent('')
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
      setImage(null)
      setImagePreview(null)
      uploadedImageRef.current = null
      setReplyTo(null)
      setHumanCheckRequired(false)
      setHumanCheck(false)
      startedAt.current = Date.now()
      if (draftKey) localStorage.removeItem(draftKey)
      await qc.invalidateQueries({ queryKey: ['comments', postId] })
      await qc.invalidateQueries({ queryKey: ['comment-replies'] })
      await qc.invalidateQueries({ queryKey: ['comment-count', postId] })
      toast.success('Đã đăng bình luận')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đăng bình luận')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await deleteComment(id)
    if (error) throw error
    await qc.invalidateQueries({ queryKey: ['comments', postId] })
    await qc.invalidateQueries({ queryKey: ['comment-replies'] })
    await qc.invalidateQueries({ queryKey: ['comment-count', postId] })
    toast.success('Đã xóa bình luận')
  }

  const handleHide = async (id: string) => {
    const { error } = await hideComment(id)
    if (error) throw error
    await qc.invalidateQueries({ queryKey: ['comments', postId] })
    await qc.invalidateQueries({ queryKey: ['comment-replies'] })
    await qc.invalidateQueries({ queryKey: ['comment-count', postId] })
    toast.success('Đã ẩn bình luận')
  }

  const totalComments = commentCount?.count ?? comments.length

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
              <button type="button" onClick={() => { setReplyTo(null); textareaRef.current?.focus() }} className="ml-auto inline-flex items-center gap-1 text-xs" title="Bỏ người đang trả lời">
                <X size={14} /> Bỏ trả lời
              </button>
            </div>
          )}
          <div className="flex gap-3">
            {currentUser.avatar ? (
              <img src={cloudinaryResponsiveImageUrl(currentUser.avatar, 96)} alt={currentUser.username} className="w-9 h-9 rounded-lg shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                {getInitials(currentUser.username)}
              </div>
            )}
            <div className="flex-1 space-y-3 min-w-0">
              <input className="comment-honeypot" value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="article-comment-composer">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={replyTo ? `Trả lời @${replyTo.username}...` : 'Viết bình luận...'}
                  rows={2}
                  className="article-comment-input"
                  maxLength={1000}
                />
                <button type="button" onClick={() => fileRef.current?.click()} className="article-comment-tool" title="Đính kèm ảnh" aria-label="Thêm ảnh"><ImageIcon size={17} /></button>
                <button type="submit" disabled={submitting || !content.trim()} className="article-comment-send" aria-label="Đăng bình luận">
                  {submitting ? <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : <Send size={16} />}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
              </div>
              {imagePreview && (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="preview" className="max-h-32 rounded-lg" />
                  <button
                    type="button"
                    onClick={() => { setImage(null); setImagePreview(null); uploadedImageRef.current = null }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <small style={{ color: 'var(--text-muted)' }}>Nội dung được lưu nháp tự động</small>
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
      ) : isError ? (
        <div className="card p-5 text-center" role="alert">
          <AlertCircle size={24} className="mx-auto mb-2" style={{ color: '#f59e0b' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Không thể tải bình luận lúc này{error instanceof Error && error.message ? `: ${error.message}` : '.'}
          </p>
          <button type="button" className="btn-secondary text-sm mt-3" onClick={() => void refetch()}>Thử tải lại</button>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          <p className="text-4xl mb-3">💬</p>
          <p>Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>
        </div>
      ) : (
        <div className="space-y-6 comment-virtual-list">
          {comments.map((comment: CommentWithUser) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              onReply={(target) => {
                setReplyTo(target)
                textareaRef.current?.focus()
              }}
              onDelete={id => setConfirmDeleteId(id)}
                onHide={handleHide}
              postId={postId}
              depth={0}
            />
          ))}
          {commentsQuery.hasNextPage && <button type="button" className="btn-secondary mx-auto mt-5" onClick={() => void commentsQuery.fetchNextPage()} disabled={commentsQuery.isFetchingNextPage}>{commentsQuery.isFetchingNextPage ? 'Đang tải...' : 'Tải thêm bình luận'}</button>}
        </div>
      )}
      {humanCheckRequired && currentUser && <label className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}><input type="checkbox" checked={humanCheck} onChange={event => setHumanCheck(event.target.checked)} /> Tôi xác nhận mình là người dùng thật.</label>}
      {comments.length > 0 && commentCount?.count != null && <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>Đang hiển thị {comments.length} trong tổng số {commentCount.count} bình luận</p>}
      <ConfirmModal open={Boolean(confirmDeleteId)} title="Xóa bình luận?" message="Bình luận sẽ bị xóa khỏi cuộc thảo luận và không thể khôi phục." confirmLabel="Xóa bình luận" onCancel={() => setConfirmDeleteId(null)} onConfirm={() => { if (confirmDeleteId) void handleDelete(confirmDeleteId).finally(() => setConfirmDeleteId(null)) }} />
    </section>
  )
}

function CommentItem({
  comment, currentUser, onReply, onDelete, onHide, postId, depth = 0
}: {
  comment: CommentWithUser
  currentUser: { id: string; role: string } | null
  onReply: (target: ReplyTarget) => void
  onDelete: (id: string) => void
  onHide: (id: string) => void
  postId: string
  depth?: number
}) {
  const isOwn = currentUser?.id === comment.user_id
  const isAdmin = currentUser?.role === 'admin'
  return (
    <div className={`flex gap-3 comment-virtual-item ${depth > 0 ? 'is-comment-reply mt-3' : ''}`}>
      {comment.user?.avatar ? (
        <img src={cloudinaryResponsiveImageUrl(comment.user.avatar, 96)} alt={comment.user.username} className="w-9 h-9 rounded-lg shrink-0 object-cover" />
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
          <p className="whitespace-pre-wrap">{comment.reply_to_name && <strong className="comment-reply-mention">@{comment.reply_to_name} </strong>}{comment.content}</p>
          {comment.image_url && comment.image_status !== 'hidden' && (
            <img src={cloudinaryResponsiveImageUrl(comment.image_url, 720)} srcSet={cloudinaryImageSrcSet(comment.image_url, [320, 480, 720, 960])} sizes="(max-width: 640px) 88vw, 720px" alt="Ảnh đính kèm bình luận" className="mt-2 max-h-48 rounded-lg" loading="lazy" decoding="async" />
          )}
          {comment.image_url && comment.image_status === 'hidden' && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Ảnh đã được đội ngũ kiểm duyệt ẩn.</p>}
        </div>
        <div className="flex items-center gap-3 mt-2">
          {currentUser && (
            <button
              onClick={() => onReply({ parentId: comment.parent_comment_id ?? comment.id, commentId: comment.id, userId: comment.user_id, username: comment.user?.username ?? 'Thành viên' })}
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
              <EyeOff size={12} /> Ẩn
            </button>
          )}
        </div>

        {depth === 0 && (comment.reply_count ?? 0) > 0 && <CommentReplies parentId={comment.id} postId={postId} replyCount={comment.reply_count ?? 0} currentUser={currentUser} onReply={onReply} onDelete={onDelete} onHide={onHide} />}
      </div>
    </div>
  )
}

function CommentReplies({ parentId, postId, replyCount, currentUser, onReply, onDelete, onHide }: {
  parentId: string
  postId: string
  replyCount: number
  currentUser: { id: string; role: string } | null
  onReply: (target: ReplyTarget) => void
  onDelete: (id: string) => void
  onHide: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const query = useInfiniteQuery({
    queryKey: ['comment-replies', postId, parentId],
    initialPageParam: null as CommentCursor | null,
    enabled: expanded,
    queryFn: async ({ pageParam }) => {
      const result = await fetchCommentReplies(parentId, pageParam)
      if (result.error) throw result.error
      return result
    },
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
  })
  const replies = query.data?.pages.flatMap(page => page.data) ?? []

  if (!expanded) return <button type="button" className="btn-ghost text-xs px-1 py-1" onClick={() => setExpanded(true)}>Xem {replyCount} phản hồi</button>
  if (query.isError) return <div className="mt-2 text-xs" style={{ color: '#f59e0b' }}>Không thể tải phản hồi. <button type="button" className="btn-ghost text-xs px-1" onClick={() => void query.refetch()}>Thử lại</button></div>
  return (
    <div className="mt-3 space-y-3 pl-4 border-l-2" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
      <button type="button" className="btn-ghost text-xs px-1" onClick={() => setExpanded(false)}>Ẩn phản hồi</button>
      {query.isLoading && <div className="skeleton h-10 rounded-lg" />}
      {replies.map(reply => <CommentItem key={reply.id} comment={reply} currentUser={currentUser} onReply={onReply} onDelete={onDelete} onHide={onHide} postId={postId} depth={1} />)}
      {!query.isLoading && replies.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Chưa có phản hồi.</p>}
      {query.hasNextPage && <button type="button" className="btn-ghost text-xs" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? 'Đang tải...' : 'Tải thêm phản hồi'}</button>}
    </div>
  )
}
