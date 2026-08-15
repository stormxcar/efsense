import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cloud, Eye, EyeOff, History, ImageOff, MessageCircle, ShieldCheck, Trash2, UserRoundSearch } from 'lucide-react'
import { fetchAdminComments, fetchCommentRevisions, moderateCommentImage, moderateCommentRecord } from '@/services/api'
import { formatRelativeDate } from '@/utils'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ConfirmModal'
import ExpandableText from '@/components/ExpandableText'
import AdminListSearch from '@/components/AdminListSearch'
import type { AdminModerationCommentRow } from '@/types/database'

const PAGE_SIZE = 20

function publicIdentity(comment: AdminModerationCommentRow) {
  if (comment.comment_type !== 'community' || comment.display_name_mode === 'account') return comment.user_username
  if (comment.display_name_mode === 'anonymous') return 'Ẩn danh'
  return comment.display_name?.trim() || 'Biệt danh'
}

function CommentRevisionHistory({ comment }: { comment: AdminModerationCommentRow }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-comment-revisions', comment.comment_type, comment.id],
    queryFn: async () => {
      const result = await fetchCommentRevisions(comment.comment_type, comment.id)
      if (result.error) throw result.error
      return result.data
    },
    enabled: open && comment.revision_count > 0,
  })

  if (comment.revision_count === 0) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}><History size={12} className="inline mr-1" />Chưa có lần chỉnh sửa</span>
  return <div className="admin-comment-revisions">
    <button type="button" className="btn-ghost text-xs px-2 py-1" onClick={() => setOpen(value => !value)}><History size={13} /> {open ? 'Ẩn lịch sử' : `Lịch sử chỉnh sửa (${comment.revision_count})`}</button>
    {open && <div className="admin-comment-revision-list">
      {isLoading ? <div className="skeleton h-16 rounded-lg" /> : error ? <p className="text-xs text-red-400">Không thể tải lịch sử chỉnh sửa.</p> : data?.map(revision => <div key={revision.id} className="admin-comment-revision-item">
        <div><strong>{formatRelativeDate(revision.created_at)}</strong><span> · người sửa {revision.editor_id ? revision.editor_id.slice(0, 8) : 'Hệ thống'}</span></div>
        {revision.old_content !== revision.new_content && <><small>Nội dung trước</small><p>{revision.old_content || 'Không có nội dung'}</p><small>Nội dung sau</small><p>{revision.new_content || 'Không có nội dung'}</p></>}
        {revision.old_image_url !== revision.new_image_url && <small>Ảnh đính kèm đã được thay đổi.</small>}
      </div>)}
    </div>}
  </div>
}

