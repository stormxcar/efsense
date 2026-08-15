import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type TouchEvent, type WheelEvent } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { Heart, MessageCircle, ImagePlus, Video, Send, Users, Swords, ShieldCheck, Sparkles, Bookmark, Share2, Flag, UserPlus, VolumeX, Volume2, Ban, MoreHorizontal, X, Plus, ListChecks, CheckCircle2, Vote, Gamepad2, Zap, Radio, Pencil, SlidersHorizontal, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Trash2, Reply } from 'lucide-react'
import toast from 'react-hot-toast'
import Reveal from '@/components/Reveal'
import AdminListSearch from '@/components/AdminListSearch'
import ConfirmModal from '@/components/ConfirmModal'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { useProcessing } from '@/hooks/useProcessing'
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunityPost,
  fetchCommunityComments,
  fetchCommunityCommentReactionData,
  fetchCommunityReactionState,
  fetchCommunityBookmarkState,
  fetchCommunityUserRelations,
  fetchCommunityPosts,
  fetchCommunityTags,
  fetchCommunityPollVote,
  fetchCommunityPollVotes,
  communityTagSlug,
  submitContentReport,
  setCommunityReaction,
  setCommunityCommentReaction,
  toggleCommunityBookmark,
  toggleCommunityUserRelation,
  uploadCommunityMedia,
  updateCommunityPost,
  voteCommunityPoll,
} from '@/services/api'
import { validateImageFile, validateVideoDuration, validateVideoFile } from '@/lib/cloudinary'
import type { CommunityCommentWithUser, CommunityPostMedia, CommunityPostWithDetails, CommunityReactionSummary, CommunityReactionType } from '@/types/database'
import { formatRelativeDate, getInitials } from '@/utils'

type FeedType = 'all' | 'discussion' | 'reel' | 'showcase'
type CommunityView = FeedType | 'mine' | 'liked' | 'bookmarked' | 'voted'
type CommunitySort = 'newest' | 'oldest' | 'popular'

const communityReactionOptions: Array<{ value: CommunityReactionType; emoji: string; label: string }> = [
  { value: 'like', emoji: '👍', label: 'Thích' },
  { value: 'love', emoji: '❤️', label: 'Yêu thích' },
  { value: 'haha', emoji: '😂', label: 'Haha' },
  { value: 'wow', emoji: '😮', label: 'Wow' },
  { value: 'sad', emoji: '😢', label: 'Buồn' },
  { value: 'angry', emoji: '😡', label: 'Phẫn nộ' },
]

function communityReactionMeta(value: CommunityReactionType | null | undefined) {
  return communityReactionOptions.find(option => option.value === value) ?? null
}

const feedLabels: Record<FeedType, string> = {
  all: 'Dòng thời gian',
  discussion: 'Thảo luận',
  reel: 'Reels',
  showcase: 'Đội hình & chiến thuật',
}

const communityNavigation: Array<{ id: CommunityView; label: string; icon: typeof Sparkles }> = [
  { id: 'all', label: 'Dòng thời gian', icon: Sparkles },
  { id: 'discussion', label: 'Thảo luận', icon: MessageCircle },
  { id: 'reel', label: 'Reels', icon: Video },
  { id: 'showcase', label: 'Đội hình & chiến thuật', icon: Swords },
  { id: 'mine', label: 'Bài viết của tôi', icon: Pencil },
  { id: 'liked', label: 'Bài đã thích', icon: Heart },
  { id: 'bookmarked', label: 'Bài đã lưu', icon: Bookmark },
  { id: 'voted', label: 'Bài đã bình chọn', icon: Vote },
]

const typeLabels = {
  discussion: 'Thảo luận',
  reel: 'Reels',
  showcase: 'Đội hình & chiến thuật',
} as const

function Avatar({ username, avatar }: { username: string; avatar?: string | null }) {
  return avatar
    ? <img src={avatar} alt={username} className="community-avatar" loading="lazy" />
    : <span className="community-avatar community-avatar-fallback">{getInitials(username)}</span>
}

