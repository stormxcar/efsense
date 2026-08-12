import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, ImagePlus, Video, Send, Users, Swords, ShieldCheck, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import Reveal from '@/components/Reveal'
import { useAuth } from '@/hooks/useAuth'
import { useProcessing } from '@/hooks/useProcessing'
import {
  createCommunityComment,
  createCommunityPost,
  fetchCommunityComments,
  fetchCommunityLikeState,
  fetchCommunityPosts,
  toggleCommunityLike,
  uploadCommunityMedia,
} from '@/services/api'
import { validateImageFile, validateVideoFile } from '@/lib/cloudinary'
import type { CommunityCommentWithUser, CommunityPostWithDetails } from '@/types/database'
import { formatRelativeDate, getInitials } from '@/utils'

type FeedType = 'all' | 'discussion' | 'reel' | 'showcase'

const feedLabels: Record<FeedType, string> = {
  all: 'Dòng thời gian',
  discussion: 'Thảo luận',
  reel: 'Reels',
  showcase: 'Đội hình & chiến thuật',
}

const typeLabels = {
  discussion: 'Thảo luận',
  reel: 'Reels',
  showcase: 'Showcase',
} as const

function Avatar({ username, avatar }: { username: string; avatar?: string | null }) {
  return avatar
    ? <img src={avatar} alt={username} className="community-avatar" loading="lazy" />
    : <span className="community-avatar community-avatar-fallback">{getInitials(username)}</span>
}

function CommunityComposer({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth()
  const process = useProcessing()
  const [postType, setPostType] = useState<Exclude<FeedType, 'all'>>('discussion')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [gameVersion, setGameVersion] = useState('eFootball 2026')
  const [tactic, setTactic] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState('')

  useEffect(() => () => {
    if (mediaPreview.startsWith('blob:')) URL.revokeObjectURL(mediaPreview)
  }, [mediaPreview])

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

  const handleFile = (file: File | undefined) => {
    if (!file) return
    try {
      if (file.type.startsWith('video/')) validateVideoFile(file)
      else validateImageFile(file)
      setMediaFile(file)
      setMediaUrl('')
      if (mediaPreview.startsWith('blob:')) URL.revokeObjectURL(mediaPreview)
      setMediaPreview(URL.createObjectURL(file))
      if (postType === 'discussion') setPostType(file.type.startsWith('video/') ? 'reel' : 'showcase')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tệp không hợp lệ')
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!content.trim()) return toast.error('Hãy viết vài dòng để bắt đầu cuộc trò chuyện.')
    if (postType === 'reel' && !mediaFile && !mediaUrl.trim()) return toast.error('Reels cần có video tải lên hoặc URL video.')
    if (mediaFile && postType === 'reel' && !mediaFile.type.startsWith('video/')) return toast.error('Reels chỉ nhận tệp video.')

    await process('Đang xuất bản bài đăng cộng đồng...', async () => {
      let uploaded: Awaited<ReturnType<typeof uploadCommunityMedia>> | null = null
      if (mediaFile) uploaded = await uploadCommunityMedia(mediaFile, mediaFile.type.startsWith('video/') ? 'video' : 'image')
      else if (mediaUrl.trim()) uploaded = await uploadCommunityMedia(mediaUrl.trim(), postType === 'reel' ? 'video' : 'image')

      const { error } = await createCommunityPost({
        author_id: user.id,
        post_type: postType,
        title,
        content,
        game_version: gameVersion,
        tactic,
        media_url: uploaded?.url ?? (mediaUrl.trim() || null),
        media_public_id: uploaded?.publicId ?? null,
        media_type: uploaded ? (postType === 'reel' || mediaFile?.type.startsWith('video/') ? 'video' : 'image') : null,
      })
      if (error) throw error
      setTitle('')
      setContent('')
      setTactic('')
      setMediaUrl('')
      setMediaFile(null)
      setMediaPreview('')
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
          <button key={type} type="button" className={postType === type ? 'active' : ''} onClick={() => setPostType(type)}>
            {type === 'reel' ? <Video size={15} /> : type === 'showcase' ? <Swords size={15} /> : <MessageCircle size={15} />}
            {typeLabels[type]}
          </button>
        ))}
      </div>
      <div className="community-composer-grid">
        <input className="input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Tiêu đề ngắn (không bắt buộc)" maxLength={120} />
        <input className="input" value={gameVersion} onChange={event => setGameVersion(event.target.value)} placeholder="Phiên bản game" maxLength={80} />
      </div>
      <textarea className="input community-composer-textarea" value={content} onChange={event => setContent(event.target.value)} placeholder={postType === 'showcase' ? 'Đội hình của bạn đang dùng sơ đồ nào? Chia sẻ cách vận hành...' : postType === 'reel' ? 'Mô tả ngắn cho Reels của bạn...' : 'Bạn đang nghĩ gì về eFootball hôm nay?'} maxLength={5000} rows={4} />
      {postType === 'showcase' && <input className="input" value={tactic} onChange={event => setTactic(event.target.value)} placeholder="Từ khóa chiến thuật, ví dụ: 4-2-3-1, phản công nhanh" maxLength={120} />}
      <div className="community-media-row">
        <label className="community-file-button">
          <ImagePlus size={17} /> {mediaFile ? mediaFile.name : postType === 'reel' ? 'Chọn video Reels' : 'Thêm ảnh hoặc video'}
          <input type="file" accept={postType === 'reel' ? 'video/*' : 'image/*,video/*'} onChange={event => handleFile(event.target.files?.[0])} hidden />
        </label>
        <input className="input" value={mediaUrl} onChange={event => { setMediaUrl(event.target.value); setMediaFile(null); setMediaPreview(event.target.value) }} placeholder={postType === 'reel' ? 'Hoặc dán URL video' : 'Hoặc dán URL ảnh/video'} inputMode="url" />
        <button className="btn-primary community-submit-button" type="submit"><Send size={16} /> Đăng bài</button>
      </div>
      {(mediaPreview || mediaUrl.trim()) && <div className="community-upload-preview"><div className="community-upload-preview-label">Xem trước media</div>{(mediaFile?.type.startsWith('video/') || postType === 'reel') ? <video src={mediaPreview || mediaUrl} className="community-upload-preview-media" controls muted playsInline /> : <img src={mediaPreview || mediaUrl} alt="Xem trước media bài đăng" className="community-upload-preview-media" />}</div>}
      <p className="community-helper"><ShieldCheck size={14} /> Video Reels tối đa 60 MB. Hãy tôn trọng bản quyền và cộng đồng.</p>
    </form>
  )
}