export default function AdminComments() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'post' | 'community'>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'post' | 'community' } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-comments', page, filter, typeFilter, search, sort],
    queryFn: async () => {
      const result = await fetchAdminComments({
        page,
        limit: PAGE_SIZE,
        status: filter === 'all' ? undefined : filter,
        commentType: typeFilter === 'all' ? undefined : typeFilter,
        search,
        sort,
      })
      if (result.error) throw result.error
      return result.data
    },
  })
  const comments = data ?? []
  const total = Number(comments[0]?.total_count ?? 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const recordMutation = useMutation({
    mutationFn: async ({ comment, action }: { comment: AdminModerationCommentRow; action: 'hide' | 'restore' | 'delete' }) => {
      const result = await moderateCommentRecord(comment.comment_type, comment.id, action)
      if (result.error) throw result.error
    },
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ['admin-comments'] })
      setConfirmDelete(null)
      toast.success(variables.action === 'delete' ? 'Đã xóa bình luận' : variables.action === 'hide' ? 'Đã ẩn bình luận' : 'Đã khôi phục bình luận')
    },
    onError: (mutationError: unknown) => toast.error(mutationError instanceof Error ? mutationError.message : 'Không thể kiểm duyệt bình luận'),
  })

  const imageMutation = useMutation({
    mutationFn: async ({ comment, hidden }: { comment: AdminModerationCommentRow; hidden: boolean }) => {
      const result = await moderateCommentImage(comment.comment_type, comment.id, hidden)
      if (result.error) throw result.error
    },
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ['admin-comments'] })
      toast.success(variables.hidden ? 'Đã ẩn ảnh, nội dung bình luận vẫn được giữ lại' : 'Đã khôi phục ảnh bình luận')
    },
    onError: (mutationError: unknown) => toast.error(mutationError instanceof Error ? mutationError.message : 'Không thể kiểm duyệt ảnh'),
  })

  const deletingComment = comments.find(comment => comment.id === confirmDelete?.id && comment.comment_type === confirmDelete.type)

  return <div className="p-5 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div><h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Kiểm duyệt bình luận</h1><p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Quản lý nội dung, ảnh đính kèm và danh tính thật phía sau bình luận ẩn danh.</p></div>
      <div className="admin-comments-total"><MessageCircle size={15} /><strong>{total}</strong><span>bình luận phù hợp</span></div>
    </div>

    <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
      <AdminListSearch value={search} onChange={value => { setSearch(value); setPage(1) }} placeholder="Tìm nội dung, người đăng, email..." storageKey="football-stories-admin-comments-search" suggestions={['Ẩn danh', 'eFootball', 'ảnh bình luận']} />
      <select value={typeFilter} onChange={event => { setTypeFilter(event.target.value as typeof typeFilter); setPage(1) }} className="input h-9 w-auto text-sm" aria-label="Lọc nguồn bình luận"><option value="all">Tất cả nguồn</option><option value="post">Bài viết tạp chí</option><option value="community">Cộng đồng eFootball</option></select>
      <select value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(1) }} className="input h-9 w-auto text-sm" aria-label="Lọc trạng thái bình luận"><option value="all">Tất cả trạng thái</option><option value="visible">Đang hiển thị</option><option value="hidden">Đã ẩn</option></select>
      <select value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(1) }} className="input h-9 w-auto text-sm" aria-label="Sắp xếp bình luận"><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select>
    </div>

    {error ? <div className="empty-state"><h2>Không thể tải bình luận</h2><p>Kiểm tra quyền kiểm duyệt và thử lại.</p></div> : isLoading ? <div className="space-y-2">{[1, 2, 3, 4].map(item => <div key={item} className="skeleton h-28 rounded-xl" />)}</div> : comments.length === 0 ? <div className="empty-state"><MessageCircle size={28} className="mx-auto mb-3" /><h2>Không có bình luận phù hợp</h2><p>Thử thay đổi bộ lọc hoặc từ khóa.</p></div> : <div className="space-y-2">
      {comments.map(comment => {
        const displayedName = publicIdentity(comment)
        const targetHref = comment.comment_type === 'post' && comment.target_slug ? `/posts/${comment.target_slug}` : `/cong-dong#community-${comment.target_id}`
        return <article key={`${comment.comment_type}-${comment.id}`} className={`card admin-comment-card ${comment.status === 'hidden' ? 'is-hidden' : ''}`}>
          <div className="admin-comment-card-head">
            <div className="admin-comment-source"><span className={`badge text-xs ${comment.comment_type === 'community' ? 'badge-green' : 'badge-blue'}`}>{comment.comment_type === 'community' ? 'Cộng đồng' : 'Bài viết'}</span>{comment.parent_comment_id && <span className="badge text-xs">Phản hồi</span>}<span className={`badge text-xs ${comment.status === 'visible' ? 'badge-green' : 'badge-orange'}`}>{comment.status === 'visible' ? 'Đang hiển thị' : 'Đã ẩn'}</span></div>
            <time>{formatRelativeDate(comment.created_at)}</time>
          </div>
          <div className={`admin-comment-grid ${comment.image_url ? 'has-media' : ''}`}>
            <div className="admin-comment-main">
              <div className="admin-comment-identity"><UserRoundSearch size={17} /><div><strong>Hiển thị công khai: {displayedName}</strong><p>Tài khoản thật: {comment.user_username} · {comment.user_email}</p>{comment.display_name_mode !== 'account' && <small>{comment.display_name_mode === 'anonymous' ? 'Người dùng chọn chế độ ẩn danh' : `Biệt danh đã chọn: ${comment.display_name}`}</small>}</div></div>
              <ExpandableText text={comment.content} className="admin-comment-content" label="nội dung bình luận" />
              <Link to={targetHref} className="admin-comment-target">Trong: {comment.target_title}</Link>
              <CommentRevisionHistory comment={comment} />
            </div>
            {comment.image_url && <aside className={`admin-comment-media ${comment.image_status === 'hidden' ? 'is-hidden' : ''}`}>
              <div className="admin-comment-image-wrap"><img src={comment.image_url} alt="Ảnh trong bình luận cần kiểm duyệt" loading="lazy" />{comment.image_status === 'hidden' && <span><ImageOff size={18} /> Đang bị ẩn với người dùng</span>}</div>
              <div className="admin-comment-media-source"><Cloud size={14} /><div><strong>Nguồn Cloudinary</strong><p>{comment.media_public_id ?? 'Chưa khớp public ID trong media registry'}</p><small>{comment.media_folder ?? 'Không xác định thư mục'}</small></div></div>
              <button type="button" className="btn-secondary text-xs w-full" disabled={imageMutation.isPending} onClick={() => imageMutation.mutate({ comment, hidden: comment.image_status !== 'hidden' })}>{comment.image_status === 'hidden' ? <><Eye size={14} /> Hiện lại ảnh</> : <><ImageOff size={14} /> Ẩn riêng ảnh</>}</button>
            </aside>}
          </div>
          <div className="admin-comment-actions">
            {comment.status === 'visible' ? <button type="button" className="btn-ghost text-xs" onClick={() => recordMutation.mutate({ comment, action: 'hide' })}><EyeOff size={14} /> Ẩn toàn bộ bình luận</button> : <button type="button" className="btn-ghost text-xs" onClick={() => recordMutation.mutate({ comment, action: 'restore' })}><ShieldCheck size={14} /> Khôi phục bình luận</button>}
            <button type="button" className="btn-ghost text-xs text-red-400" onClick={() => setConfirmDelete({ id: comment.id, type: comment.comment_type })}><Trash2 size={14} /> Xóa</button>
          </div>
        </article>
      })}
    </div>}

    {totalPages > 1 && <nav className="admin-pagination" aria-label="Phân trang bình luận"><button type="button" className="btn-secondary text-sm" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Trang trước</button><span>Trang {page}/{totalPages} · {total} kết quả</span><button type="button" className="btn-secondary text-sm" disabled={page >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Trang sau</button></nav>}
    <ConfirmModal open={Boolean(confirmDelete)} title="Xóa bình luận?" message="Bình luận, ảnh và các phản hồi con liên quan có thể bị xóa vĩnh viễn. Nhật ký quản trị vẫn lưu lại thao tác này." confirmLabel="Xóa bình luận" loading={recordMutation.isPending} onCancel={() => setConfirmDelete(null)} onConfirm={() => { if (deletingComment) recordMutation.mutate({ comment: deletingComment, action: 'delete' }) }} />
  </div>
}