function renderHashtags(content: string) {
  return content.split(/(#[\p{L}\p{N}_-]+)/u).map((part, index) => part.startsWith('#')
    ? <Link key={`${part}-${index}`} to={`/cong-dong?tag=${encodeURIComponent(communityTagSlug(part.slice(1)))}`} className="community-hashtag">{part}</Link>
    : <span key={`${part}-${index}`}>{part}</span>)
}

function normalizeDraftTags(tags: string[]) {
  const seen = new Set<string>()
  return tags.map(tag => tag.replace(/^#+/, '').trim().replace(/\s+/g, ' ')).filter(tag => {
    const slug = communityTagSlug(tag)
    if (!slug || seen.has(slug)) return false
    seen.add(slug)
    return true
  }).slice(0, 8)
}

function extractContentTags(content: string) {
  return [...content.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(match => match[1])
}

function looksLikeVideoSource(value: string) {
  return /(?:\/video\/upload\/|\.(?:mp4|webm|mov|m4v)(?:[?#]|$))/i.test(value)
}

function CommunityComposer({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth()
  const process = useProcessing()
  const [postType, setPostType] = useState<Exclude<FeedType, 'all'>>('discussion')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [gameVersion, setGameVersion] = useState('eFootball 2026')
  const [tactic, setTactic] = useState('')
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([])
  const [pollEnabled, setPollEnabled] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  useEffect(() => () => {
    mediaPreviews.filter(preview => preview.startsWith('blob:')).forEach(preview => URL.revokeObjectURL(preview))
  }, [mediaPreviews])

  if (!user) {
    return (
      <section className="community-login-card">
        <div className="community-login-icon"><Users size={22} /></div>
        <div>
          <h2>Tham gia cuộc trò chuyện eFootball</h2>
          <p>Đăng nhập để chia sẻ đội hình, bàn luận meta và đăng Reels của bạn.</p>
        </div>
        <Link to="/login" className="btn-primary">Đăng nhập để đăng bài</Link>
      </section>
    )
  }

  const handleFiles = (fileList: FileList | undefined) => {
    const files = Array.from(fileList ?? [])
    if (!files.length) return
    try {
      if (files.length > 10) throw new Error('Mỗi bài đăng chỉ được chọn tối đa 10 ảnh.')
      const videos = files.filter(file => file.type.startsWith('video/'))
      if (postType === 'reel' && (files.length !== 1 || videos.length !== 1)) throw new Error('Reels chỉ nhận một tệp video.')
      if (videos.length > 1 || (videos.length === 1 && files.length > 1)) throw new Error('Video cần đăng riêng, không thể trộn cùng nhiều ảnh.')
      files.forEach(file => file.type.startsWith('video/') ? validateVideoFile(file) : validateImageFile(file))
      setMediaFiles(files)
      setMediaUrls([])
      setMediaPreviews(files.map(file => URL.createObjectURL(file)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tệp không hợp lệ')
    }
  }

  const handleMediaUrls = (value: string) => {
    const urls = value.split(/[\n,]+/).map(item => item.trim()).filter(Boolean).slice(0, 10)
    setMediaUrls(urls)
    setMediaFiles([])
    setMediaPreviews(urls)
  }

  const removeMedia = (index: number) => {
    const removed = mediaPreviews[index]
    if (removed?.startsWith('blob:')) URL.revokeObjectURL(removed)
    setMediaFiles(current => current.filter((_, itemIndex) => itemIndex !== index))
    setMediaUrls(current => current.filter((_, itemIndex) => itemIndex !== index))
    setMediaPreviews(current => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const addDraftTags = () => {
    if (!tagInput.trim()) return
    setTags(current => normalizeDraftTags([...current, ...tagInput.split(',')]))
    setTagInput('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedTags = normalizeDraftTags([...tags, ...tagInput.split(','), ...extractContentTags(content)])
    if (postType === 'reel' && !mediaFiles.length && !mediaUrls.length) return toast.error('Reels cần có video tải lên hoặc URL video.')
    if (postType === 'reel' && (mediaFiles.length !== 1 && mediaUrls.length !== 1)) return toast.error('Reels chỉ nhận một video.')
    if (postType === 'reel' && mediaUrls.length === 1 && !looksLikeVideoSource(mediaUrls[0])) return toast.error('URL Reels phải là một video hợp lệ.')
    if (mediaUrls.filter(looksLikeVideoSource).length > 1 || (mediaUrls.some(looksLikeVideoSource) && mediaUrls.length > 1)) return toast.error('Video cần đăng riêng, không thể trộn cùng nhiều ảnh.')
    const normalizedPollOptions = pollOptions.map(option => option.trim()).filter(Boolean)
    if (pollEnabled && postType !== 'discussion') return toast.error('Bình chọn chỉ dành cho bài thảo luận.')
    if (pollEnabled && pollQuestion.trim().length < 3) return toast.error('Câu hỏi bình chọn cần ít nhất 3 ký tự.')
    if (pollEnabled && normalizedPollOptions.length < 2) return toast.error('Bình chọn cần ít nhất 2 phương án.')
    if (pollEnabled && new Set(normalizedPollOptions.map(option => option.toLocaleLowerCase('vi'))).size !== normalizedPollOptions.length) return toast.error('Các phương án bình chọn không được trùng nhau.')
    if (!title.trim() && !content.trim() && !mediaFiles.length && !mediaUrls.length && !pollEnabled) return toast.error('Hãy thêm nội dung, media hoặc bình chọn trước khi đăng.')

    await process('Đang xuất bản bài đăng cộng đồng...', async () => {
      const uploadedMedia: Array<{ media_type: 'image' | 'video'; media_url: string; media_public_id: string | null; thumbnail_url: string | null; alt: string | null; sort_order: number }> = []
      for (const [index, file] of mediaFiles.entries()) {
        const isVideo = file.type.startsWith('video/')
        if (isVideo) await validateVideoDuration(file)
        const uploaded = await uploadCommunityMedia(file, isVideo ? 'video' : 'image')
        uploadedMedia.push({ media_type: isVideo ? 'video' : 'image', media_url: uploaded.url, media_public_id: uploaded.publicId ?? null, thumbnail_url: uploaded.thumbnailUrl ?? null, alt: title.trim() || `Media cộng đồng ${index + 1}`, sort_order: index })
      }
      for (const [index, url] of mediaUrls.entries()) {
        const isVideo = looksLikeVideoSource(url)
        const uploaded = await uploadCommunityMedia(url, isVideo ? 'video' : 'image')
        uploadedMedia.push({ media_type: isVideo ? 'video' : 'image', media_url: uploaded.url ?? url, media_public_id: uploaded.publicId ?? null, thumbnail_url: uploaded.thumbnailUrl ?? null, alt: title.trim() || `Media cộng đồng ${index + 1}`, sort_order: index })
      }
      const primary = uploadedMedia[0]

      const { error } = await createCommunityPost({
        author_id: user.id,
        post_type: postType,
        title,
        content,
        game_version: gameVersion,
        tactic,
        media_url: primary?.media_url ?? null,
        media_public_id: primary?.media_public_id ?? null,
        media_type: primary?.media_type ?? null,
        thumbnail_url: primary?.thumbnail_url ?? null,
        media: uploadedMedia,
        tags: normalizedTags,
        poll: pollEnabled ? { question: pollQuestion.trim(), options: normalizedPollOptions } : null,
      })
      if (error) throw error
      setTitle('')
      setContent('')
      setTactic('')
      setMediaUrls([])
      setMediaFiles([])
      setMediaPreviews([])
      setPollEnabled(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      setTags([])
      setTagInput('')
      toast.success('Bài đăng đã gửi vào hàng đợi kiểm duyệt')
      onCreated()
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể đăng bài lúc này'))
  }

  return (
    <form className="community-composer" onSubmit={handleSubmit}>
      <div className="community-composer-head">
        <Avatar username={user.username} avatar={user.avatar} />
        <div>
          <strong>Chia sẻ với cộng đồng</strong>
          <span>Meta, đội hình, khoảnh khắc trận đấu hoặc một câu hỏi bạn đang muốn giải.</span>
        </div>
      </div>
      <div className="community-composer-tabs" role="tablist" aria-label="Loại bài đăng">
        {(Object.keys(typeLabels) as Array<Exclude<FeedType, 'all'>>).map(type => (
          <button key={type} type="button" className={postType === type ? 'active' : ''} onClick={() => { setPostType(type); if (type !== 'discussion') setPollEnabled(false) }}>
            {type === 'reel' ? <Video size={15} /> : type === 'showcase' ? <Swords size={15} /> : <MessageCircle size={15} />}
            {typeLabels[type]}
          </button>
        ))}
      </div>
      <div className="community-composer-grid">
        <input className="input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Tiêu đề ngắn (không bắt buộc)" maxLength={120} />
        <input className="input" value={gameVersion} onChange={event => setGameVersion(event.target.value)} placeholder="Phiên bản game" maxLength={80} />
      </div>
      <textarea className="input community-composer-textarea" value={content} onChange={event => setContent(event.target.value)} placeholder={postType === 'showcase' ? 'Mô tả cách vận hành đội hình (không bắt buộc)...' : postType === 'reel' ? 'Mô tả ngắn cho Reels (không bắt buộc)...' : 'Chia sẻ nội dung hoặc câu hỏi (không bắt buộc)...'} maxLength={5000} rows={4} />
      {postType === 'showcase' && <input className="input" value={tactic} onChange={event => setTactic(event.target.value)} placeholder="Từ khóa chiến thuật, ví dụ: 4-2-3-1, phản công nhanh" maxLength={120} />}
      <div className="community-tag-editor">
        <div className="community-tag-editor-row"><input className="input" value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addDraftTags() } }} onBlur={addDraftTags} placeholder="Thêm tag, ngăn cách bằng dấu phẩy (không bắt buộc)" maxLength={240} /><button type="button" className="btn-ghost p-2" onClick={addDraftTags} aria-label="Thêm tag"><Plus size={15} /></button></div>
        {tags.length > 0 && <div className="community-tag-list">{tags.map(tag => <button key={communityTagSlug(tag)} type="button" className="community-tag-chip" onClick={() => setTags(current => current.filter(item => communityTagSlug(item) !== communityTagSlug(tag)))} >#{tag}<X size={12} /></button>)}</div>}
      </div>
      {postType === 'discussion' && <div className={`community-poll-builder ${pollEnabled ? 'is-active' : ''}`}>
        <button type="button" className="community-poll-toggle" onClick={() => setPollEnabled(value => !value)}><ListChecks size={16} /> {pollEnabled ? 'Bỏ bình chọn' : 'Thêm bình chọn'}</button>
        {pollEnabled && <div className="community-poll-builder-fields">
          <input className="input" value={pollQuestion} onChange={event => setPollQuestion(event.target.value)} placeholder="Câu hỏi bình chọn, ví dụ: Sơ đồ nào hiệu quả nhất phiên bản này?" maxLength={240} />
          <div className="community-poll-options-editor">{pollOptions.map((option, index) => <div key={index} className="community-poll-option-editor"><input className="input" value={option} onChange={event => setPollOptions(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Phương án ${index + 1}`} maxLength={120} />{pollOptions.length > 2 && <button type="button" className="btn-ghost p-2" onClick={() => setPollOptions(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Xóa phương án ${index + 1}`}><X size={14} /></button>}</div>)}</div>
          {pollOptions.length < 6 && <button type="button" className="btn-ghost community-add-poll-option" onClick={() => setPollOptions(current => [...current, ''])}><Plus size={14} /> Thêm phương án</button>}
        </div>}
      </div>}
      <div className="community-media-row">
        <label className="community-file-button">
          <ImagePlus size={17} /> {mediaFiles.length ? `${mediaFiles.length} tệp đã chọn` : postType === 'reel' ? 'Chọn video Reels' : 'Chọn một hoặc nhiều ảnh'}
          <input type="file" multiple={postType !== 'reel'} accept={postType === 'reel' ? 'video/*' : 'image/*,video/*'} onChange={event => { handleFiles(event.target.files ?? undefined); event.currentTarget.value = '' }} hidden />
        </label>
        <textarea className="input community-media-url-input" value={mediaUrls.join('\n')} onChange={event => handleMediaUrls(event.target.value)} placeholder={postType === 'reel' ? 'Hoặc dán URL video' : 'Dán một hoặc nhiều URL ảnh (mỗi URL một dòng)'} inputMode="url" rows={2} />
        <button className="btn-primary community-submit-button" type="submit"><Send size={16} /> Đăng bài</button>
      </div>
      {mediaPreviews.length > 0 && <div className="community-upload-preview"><div className="community-upload-preview-label">Xem trước media · {mediaPreviews.length} mục</div><div className="community-upload-preview-grid">{mediaPreviews.map((preview, index) => <div key={`${preview}-${index}`} className="community-upload-preview-item">{mediaFiles[index]?.type.startsWith('video/') || looksLikeVideoSource(preview) ? <video src={preview || undefined} className="community-upload-preview-media" controls muted playsInline /> : <img src={preview || undefined} alt={`Xem trước media ${index + 1}`} className="community-upload-preview-media" loading="lazy" />}<button type="button" className="community-upload-preview-remove" onClick={() => removeMedia(index)} aria-label={`Xóa media ${index + 1}`}><X size={14} /></button></div>)}</div></div>}
      <p className="community-helper"><ShieldCheck size={14} /> Video Reels tối đa 60 MB và 60 giây. Cloudinary tự tạo thumbnail khi video được lưu.</p>
    </form>
  )
}

type CommunityCommentDisplayMode = 'account' | 'anonymous' | 'alias'

function getCommunityCommentIdentity(comment: CommunityCommentWithUser) {
  const mode = comment.display_name_mode ?? 'account'
  if (mode === 'anonymous') return { name: 'Ẩn danh', mode }
  if (mode === 'alias' && comment.display_name?.trim()) return { name: comment.display_name.trim(), mode }
  return { name: comment.user?.username ?? 'Thành viên', mode: 'account' as const }
}

function nestCommunityComments(comments: CommunityCommentWithUser[]) {
  const nodes = comments.map(comment => ({ ...comment, replies: [] as CommunityCommentWithUser[] }))
  const byId = new Map(nodes.map(comment => [comment.id, comment]))
  const roots: CommunityCommentWithUser[] = []
  for (const comment of nodes) {
    const parent = comment.parent_comment_id ? byId.get(comment.parent_comment_id) : null
    if (parent) parent.replies?.push(comment)
    else roots.push(comment)
  }
  return roots
}

function CommunityComments({ postId, poll }: { postId: string; poll?: NonNullable<CommunityPostWithDetails['poll']> | null }) {
  const { user } = useAuth()
  const process = useProcessing()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [displayNameMode, setDisplayNameMode] = useState<CommunityCommentDisplayMode>('account')
  const [displayName, setDisplayName] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data, isLoading } = useQuery({ queryKey: ['community-comments', postId], queryFn: () => fetchCommunityComments(postId) })
  const { data: pollVotes } = useQuery({ queryKey: ['community-poll-votes', postId], queryFn: () => fetchCommunityPollVotes(postId), enabled: Boolean(poll) })
  const commentIds = data?.data?.map(comment => comment.id) ?? []
  const { data: commentReactionData } = useQuery({
    queryKey: ['community-comment-reactions', postId, user?.id, commentIds.join(',')],
    queryFn: async () => {
      const result = await fetchCommunityCommentReactionData(commentIds, user?.id)
      if (result.error) throw result.error
      return result
    },
    enabled: commentIds.length > 0,
  })
  const commentReactionCounts = new Map<string, CommunityReactionSummary[]>()
  for (const item of commentReactionData?.counts ?? []) {
    const current = commentReactionCounts.get(item.comment_id) ?? []
    current.push({ reaction: item.reaction, count: Number(item.count) })
    commentReactionCounts.set(item.comment_id, current)
  }
  const commentReactionByUser = new Map((commentReactionData?.mine ?? []).map(item => [item.comment_id, item.reaction]))
  const commentReactionMutation = useMutation({
    mutationFn: ({ commentId, reaction }: { commentId: string; reaction: CommunityReactionType | null }) => {
      if (!user) throw new Error('Bạn cần đăng nhập để thả cảm xúc.')
      return setCommunityCommentReaction(commentId, user.id, reaction)
    },
    onSuccess: async ({ error }) => {
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['community-comment-reactions', postId] })
    },
  })
  const comments = nestCommunityComments(data?.data ?? [])
  const optionLabels = new Map((poll?.options ?? []).map(option => [option.id, option.label]))
  const voteByUserId = new Map((pollVotes?.data ?? []).map(vote => [vote.user_id, optionLabels.get(vote.option_id)]))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return toast.error('Bạn cần đăng nhập để bình luận.')
    if (!content.trim()) return
    const alias = displayName.trim()
    if (displayNameMode === 'alias' && (alias.length < 2 || alias.length > 32)) return toast.error('Biệt danh phải dài từ 2 đến 32 ký tự.')
    await process('Đang gửi bình luận...', async () => {
      const { error } = await createCommunityComment({ post_id: postId, user_id: user.id, content, parent_comment_id: replyTo?.id ?? null, display_name_mode: displayNameMode, display_name: displayNameMode === 'alias' ? alias : null })
      if (error) throw error
      setContent('')
      setReplyTo(null)
      await queryClient.invalidateQueries({ queryKey: ['community-comments', postId] })
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể gửi bình luận'))
  }

  return (
    <div className="community-comments">
      {isLoading ? <div className="skeleton h-10" /> : comments.map(comment => <CommunityCommentItem key={comment.id} comment={comment} currentUser={user} voteByUserId={voteByUserId} reactionCountsByComment={commentReactionCounts} reactionByComment={commentReactionByUser} onReact={(commentId, reaction) => { if (!user) return toast.error('Đăng nhập để thả cảm xúc.'); void process('Đang cập nhật cảm xúc bình luận...', () => commentReactionMutation.mutateAsync({ commentId, reaction })).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật cảm xúc bình luận')) }} onReply={(id, name) => { setReplyTo({ id, name }); inputRef.current?.focus() }} />)}
      {user ? (
        <form className="community-comment-form" onSubmit={handleSubmit}>
          <Avatar username={displayNameMode === 'anonymous' ? 'Ẩn danh' : displayNameMode === 'alias' && displayName.trim() ? displayName.trim() : user.username} avatar={displayNameMode === 'account' ? user.avatar : null} />
          <div className="community-comment-form-fields">
            {replyTo && <div className="community-comment-replying"><Reply size={13} /> Đang trả lời <strong>{replyTo.name}</strong><button type="button" className="btn-ghost p-1" onClick={() => setReplyTo(null)} aria-label="Hủy trả lời"><X size={13} /></button></div>}
            <input ref={inputRef} className="input" value={content} onChange={event => setContent(event.target.value)} placeholder={replyTo ? `Trả lời ${replyTo.name}...` : 'Viết bình luận...'} maxLength={1000} />
            <div className="community-comment-identity-picker">
              <label htmlFor={`comment-identity-${postId}`}>Hiển thị với</label>
              <select id={`comment-identity-${postId}`} className="input" value={displayNameMode} onChange={event => setDisplayNameMode(event.target.value as CommunityCommentDisplayMode)}>
                <option value="account">Tên tài khoản</option>
                <option value="anonymous">Ẩn danh</option>
                <option value="alias">Biệt danh tùy chọn</option>
              </select>
              {displayNameMode === 'alias' && <input className="input" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Nhập biệt danh (2 đến 32 ký tự)" maxLength={32} />}
            </div>
            <small className="community-comment-identity-help">Tên tài khoản vẫn được lưu để kiểm duyệt, nhưng chỉ cách hiển thị bạn chọn mới xuất hiện công khai.</small>
          </div>
          <button className="btn-ghost p-2 community-comment-submit" type="submit" aria-label="Gửi bình luận"><Send size={16} /></button>
        </form>
      ) : <Link to="/login" className="community-login-link">Đăng nhập để tham gia bình luận</Link>}
    </div>
  )
}

function CommunityCommentItem({ comment, currentUser, voteByUserId, reactionCountsByComment, reactionByComment, onReact, onReply, depth = 0 }: { comment: CommunityCommentWithUser; currentUser: ReturnType<typeof useAuth>['user']; voteByUserId: Map<string, string | undefined>; reactionCountsByComment: Map<string, CommunityReactionSummary[]>; reactionByComment: Map<string, CommunityReactionType>; onReact: (commentId: string, reaction: CommunityReactionType | null) => void; onReply: (id: string, name: string) => void; depth?: number }) {
  const identity = getCommunityCommentIdentity(comment)
  const voteLabel = voteByUserId.get(comment.user_id)
  return <div className={`community-comment ${depth > 0 ? 'is-reply' : ''}`}>
    <Avatar username={identity.name} avatar={identity.mode === 'account' ? comment.user?.avatar : null} />
    <div>
      <div className="community-comment-author"><strong>{identity.name}</strong>{identity.mode !== 'account' && <small className="community-comment-identity-label">{identity.mode === 'anonymous' ? 'Ẩn danh' : 'Biệt danh'}</small>}</div>
      {voteLabel && <small className="community-comment-vote"><Vote size={12} /> Đã chọn: {voteLabel}</small>}
      <p>{comment.content}</p>
      <div className="community-comment-meta"><CommunityReactionPicker currentReaction={reactionByComment.get(comment.id) ?? null} counts={reactionCountsByComment.get(comment.id) ?? []} onSelect={reaction => onReact(comment.id, reaction)} /><small>{formatRelativeDate(comment.created_at)}</small>{currentUser && <button type="button" className="btn-ghost p-1" onClick={() => onReply(comment.id, identity.name)}><Reply size={12} /> Trả lời</button>}</div>
      {comment.replies && comment.replies.length > 0 && <div className="community-comment-replies">{comment.replies.map(reply => <CommunityCommentItem key={reply.id} comment={reply} currentUser={currentUser} voteByUserId={voteByUserId} reactionCountsByComment={reactionCountsByComment} reactionByComment={reactionByComment} onReact={onReact} onReply={onReply} depth={depth + 1} />)}</div>}
    </div>
  </div>
}

function CommunityPollCard({ postId, poll, userId }: { postId: string; poll: NonNullable<CommunityPostWithDetails['poll']>; userId?: string }) {
  const process = useProcessing()
  const queryClient = useQueryClient()
  const { data: userVote } = useQuery({
    queryKey: ['community-poll-vote', postId, userId],
    queryFn: () => fetchCommunityPollVote(postId, userId),
    enabled: Boolean(userId),
  })
  const voteMutation = useMutation({
    mutationFn: (optionId: string) => {
      if (!userId) throw new Error('Bạn cần đăng nhập để bình chọn.')
      return voteCommunityPoll(postId, optionId, userId)
    },
    onSuccess: async ({ error }) => {
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      await queryClient.invalidateQueries({ queryKey: ['community-poll-vote', postId, userId] })
      await queryClient.invalidateQueries({ queryKey: ['community-poll-votes', postId] })
      toast.success('Lựa chọn của bạn đã được ghi nhận')
    },
  })
  const totalVotes = poll.options.reduce((total, option) => total + (option.votes?.[0]?.count ?? 0), 0)
  const options = [...poll.options].sort((left, right) => left.sort_order - right.sort_order)
  const [now] = useState(() => Date.now())
  const isClosed = Boolean(poll.closes_at && new Date(poll.closes_at).getTime() <= now)

  const vote = async (optionId: string) => {
    if (!userId) return toast.error('Đăng nhập để tham gia bình chọn.')
    await process('Đang ghi nhận bình chọn...', () => voteMutation.mutateAsync(optionId)).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể ghi nhận bình chọn'))
  }

  return (
    <section className="community-poll-card" aria-label={`Bình chọn: ${poll.question}`}>
      <div className="community-poll-heading"><div className="community-poll-icon"><Vote size={17} /></div><div><span>Bình chọn cộng đồng</span><strong>{poll.question}</strong></div></div>
      <div className="community-poll-options">
        {options.map(option => {
          const votes = option.votes?.[0]?.count ?? 0
          const percentage = totalVotes ? Math.round((votes / totalVotes) * 100) : 0
          const selected = userVote?.data === option.id
          return <button key={option.id} type="button" className={`community-poll-option ${selected ? 'is-selected' : ''}`} onClick={() => void vote(option.id)} disabled={isClosed || voteMutation.isPending} aria-pressed={selected}>
            <span className="community-poll-option-progress" style={{ width: `${percentage}%` }} />
            <span className="community-poll-option-label">{selected && <CheckCircle2 size={14} />}{option.label}</span>
            <strong>{percentage}%</strong>
          </button>
        })}
      </div>
      <div className="community-poll-footer"><span>{totalVotes} lượt bình chọn</span>{isClosed ? <span>Đã kết thúc</span> : userId ? <span>Chọn một phương án</span> : <Link to="/login">Đăng nhập để bình chọn</Link>}</div>
    </section>
  )
}

function CommunityPostEditForm({ post, onCancel, onSaved }: { post: CommunityPostWithDetails; onCancel: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const process = useProcessing()
  const [title, setTitle] = useState(post.title ?? '')
  const [content, setContent] = useState(post.content ?? '')
  const [gameVersion, setGameVersion] = useState(post.game_version ?? '')
  const [tactic, setTactic] = useState(post.tactic ?? '')
  const [tags, setTags] = useState(() => normalizeDraftTags((post.tags ?? []).map(item => item.tag?.name ?? '').filter(Boolean)))
  const [tagInput, setTagInput] = useState('')
  const [mediaUrl, setMediaUrl] = useState(post.media_url ?? '')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState(post.media_url ?? '')

  useEffect(() => () => {
    if (mediaPreview.startsWith('blob:')) URL.revokeObjectURL(mediaPreview)
  }, [mediaPreview])

  const addTags = () => {
    if (!tagInput.trim()) return
    setTags(current => normalizeDraftTags([...current, ...tagInput.split(',')]))
    setTagInput('')
  }

  const handleMediaFile = (file: File | undefined) => {
    if (!file) return
    try {
      if (post.post_type === 'reel' && !file.type.startsWith('video/')) throw new Error('Reels chỉ nhận tệp video.')
      if (file.type.startsWith('video/')) validateVideoFile(file)
      else validateImageFile(file)
      setMediaFile(file)
      setMediaUrl('')
      if (mediaPreview.startsWith('blob:')) URL.revokeObjectURL(mediaPreview)
      setMediaPreview(URL.createObjectURL(file))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tệp media không hợp lệ')
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || user.id !== post.author_id) return toast.error('Bạn không có quyền sửa bài đăng này.')
    const nextTags = normalizeDraftTags([...tags, ...tagInput.split(','), ...extractContentTags(content)])
    const mediaChanged = Boolean(mediaFile) || mediaUrl.trim() !== (post.media_url ?? '')
    const hasMedia = mediaChanged ? Boolean(mediaFile || mediaUrl.trim()) : Boolean(post.media_url)
    if (!title.trim() && !content.trim() && !hasMedia && !post.poll) return toast.error('Bài đăng cần có nội dung hoặc media.')
    await process('Đang lưu thay đổi bài đăng...', async () => {
      if (post.post_type === 'reel' && mediaChanged && !mediaFile && !mediaUrl.trim()) throw new Error('Reels cần giữ lại hoặc thay bằng một video khác.')
      let uploaded: Awaited<ReturnType<typeof uploadCommunityMedia>> | null = null
      const mediaIsVideo = post.post_type === 'reel' || Boolean(mediaFile?.type.startsWith('video/')) || looksLikeVideoSource(mediaUrl.trim())
      if (mediaFile?.type.startsWith('video/')) await validateVideoDuration(mediaFile)
      if (mediaFile) uploaded = await uploadCommunityMedia(mediaFile, mediaFile.type.startsWith('video/') ? 'video' : 'image')
      else if (mediaChanged && mediaUrl.trim()) uploaded = await uploadCommunityMedia(mediaUrl.trim(), mediaIsVideo ? 'video' : 'image')
      const mediaUpdates = mediaChanged ? {
        media_url: uploaded?.url ?? (mediaUrl.trim() || null),
        media_public_id: uploaded?.publicId ?? null,
        media_type: mediaChanged && (uploaded || mediaUrl.trim()) ? (mediaIsVideo ? 'video' as const : 'image' as const) : null,
        thumbnail_url: uploaded?.thumbnailUrl ?? null,
      } : {}
      const { error } = await updateCommunityPost(post.id, user.id, { title, content, game_version: gameVersion, tactic, tags: nextTags, ...mediaUpdates })
      if (error) throw error
      toast.success('Đã cập nhật bài đăng')
      onSaved()
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật bài đăng'))
  }

  return <form className="community-post-edit-form" onSubmit={handleSubmit}>
    <div className="community-post-edit-heading"><strong>Chỉnh sửa bài đăng</strong><button type="button" className="btn-ghost p-1" onClick={onCancel} aria-label="Hủy chỉnh sửa"><X size={15} /></button></div>
    <input className="input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Tiêu đề ngắn (không bắt buộc)" maxLength={120} />
    <textarea className="input community-composer-textarea" value={content} onChange={event => setContent(event.target.value)} placeholder="Nội dung (không bắt buộc)" maxLength={5000} rows={5} />
    <div className="community-composer-grid"><input className="input" value={gameVersion} onChange={event => setGameVersion(event.target.value)} placeholder="Phiên bản game" maxLength={80} />{post.post_type === 'showcase' && <input className="input" value={tactic} onChange={event => setTactic(event.target.value)} placeholder="Từ khóa chiến thuật" maxLength={120} />}</div>
    <div className="community-media-row"><label className="community-file-button"><ImagePlus size={16} /> {mediaFile ? mediaFile.name : 'Đổi media'}<input type="file" accept={post.post_type === 'reel' ? 'video/*' : 'image/*,video/*'} onChange={event => handleMediaFile(event.target.files?.[0])} hidden /></label><input className="input" value={mediaUrl} onChange={event => { setMediaUrl(event.target.value); setMediaFile(null); setMediaPreview(event.target.value) }} placeholder="Dán URL media mới hoặc để trống để gỡ ảnh" inputMode="url" /></div>
    {Boolean(mediaPreview || mediaUrl.trim()) && <div className="community-upload-preview"><div className="community-upload-preview-label">Xem trước media</div><div className="community-upload-preview-item">{(mediaFile?.type.startsWith('video/') || post.media_type === 'video' || looksLikeVideoSource(mediaUrl)) ? <video src={mediaPreview || mediaUrl.trim() || undefined} className="community-upload-preview-media" controls muted playsInline /> : <img src={mediaPreview || mediaUrl.trim() || undefined} alt="Xem trước media chỉnh sửa" className="community-upload-preview-media" />}<button type="button" className="community-upload-preview-remove" onClick={() => { setMediaFile(null); setMediaUrl(''); setMediaPreview('') }} aria-label="Xóa media xem trước"><X size={14} /></button></div></div>}
    <div className="community-tag-editor"><div className="community-tag-editor-row"><input className="input" value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTags() } }} onBlur={addTags} placeholder="Thêm tag, ngăn cách bằng dấu phẩy" maxLength={240} /><button type="button" className="btn-ghost p-2" onClick={addTags} aria-label="Thêm tag"><Plus size={15} /></button></div>{tags.length > 0 && <div className="community-tag-list">{tags.map(tag => <button key={communityTagSlug(tag)} type="button" className="community-tag-chip" onClick={() => setTags(current => current.filter(item => communityTagSlug(item) !== communityTagSlug(tag)))} >#{tag}<X size={12} /></button>)}</div>}</div>
    <div className="community-post-edit-actions"><button type="button" className="btn-ghost" onClick={onCancel}>Hủy</button><button type="submit" className="btn-primary"><Pencil size={15} /> Lưu thay đổi</button></div>
  </form>
}

function getCommunityPostMedia(post: CommunityPostWithDetails): CommunityPostMedia[] {
  if (post.media?.length) return [...post.media].sort((left, right) => left.sort_order - right.sort_order)
  if (!post.media_url || !post.media_type) return []
  return [{
    id: `legacy-${post.id}`,
    post_id: post.id,
    media_type: post.media_type,
    media_url: post.media_url,
    media_public_id: post.media_public_id,
    thumbnail_url: post.thumbnail_url,
    alt: post.title,
    sort_order: 0,
  }]
}

function CommunityMediaLightbox({ items, initialIndex, onClose }: { items: CommunityPostMedia[]; initialIndex: number; onClose: () => void }) {
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const item = items[activeIndex]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') { setZoom(1); setActiveIndex(index => (index - 1 + items.length) % items.length) }
      if (event.key === 'ArrowRight') { setZoom(1); setActiveIndex(index => (index + 1) % items.length) }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [items.length, onClose])

  if (!item) return null
  const previous = () => { setZoom(1); setActiveIndex(index => (index - 1 + items.length) % items.length) }
  const next = () => { setZoom(1); setActiveIndex(index => (index + 1) % items.length) }
  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return
    const [first, second] = Array.from(event.touches)
    pinchRef.current = { distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY), zoom }
  }
  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchRef.current) return
    event.preventDefault()
    const [first, second] = Array.from(event.touches)
    const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
    setZoom(Math.min(6, Math.max(1, pinchRef.current.zoom * (distance / pinchRef.current.distance))))
  }
  const handleTouchEnd = () => { pinchRef.current = null }
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setZoom(value => Math.min(6, Math.max(1, value + (event.deltaY < 0 ? 0.2 : -0.2))))
  }

  const lightbox = <div className="community-lightbox" role="dialog" aria-modal="true" aria-label="Xem media bài đăng" onClick={onClose}>
    <div className="community-lightbox-toolbar" onClick={event => event.stopPropagation()}>
      <span>{activeIndex + 1}/{items.length}</span>
      <button type="button" className="community-lightbox-button" onClick={() => setZoom(value => Math.max(1, value - 0.25))} aria-label="Thu nhỏ"><ZoomOut size={18} /></button>
      <button type="button" className="community-lightbox-button" onClick={() => setZoom(value => Math.min(6, value + 0.25))} aria-label="Phóng to"><ZoomIn size={18} /></button>
      <a className="community-lightbox-button" href={item.media_url} download={`football-stories-media-${activeIndex + 1}`} aria-label="Tải media xuống"><Download size={18} /></a>
      <button type="button" className="community-lightbox-button" onClick={onClose} aria-label="Đóng"><X size={19} /></button>
    </div>
    {items.length > 1 && <button type="button" className="community-lightbox-nav community-lightbox-prev" onClick={event => { event.stopPropagation(); previous() }} aria-label="Media trước"><ChevronLeft size={28} /></button>}
    <div className="community-lightbox-stage" onClick={event => event.stopPropagation()} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onWheel={handleWheel}>
      {item.media_type === 'video' ? <video className="community-lightbox-media" src={item.media_url || undefined} poster={item.thumbnail_url ?? undefined} controls autoPlay playsInline style={{ transform: `scale(${zoom})` }} /> : <img className="community-lightbox-media" src={item.media_url || undefined} alt={item.alt ?? 'Media bài đăng cộng đồng'} loading="eager" decoding="async" style={{ transform: `scale(${zoom})` }} />}
    </div>
    {items.length > 1 && <button type="button" className="community-lightbox-nav community-lightbox-next" onClick={event => { event.stopPropagation(); next() }} aria-label="Media tiếp theo"><ChevronRight size={28} /></button>}
  </div>
  return createPortal(lightbox, document.body)
}

function CommunityReelMedia({ item }: { item: CommunityPostMedia }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const mutedRef = useRef(muted)

  useEffect(() => {
    mutedRef.current = muted
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const root = video.closest('.community-reels-rail') as HTMLElement | null
    const scrollTarget: Window | HTMLElement = root ?? window
    const getCandidates = () => Array.from((root ?? document).querySelectorAll<HTMLVideoElement>('video[data-community-reel]'))
    const getCenter = () => {
      const bounds = root?.getBoundingClientRect()
      return bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2
    }
    const getVisibleCandidate = () => {
      const center = getCenter()
      return getCandidates()
        .map(candidate => {
          const bounds = candidate.getBoundingClientRect()
          const visibleHeight = Math.max(0, Math.min(bounds.bottom, root?.getBoundingClientRect().bottom ?? window.innerHeight) - Math.max(bounds.top, root?.getBoundingClientRect().top ?? 0))
          const ratio = bounds.height > 0 ? visibleHeight / bounds.height : 0
          return { candidate, ratio, distance: Math.abs((bounds.top + bounds.bottom) / 2 - center) }
        })
        .filter(entry => entry.ratio >= 0.55)
        .sort((left, right) => left.distance - right.distance)[0]?.candidate ?? null
    }
    const updatePlayback = () => {
      if (document.hidden) {
        for (const candidate of getCandidates()) {
          candidate.pause()
          candidate.muted = true
        }
        return
      }
      const active = getVisibleCandidate()
      for (const candidate of getCandidates()) {
        if (candidate === active) {
          candidate.muted = mutedRef.current
          void candidate.play().catch(() => undefined)
        } else {
          candidate.pause()
          candidate.muted = true
        }
      }
    }
    const keepSingleReelPlaying = () => {
      for (const candidate of getCandidates()) {
        if (candidate !== video) {
          candidate.pause()
          candidate.muted = true
        }
      }
    }
    const handleVisibilityChange = () => updatePlayback()
    const observer = new IntersectionObserver(updatePlayback, { root, threshold: [0, 0.55, 0.8, 1] })
    observer.observe(video)
    scrollTarget.addEventListener('scroll', updatePlayback, { passive: true })
    video.addEventListener('play', keepSingleReelPlaying)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    updatePlayback()
    return () => {
      observer.disconnect()
      scrollTarget.removeEventListener('scroll', updatePlayback)
      video.removeEventListener('play', keepSingleReelPlaying)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      video.pause()
      video.muted = true
    }
  }, [])

  const toggleMute = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const nextMuted = !muted
    setMuted(nextMuted)
    if (videoRef.current) {
      videoRef.current.muted = nextMuted
      void videoRef.current.play().catch(() => undefined)
    }
  }

  return <div className="community-reel-media-shell">
    <video ref={videoRef} data-community-reel="true" className="community-post-media" src={item.media_url || undefined} poster={item.thumbnail_url ?? undefined} muted playsInline loop preload="metadata" />
    <button type="button" className="community-reel-sound-button" onClick={toggleMute} aria-label={muted ? 'Bật tiếng Reels' : 'Tắt tiếng Reels'}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
  </div>
}

function CommunityMediaGallery({ post }: { post: CommunityPostWithDetails }) {
  const items = getCommunityPostMedia(post)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  if (!items.length) return null
  const visibleItems = items.slice(0, 5)
  const open = (index: number) => setLightboxIndex(Math.min(index, items.length - 1))
  if (items.length === 1) {
    const item = items[0]
    return <>
      <div className="community-media-gallery-single" role="button" tabIndex={0} onClick={() => open(0)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(0) } }} aria-label="Mở media toàn màn hình">
        {item.media_type === 'video' && post.post_type === 'reel' ? <CommunityReelMedia item={item} /> : item.media_type === 'video' ? <video className="community-post-media" src={item.media_url || undefined} poster={item.thumbnail_url ?? undefined} controls playsInline loop preload="metadata" onClick={event => event.stopPropagation()} /> : <img className="community-post-media" src={item.media_url || undefined} alt={item.alt ?? post.title ?? 'Ảnh trong bài đăng cộng đồng'} loading="lazy" decoding="async" />}
      </div>
      {lightboxIndex !== null && <CommunityMediaLightbox items={items} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
    </>
  }
  return <>
    <div className={`community-media-gallery community-media-gallery-count-${visibleItems.length}`}>
      {visibleItems.map((item, index) => <button key={item.id} type="button" className="community-media-gallery-item" onClick={() => open(index)} aria-label={`Mở media ${index + 1}`}>
        {item.media_type === 'video' ? <video src={item.media_url || undefined} poster={item.thumbnail_url ?? undefined} muted playsInline preload="metadata" /> : <img src={item.media_url || undefined} alt={item.alt ?? post.title ?? `Ảnh ${index + 1}`} loading="lazy" decoding="async" />}
        {index === visibleItems.length - 1 && items.length > visibleItems.length && <span className="community-media-gallery-more">+{items.length - visibleItems.length}</span>}
      </button>)}
    </div>
    {lightboxIndex !== null && <CommunityMediaLightbox items={items} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
  </>
}

function CommunityReactionSummary({ counts }: { counts: CommunityReactionSummary[] }) {
  const sortedCounts = [...counts].sort((left, right) => right.count - left.count)
  const total = sortedCounts.reduce((sum, item) => sum + item.count, 0)
  if (!total) return null
  return <div className="community-reaction-summary" aria-label={`${total} cảm xúc`}>
    {sortedCounts.slice(0, 3).map(item => <span key={item.reaction} title={`${communityReactionMeta(item.reaction)?.label ?? 'Cảm xúc'}: ${item.count}`}>{communityReactionMeta(item.reaction)?.emoji}</span>)}
    <strong>{total}</strong>
  </div>
}

function CommunityReactionPicker({ currentReaction, counts, onSelect, showSummary = true }: { currentReaction: CommunityReactionType | null; counts: CommunityReactionSummary[]; onSelect: (reaction: CommunityReactionType | null) => void; showSummary?: boolean }) {
  const [open, setOpen] = useState(false)
  const selected = communityReactionMeta(currentReaction)

  return <div className="community-reaction-picker">
    <button type="button" className={`community-reaction-trigger ${currentReaction ? 'is-selected' : ''}`} onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} aria-label={selected ? `Cảm xúc hiện tại: ${selected.label}. Đổi cảm xúc` : 'Chọn cảm xúc'}>
      {selected ? <span className="community-reaction-selected-icon" aria-hidden="true">{selected.emoji}</span> : <Heart size={17} strokeWidth={1.8} aria-hidden="true" />}
    </button>
    {showSummary && <CommunityReactionSummary counts={counts} />}
    <div className={`community-reaction-menu ${open ? 'is-open' : ''}`} role="menu" aria-label="Chọn cảm xúc">
      {communityReactionOptions.map(option => <button key={option.value} type="button" role="menuitem" aria-label={option.label} className={currentReaction === option.value ? 'is-selected' : ''} onClick={() => { onSelect(currentReaction === option.value ? null : option.value); setOpen(false) }} title={option.label}>
        <span aria-hidden="true">{option.emoji}</span>
      </button>)}
    </div>
  </div>
}

function CommunityPostCard({ post, onTagSelect }: { post: CommunityPostWithDetails; onTagSelect?: (slug: string) => void }) {
  const { user } = useAuth()
  const process = useProcessing()
  const queryClient = useQueryClient()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reportReason, setReportReason] = useState('spam')
  const { data: reactionState } = useQuery({ queryKey: ['community-reaction', post.id, user?.id], queryFn: () => fetchCommunityReactionState(post.id, user?.id), enabled: Boolean(user?.id) })
  const { data: bookmarkState } = useQuery({ queryKey: ['community-bookmark', post.id, user?.id], queryFn: () => fetchCommunityBookmarkState(post.id, user?.id), enabled: Boolean(user?.id) })
  const { data: relationState } = useQuery({ queryKey: ['community-relation', user?.id, post.author?.id], queryFn: () => fetchCommunityUserRelations(user!.id, post.author!.id), enabled: Boolean(user?.id && post.author?.id && user.id !== post.author.id) })
  const reactionMutation = useMutation({
    mutationFn: (reaction: CommunityReactionType | null) => {
      if (!user) throw new Error('Bạn cần đăng nhập để thả cảm xúc.')
      return setCommunityReaction(post.id, user.id, reaction)
    },
    onSuccess: async ({ error }) => {
      if (error) throw error
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['community-reaction', post.id, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
      ])
    },
  })
  const commentsCount = post.comments?.[0]?.count ?? post.comments_count ?? 0
  const reactionCounts: CommunityReactionSummary[] = post.reactions?.length
    ? post.reactions
    : ((post.likes?.[0]?.count ?? 0) > 0 ? [{ reaction: 'like', count: post.likes?.[0]?.count ?? 0 }] : [])

  const bookmarkMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Bạn cần đăng nhập để lưu bài đăng.')
      return toggleCommunityBookmark(post.id, user.id, bookmarkState?.isBookmarked ?? false)
    },
    onSuccess: async ({ error }) => {
      if (error) throw error
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['community-bookmark', post.id, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
      ])
    },
  })

  const relationMutation = useMutation({
    mutationFn: (relationType: 'follow' | 'mute' | 'block') => {
      if (!user || !post.author?.id) throw new Error('Bạn cần đăng nhập để quản lý cộng đồng.')
      const enabled = relationType === 'follow' ? relationState?.isFollowing : relationType === 'mute' ? relationState?.isMuted : relationState?.isBlocked
      return toggleCommunityUserRelation(user.id, post.author.id, relationType, Boolean(enabled))
    },
    onSuccess: async (_, relationType) => {
      await queryClient.invalidateQueries({ queryKey: ['community-relation', user?.id, post.author?.id] })
      if (relationType === 'block' || relationType === 'mute') await queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      toast.success(relationType === 'follow' ? 'Đã cập nhật theo dõi' : relationType === 'mute' ? 'Đã cập nhật tắt tiếng' : 'Đã cập nhật chặn thành viên')
    },
  })

  const reportMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Bạn cần đăng nhập để báo cáo nội dung.')
      return submitContentReport({ reporter_id: user.id, target_type: post.post_type === 'reel' ? 'reel' : 'community_post', target_id: post.id, reason: reportReason })
    },
    onSuccess: async ({ error }) => {
      if (error) throw error
      setReportOpen(false)
      setMenuOpen(false)
      toast.success('Đã gửi báo cáo cho đội ngũ kiểm duyệt')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!user || user.id !== post.author_id) throw new Error('Bạn không có quyền xóa bài đăng này.')
      return deleteCommunityPost(post.id, user.id)
    },
    onSuccess: async ({ error }) => {
      if (error) throw error
      setDeleteOpen(false)
      setMenuOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      toast.success('Đã xóa bài đăng của bạn')
    },
  })

  const handleReaction = async (reaction: CommunityReactionType | null) => {
    if (!user) return toast.error('Đăng nhập để thả cảm xúc.')
    await process('Đang cập nhật cảm xúc...', () => reactionMutation.mutateAsync(reaction)).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật cảm xúc'))
  }

  const handleRelation = async (relationType: 'follow' | 'mute' | 'block') => {
    const labels = { follow: 'Đang cập nhật theo dõi...', mute: 'Đang cập nhật tắt tiếng...', block: 'Đang cập nhật chặn thành viên...' }
    await process(labels[relationType], () => relationMutation.mutateAsync(relationType)).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật tùy chọn thành viên'))
    setMenuOpen(false)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/cong-dong#community-${post.id}`
    try {
      if (navigator.share) await navigator.share({ title: post.title ?? 'Bài đăng cộng đồng eFootball', text: post.content.slice(0, 120), url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Đã sao chép liên kết bài đăng')
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') toast.error('Không thể chia sẻ bài đăng')
    }
  }

  return (
    <article className={`community-post community-post-${post.post_type} ${post.poll ? 'community-post-has-poll' : ''}`} id={`community-${post.id}`}>
      <div className="community-post-head">
        <Avatar username={post.author?.username ?? 'Thành viên'} avatar={post.author?.avatar} />
        <div className="min-w-0"><strong>{post.author?.username ?? 'Thành viên'}</strong><span>{typeLabels[post.post_type]} · {formatRelativeDate(post.created_at)}</span></div>
        <span className="community-type-badge">{post.post_type === 'reel' ? <Video size={13} /> : post.post_type === 'showcase' ? <Swords size={13} /> : <MessageCircle size={13} />}{typeLabels[post.post_type]}</span>
        {user && <div className="community-post-menu"><button type="button" className="btn-ghost p-1" aria-label="Tùy chọn bài đăng" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><MoreHorizontal size={18} /></button>{menuOpen && <div className="community-post-menu-panel">
          {user.id === post.author?.id ? <>
            <button type="button" onClick={() => { setEditing(true); setMenuOpen(false) }}><Pencil size={14} /> Sửa bài viết</button>
            <button type="button" className="is-danger" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Xóa bài viết</button>
          </> : <>
            <button type="button" onClick={() => void handleRelation('follow')}><UserPlus size={14} /> {relationState?.isFollowing ? 'Bỏ theo dõi' : 'Theo dõi tác giả'}</button>
            <button type="button" onClick={() => void handleRelation('mute')}><VolumeX size={14} /> {relationState?.isMuted ? 'Bật lại bài đăng' : 'Tắt tiếng tác giả'}</button>
            <button type="button" onClick={() => void handleRelation('block')}><Ban size={14} /> {relationState?.isBlocked ? 'Bỏ chặn tác giả' : 'Chặn tác giả'}</button>
            <button type="button" onClick={() => { setMenuOpen(false); setReportOpen(true) }}><Flag size={14} /> Báo cáo nội dung</button>
          </>}
        </div>}</div>}
      </div>
      {editing ? <CommunityPostEditForm post={post} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); void queryClient.invalidateQueries({ queryKey: ['community-posts'] }) }} /> : <>
        {post.title && <h2>{post.title}</h2>}
        {post.content.trim() && <p className="community-post-content">{renderHashtags(post.content)}</p>}
        {(post.tags?.length ?? 0) > 0 && <div className="community-post-tags">{post.tags?.map(item => item.tag && <button key={item.tag.id} type="button" onClick={() => onTagSelect?.(item.tag!.slug)}>#{item.tag.name}</button>)}</div>}
        {(post.game_version || post.tactic) && <div className="community-post-meta">{post.game_version && <span><Gamepad2 size={12} /> {post.game_version}</span>}{post.tactic && <span><Zap size={12} /> {post.tactic}</span>}</div>}
        <CommunityMediaGallery post={post} />
        {post.poll && <CommunityPollCard postId={post.id} poll={post.poll} userId={user?.id} />}
        <div className="community-post-actions">
          <div className="community-post-action-controls">
            <CommunityReactionPicker currentReaction={reactionState?.reaction ?? null} counts={reactionCounts} onSelect={reaction => void handleReaction(reaction)} showSummary={false} />
            <button type="button" onClick={() => setCommentsOpen(value => !value)}><MessageCircle size={17} /> {commentsCount}</button>
            <button type="button" className={bookmarkState?.isBookmarked ? 'liked' : ''} onClick={() => { if (!user) return toast.error('Đăng nhập để lưu bài đăng.'); void process('Đang lưu bài đăng...', () => bookmarkMutation.mutateAsync()) }}><Bookmark size={17} fill={bookmarkState?.isBookmarked ? 'currentColor' : 'none'} /> {bookmarkState?.isBookmarked ? 'Đã lưu' : 'Lưu'}</button>
            <button type="button" onClick={() => void handleShare()}><Share2 size={17} /> Chia sẻ</button>
          </div>
          <CommunityReactionSummary counts={reactionCounts} />
        </div>
        {reportOpen && <form className="community-report-form" onSubmit={event => { event.preventDefault(); void process('Đang gửi báo cáo...', () => reportMutation.mutateAsync()) }}><div className="flex items-center justify-between"><strong>Báo cáo nội dung</strong><button type="button" className="btn-ghost p-1" onClick={() => setReportOpen(false)} aria-label="Đóng báo cáo"><X size={15} /></button></div><select className="input text-sm" value={reportReason} onChange={event => setReportReason(event.target.value)}><option value="spam">Nội dung rác</option><option value="offensive_content">Nội dung phản cảm</option><option value="harassment">Quấy rối</option><option value="fake_information">Thông tin sai lệch</option><option value="other">Lý do khác</option></select><button type="submit" className="btn-secondary text-sm"><Flag size={14} /> Gửi báo cáo</button></form>}
        {commentsOpen && <CommunityComments postId={post.id} poll={post.poll} />}
      </>}
      <ConfirmModal open={deleteOpen} title="Xóa bài viết?" message="Bài viết và toàn bộ media, bình chọn, bình luận liên quan sẽ bị xóa khỏi cộng đồng. Thao tác này không thể hoàn tác." confirmLabel="Xóa bài viết" loading={deleteMutation.isPending} onCancel={() => setDeleteOpen(false)} onConfirm={() => { void process('Đang xóa bài viết...', () => deleteMutation.mutateAsync()) }} />
    </article>
  )
}

export default function CommunityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<CommunityView>('all')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState<CommunitySort>('newest')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const activeType: FeedType = ['all', 'discussion', 'reel', 'showcase'].includes(view) ? view as FeedType : 'all'
  const authorId = view === 'mine' ? user?.id : undefined
  const collection = ['liked', 'bookmarked', 'voted'].includes(view) ? view as 'liked' | 'bookmarked' | 'voted' : undefined
  const search = useDebounce(searchInput.trim(), 350)
  const tagSlug = searchParams.get('tag') ?? ''
  const feedListRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const { data: tagData } = useQuery({ queryKey: ['community-tags'], queryFn: () => fetchCommunityTags() })
  const { data, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, error } = useInfiniteQuery({
    queryKey: ['community-posts', activeType, collection, authorId, user?.id, search, sort, tagSlug],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchCommunityPosts({ type: activeType, collection, authorId, page: pageParam, viewerId: user?.id, search, sort, tagSlug }),
    getNextPageParam: (lastPage, allPages) => {
      const total = lastPage.count ?? 0
      return allPages.length * 12 < total ? allPages.length + 1 : undefined
    },
  })
  const posts = data?.pages.flatMap(pageData => pageData.data ?? []) ?? []

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || !hasNextPage || isFetchingNextPage) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void fetchNextPage()
    }, {
      root: activeType === 'reel' && !collection ? feedListRef.current : null,
      rootMargin: '480px 0px',
      threshold: 0.01,
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [activeType, collection, fetchNextPage, hasNextPage, isFetchingNextPage])

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['community-posts'] })
  }

  const changeView = (nextView: CommunityView) => {
    if ((nextView === 'liked' || nextView === 'bookmarked' || nextView === 'voted' || nextView === 'mine') && !user) return toast.error('Đăng nhập để xem danh sách cá nhân của bạn.')
    setView(nextView)
  }

  const changeTag = (nextTag: string) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (nextTag) next.set('tag', nextTag)
      else next.delete('tag')
      return next
    })
  }

  return (
    <div className="community-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      <Reveal>
        <section className="community-hero" aria-labelledby="community-hero-title">
          <div className="community-hero-video" aria-hidden="true"><video autoPlay muted loop playsInline preload="metadata"><source src="/efootball_ngang_dung.mp4" type="video/mp4" /></video></div>
          <header className="community-heading">
            <div><p className="eyebrow"><Sparkles size={14} /> Trung tâm eFootball</p><h1 id="community-hero-title">Nơi meta gặp<br /><em>cá tính của bạn.</em></h1></div>
            <div className="community-hero-copy"><p>Cùng xây dựng cộng đồng eFootball Việt Nam: chia sẻ chiến thuật, build đội hình, review cầu thủ và những khoảnh khắc Reels đáng nhớ.</p><div className="community-hero-signals"><span><Gamepad2 size={13} /> Gameplay</span><span><Radio size={13} /> Trực tiếp</span><span><Zap size={13} /> Meta mới</span></div></div>
          </header>
        </section>
      </Reveal>
      <Reveal delay={80}><CommunityComposer onCreated={refresh} /></Reveal>
      <div className="community-layout">
        <aside className="community-sidebar" aria-label="Bộ lọc cộng đồng">
          <div className="community-sidebar-heading"><span>Khám phá</span><strong>eFootball</strong></div>
          <nav className="community-sidebar-nav">{communityNavigation.map(item => { const Icon = item.icon; return <button key={item.id} type="button" className={view === item.id ? 'active' : ''} onClick={() => changeView(item.id)}><Icon size={16} /> <span>{item.label}</span>{(item.id === 'liked' || item.id === 'bookmarked' || item.id === 'voted' || item.id === 'mine') && !user && <small>Đăng nhập</small>}</button> })}</nav>
          <div className="community-sidebar-note"><ShieldCheck size={15} /><p>Nội dung được kiểm duyệt để giữ không gian chơi game tích cực.</p></div>
        </aside>
        <section className="community-feed" aria-label="Dòng thời gian cộng đồng eFootball">
        <div className="community-feed-toolbar">
          <div className="community-feed-tabs" role="tablist" aria-label="Bộ lọc cộng đồng">
            {(Object.keys(feedLabels) as FeedType[]).map(item => <button key={item} type="button" className={activeType === item && !collection ? 'active' : ''} onClick={() => changeView(item)}>{feedLabels[item]}</button>)}
          </div>
          {isFetching && !isLoading && <span className="community-syncing">Đang cập nhật...</span>}
        </div>
        <div className="community-search-panel">
          <AdminListSearch value={searchInput} onChange={value => setSearchInput(value)} placeholder="Tìm bài, chiến thuật, phiên bản..." storageKey="community-search-history" suggestions={(tagData?.data ?? []).map(tag => ({ label: `#${tag.name}`, value: tag.name }))} />
          <label className="community-filter-control"><SlidersHorizontal size={14} /><span>Lọc</span><select className="input" value={tagSlug} onChange={event => changeTag(event.target.value)}><option value="">Tất cả tag</option>{(tagData?.data ?? []).map(tag => <option key={tag.id} value={tag.slug}>#{tag.name}</option>)}</select></label>
          <label className="community-filter-control"><span>Sắp xếp</span><select className="input" value={sort} onChange={event => setSort(event.target.value as CommunitySort)}><option value="newest">Mới nhất</option><option value="popular">Nhiều lượt thích</option><option value="oldest">Cũ nhất</option></select></label>
          {tagSlug && <button type="button" className="btn-ghost community-clear-filter" onClick={() => changeTag('')}>Xóa lọc</button>}
        </div>
        {isLoading ? <div className="community-feed-grid">{[1, 2, 3].map(item => <div key={item} className="community-post community-skeleton"><div className="skeleton h-10 w-2/3" /><div className="skeleton h-28" /><div className="skeleton h-8 w-1/2" /></div>)}</div>
          : error && posts.length === 0 ? <div className="empty-state"><h2>Chưa thể tải dòng thời gian</h2><p>Kiểm tra kết nối rồi thử lại nhé.</p><button className="btn-secondary" onClick={refresh}>Thử lại</button></div>
          : posts.length === 0 ? <div className="empty-state"><h2>Chưa có bài đăng trong mục này</h2><p>Hãy là người đầu tiên mở chủ đề cho cộng đồng.</p></div>
          : <div ref={feedListRef} className={activeType === 'reel' && !collection ? 'community-feed-grid community-reels-rail' : 'community-feed-grid'}>{posts.map((post, index) => <Reveal key={post.id} delay={(index % 3) * 60}><CommunityPostCard post={post} onTagSelect={changeTag} /></Reveal>)}{hasNextPage && <div ref={loadMoreRef} className="community-infinite-sentinel" aria-live="polite">{isFetchingNextPage ? <><span className="community-infinite-loader" /> Đang tải thêm bài đăng...</> : ' '}</div>}{error && <div className="community-infinite-sentinel">Không thể tải thêm. Hãy thử lại.</div>}</div>}
        </section>
      </div>
    </div>
  )
}