function CommunityComments({ postId }: { postId: string }) {
  const { user } = useAuth()
  const process = useProcessing()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['community-comments', postId], queryFn: () => fetchCommunityComments(postId) })
  const comments = data?.data ?? []

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return toast.error('Bạn cần đăng nhập để bình luận.')
    if (!content.trim()) return
    await process('Đang gửi bình luận...', async () => {
      const { error } = await createCommunityComment({ post_id: postId, user_id: user.id, content })
      if (error) throw error
      setContent('')
      await queryClient.invalidateQueries({ queryKey: ['community-comments', postId] })
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể gửi bình luận'))
  }

  return (
    <div className="community-comments">
      {isLoading ? <div className="skeleton h-10" /> : comments.map((comment: CommunityCommentWithUser) => (
        <div key={comment.id} className="community-comment">
          <Avatar username={comment.user?.username ?? 'Thành viên'} avatar={comment.user?.avatar} />
          <div><strong>{comment.user?.username ?? 'Thành viên'}</strong><p>{comment.content}</p><small>{formatRelativeDate(comment.created_at)}</small></div>
        </div>
      ))}
      {user ? (
        <form className="community-comment-form" onSubmit={handleSubmit}>
          <Avatar username={user.username} avatar={user.avatar} />
          <input className="input" value={content} onChange={event => setContent(event.target.value)} placeholder="Viết bình luận..." maxLength={1000} />
          <button className="btn-ghost p-2" type="submit" aria-label="Gửi bình luận"><Send size={16} /></button>
        </form>
      ) : <Link to="/login" className="community-login-link">Đăng nhập để tham gia bình luận</Link>}
    </div>
  )
}

function CommunityPostCard({ post }: { post: CommunityPostWithDetails }) {
  const { user } = useAuth()
  const process = useProcessing()
  const queryClient = useQueryClient()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const { data: likeState } = useQuery({ queryKey: ['community-like', post.id, user?.id], queryFn: () => fetchCommunityLikeState(post.id, user?.id), enabled: Boolean(user?.id) })
  const likeMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Bạn cần đăng nhập để thích bài đăng.')
      return toggleCommunityLike(post.id, user.id, likeState?.isLiked ?? false)
    },
    onSuccess: async ({ error }) => {
      if (error) throw error
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['community-like', post.id, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
      ])
    },
  })
  const likesCount = post.likes?.[0]?.count ?? post.likes_count ?? 0
  const commentsCount = post.comments?.[0]?.count ?? post.comments_count ?? 0

  const handleLike = async () => {
    if (!user) return toast.error('Đăng nhập để thích bài đăng.')
    await process('Đang cập nhật lượt thích...', () => likeMutation.mutateAsync()).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật lượt thích'))
  }

  return (
    <article className="community-post" id={`community-${post.id}`}>
      <div className="community-post-head">
        <Avatar username={post.author?.username ?? 'Thành viên'} avatar={post.author?.avatar} />
        <div className="min-w-0"><strong>{post.author?.username ?? 'Thành viên'}</strong><span>{typeLabels[post.post_type]} · {formatRelativeDate(post.created_at)}</span></div>
        <span className="community-type-badge">{post.post_type === 'reel' ? <Video size={13} /> : post.post_type === 'showcase' ? <Swords size={13} /> : <MessageCircle size={13} />}{typeLabels[post.post_type]}</span>
      </div>
      {post.title && <h2>{post.title}</h2>}
      <p className="community-post-content">{post.content}</p>
      {(post.game_version || post.tactic) && <div className="community-post-meta">{post.game_version && <span>{post.game_version}</span>}{post.tactic && <span>{post.tactic}</span>}</div>}
      {post.media_url && post.media_type === 'video' && <video className="community-post-media" src={post.media_url} poster={post.thumbnail_url ?? undefined} controls playsInline loop preload="metadata" />}
      {post.media_url && post.media_type === 'image' && <img className="community-post-media" src={post.media_url} alt={post.title ?? 'Ảnh trong bài đăng cộng đồng'} loading="lazy" />}
      <div className="community-post-actions">
        <button type="button" className={likeState?.isLiked ? 'liked' : ''} onClick={handleLike}><Heart size={17} fill={likeState?.isLiked ? 'currentColor' : 'none'} /> {likesCount}</button>
        <button type="button" onClick={() => setCommentsOpen(value => !value)}><MessageCircle size={17} /> {commentsCount}</button>
      </div>
      {commentsOpen && <CommunityComments postId={post.id} />}
    </article>
  )
}

export default function CommunityPage() {
  const [type, setType] = useState<FeedType>('all')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, error } = useQuery({ queryKey: ['community-posts', type, page], queryFn: () => fetchCommunityPosts({ type, page }) })
  const posts = data?.data ?? []
  const total = data?.count ?? 0
  const hasMore = page * 12 < total

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['community-posts'] })
  }

  return (
    <div className="community-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      <Reveal>
        <header className="community-heading">
          <div><p className="eyebrow"><Sparkles size={14} /> Trung tâm eFootball</p><h1>Nơi meta gặp<br /><em>cá tính của bạn.</em></h1></div>
          <p>Cùng xây dựng cộng đồng eFootball Việt Nam: chia sẻ chiến thuật, build đội hình, review cầu thủ và những khoảnh khắc Reels đáng nhớ.</p>
        </header>
      </Reveal>
      <Reveal delay={80}><CommunityComposer onCreated={refresh} /></Reveal>
      <section className="community-feed" aria-label="Dòng thời gian cộng đồng eFootball">
        <div className="community-feed-toolbar">
          <div className="community-feed-tabs" role="tablist" aria-label="Bộ lọc cộng đồng">
            {(Object.keys(feedLabels) as FeedType[]).map(item => <button key={item} type="button" className={type === item ? 'active' : ''} onClick={() => { setType(item); setPage(1) }}>{feedLabels[item]}</button>)}
          </div>
          {isFetching && !isLoading && <span className="community-syncing">Đang cập nhật...</span>}
        </div>
        {isLoading ? <div className="community-feed-grid">{[1, 2, 3].map(item => <div key={item} className="community-post community-skeleton"><div className="skeleton h-10 w-2/3" /><div className="skeleton h-28" /><div className="skeleton h-8 w-1/2" /></div>)}</div>
          : error ? <div className="empty-state"><h2>Chưa thể tải dòng thời gian</h2><p>Kiểm tra kết nối rồi thử lại nhé.</p><button className="btn-secondary" onClick={refresh}>Thử lại</button></div>
          : posts.length === 0 ? <div className="empty-state"><h2>Chưa có bài đăng trong mục này</h2><p>Hãy là người đầu tiên mở chủ đề cho cộng đồng.</p></div>
          : <div className="community-feed-grid">{posts.map((post, index) => <Reveal key={post.id} delay={(index % 3) * 60}><CommunityPostCard post={post} /></Reveal>)}</div>}
        {hasMore && <div className="community-pagination"><button className="btn-secondary" onClick={() => setPage(value => value + 1)}>Xem thêm bài đăng</button></div>}
      </section>
    </div>
  )
}
