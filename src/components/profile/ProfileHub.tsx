import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Activity, ArrowRight, Bell, BookOpen, ChevronLeft, ChevronRight, Eye, Flame,
  FolderPlus, Hash, Heart, LockKeyhole, MessageCircle, MessagesSquare, Plus,
  Radio, Save, ShieldCheck, Sparkles, Trash2, Trophy, UserPlus, Users,
} from 'lucide-react'
import { getInitials, formatRelativeDate } from '@/utils'
import { useProcessing } from '@/hooks/useProcessing'
import {
  addPostToReadingCollection, createReadingCollection, deleteReadingCollection,
  fetchFollowingData, fetchProfileActivity, fetchProfileBadges, fetchProfileOverview,
  fetchProfilePreferences, fetchReadingCollections, saveProfilePreferences,
  type ProfileActivityItem, type ProfilePreference,
} from '@/services/profile'
import type { PostWithDetails } from '@/types/database'

const activityLabels: Record<string, { label: string; icon: typeof Heart }> = {
  post_view: { label: 'Đã đọc', icon: Eye },
  post_like: { label: 'Đã yêu thích', icon: Heart },
  post_bookmark: { label: 'Đã lưu', icon: BookOpen },
  post_comment: { label: 'Đã bình luận', icon: MessageCircle },
  post_share: { label: 'Đã chia sẻ', icon: ArrowRight },
  series_follow: { label: 'Đã theo dõi chuyên đề', icon: Radio },
  community_like: { label: 'Đã thả cảm xúc', icon: Heart },
  community_bookmark: { label: 'Đã lưu bài cộng đồng', icon: BookOpen },
  community_comment: { label: 'Đã tham gia thảo luận', icon: MessagesSquare },
  community_comment_reaction: { label: 'Đã thả cảm xúc cho bình luận', icon: Heart },
}

const reactionLabels: Record<string, { emoji: string; label: string }> = {
  like: { emoji: '❤️', label: 'Yêu thích' },
  love: { emoji: '😍', label: 'Rất thích' },
  haha: { emoji: '😂', label: 'Haha' },
  wow: { emoji: '😮', label: 'Wow' },
  sad: { emoji: '😢', label: 'Buồn' },
  angry: { emoji: '😡', label: 'Phẫn nộ' },
}

function activityLink(item: ProfileActivityItem) {
  if (item.target_type === 'post' && item.target_slug) return `/posts/${item.target_slug}`
  if (item.target_type === 'series' && item.target_slug) return `/series/${item.target_slug}`
  if (item.target_type?.startsWith('community')) return `/cong-dong#community-${item.target_id}`
  return '/profile'
}

function MiniSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="profile-hub-skeleton">{Array.from({ length: rows }, (_, index) => <div key={index} className="skeleton" />)}</div>
}

export function ProfileOverviewSection({ userId }: { userId: string }) {
  const [activityPage, setActivityPage] = useState(1)
  const overview = useQuery({ queryKey: ['profile-overview', userId], queryFn: fetchProfileOverview })
  const activity = useQuery({
    queryKey: ['profile-activity', userId, activityPage],
    queryFn: () => fetchProfileActivity(activityPage),
    placeholderData: keepPreviousData,
  })
  const badges = useQuery({ queryKey: ['profile-badges', userId], queryFn: () => fetchProfileBadges(userId) })
  const data = overview.data
  const totalPages = Math.ceil((activity.data?.total ?? 0) / 10)
  const creatorHasContent = Boolean(data && data.community_posts + data.reels > 0)

  return (
    <div className="profile-hub-stack">
      <section aria-labelledby="activity-overview-title">
        <div className="profile-section-heading">
          <div><p className="eyebrow"><Activity size={14} /> Tổng quan hoạt động</p><h2 id="activity-overview-title">Nhịp đọc của bạn.</h2></div>
          <span>Thống kê từ hoạt động đã đồng bộ</span>
        </div>
        {overview.isLoading ? <MiniSkeleton rows={2} /> : overview.isError ? <p className="profile-inline-error">Chưa thể tải thống kê. Hãy thử lại sau.</p> : (
          <div className="profile-overview-grid">
            <article className="profile-reading-hero">
              <BookOpen size={22} /><strong>{data?.reading_minutes ?? 0}</strong><span>phút đọc tích lũy</span>
              <small>{data?.articles_read ?? 0} bài đã đọc</small>
            </article>
            <article><Flame size={18} /><strong>{data?.reading_streak ?? 0}</strong><span>ngày đọc liên tục</span></article>
            <article><Activity size={18} /><strong>{data?.activity_30d ?? 0}</strong><span>hoạt động trong 30 ngày</span></article>
            <article><Users size={18} /><strong>{data?.followers ?? 0}</strong><span>người theo dõi</span></article>
          </div>
        )}
      </section>

      <div className="profile-hub-columns">
        <section className="profile-panel" aria-labelledby="personal-activity-title">
          <div className="profile-panel-head"><div><p className="eyebrow">Dòng cá nhân</p><h3 id="personal-activity-title">Hoạt động gần đây</h3></div><Activity size={18} /></div>
          {activity.isLoading ? <MiniSkeleton rows={5} /> : activity.isError ? <p className="profile-inline-error">Không tải được dòng hoạt động.</p> : activity.data?.items.length ? (
            <div className="profile-activity-list">
              {activity.data.items.map((item) => {
                const meta = activityLabels[item.event_type] ?? { label: 'Đã hoạt động', icon: Activity }
                const Icon = meta.icon
                const reaction = item.reaction ? reactionLabels[item.reaction] : null
                return <Link key={item.id} to={activityLink(item)} className="profile-activity-item"><span><Icon size={15} /></span><div><p>{reaction ? `${reaction.emoji} ${reaction.label}` : meta.label}{item.reply_to_name && <em> · trả lời {item.reply_to_name}</em>}</p><strong>{item.target_title}</strong>{item.context_text && <blockquote>“{item.context_text}”</blockquote>}<small>{formatRelativeDate(item.created_at)}</small></div><ArrowRight size={14} /></Link>
              })}
            </div>
          ) : <div className="profile-compact-empty"><Activity size={20} /><p>Chưa có hoạt động để hiển thị.</p></div>}
          {totalPages > 1 && <div className="profile-mini-pagination"><button onClick={() => setActivityPage(p => p - 1)} disabled={activityPage === 1 || activity.isFetching}><ChevronLeft size={14} /></button><span>{activityPage}/{totalPages}</span><button onClick={() => setActivityPage(p => p + 1)} disabled={activityPage >= totalPages || activity.isFetching}><ChevronRight size={14} /></button></div>}
        </section>

        <aside className="profile-hub-aside">
          <section className="profile-panel">
            <div className="profile-panel-head"><div><p className="eyebrow">Dấu mốc</p><h3>Huy hiệu thành viên</h3></div><Trophy size={18} /></div>
            {badges.isLoading ? <MiniSkeleton /> : badges.data?.length ? <div className="profile-badge-list">{badges.data.map((item) => <article key={item.id}><span><Sparkles size={16} /></span><div><strong>{item.badge?.name}</strong><p>{item.badge?.description}</p></div></article>)}</div> : <div className="profile-compact-empty"><Trophy size={20} /><p>Đọc và đóng góp để mở khóa huy hiệu đầu tiên.</p></div>}
          </section>
        </aside>
      </div>

      <section className="profile-creator-panel" aria-labelledby="creator-profile-title">
        <div><p className="eyebrow"><Sparkles size={14} /> Creator profile</p><h2 id="creator-profile-title">Dấu ấn của bạn trong cộng đồng.</h2><p>{creatorHasContent ? 'Hiệu quả được tính từ nội dung đã xuất bản và tương tác thật.' : 'Bắt đầu chia sẻ góc nhìn eFootball để xây dựng cộng đồng theo dõi riêng.'}</p></div>
        {creatorHasContent ? <div className="profile-creator-metrics"><span><strong>{data?.community_posts}</strong>Bài viết</span><span><strong>{data?.reels}</strong>Reels</span><span><strong>{data?.followers}</strong>Followers</span><span><strong>{data?.engagement_rate}%</strong>Tương tác</span></div> : <Link to="/cong-dong" className="btn-primary">Tạo bài đầu tiên <ArrowRight size={15} /></Link>}
      </section>
    </div>
  )
}

export function ProfileCollectionsSection({ userId, bookmarks }: { userId: string; bookmarks: PostWithDetails[] }) {
  const qc = useQueryClient()
  const process = useProcessing()
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCollection, setSelectedCollection] = useState('')
  const [selectedPost, setSelectedPost] = useState('')
  const collections = useQuery({ queryKey: ['reading-collections', userId], queryFn: () => fetchReadingCollections(userId) })
  const createMutation = useMutation({
    mutationFn: () => process('Đang tạo bộ sưu tập...', () => createReadingCollection(userId, { name: name.trim(), description: description.trim() || null, color: 'lime' })),
    onSuccess: () => { setName(''); setDescription(''); setFormOpen(false); qc.invalidateQueries({ queryKey: ['reading-collections', userId] }); toast.success('Đã tạo bộ sưu tập') },
    onError: () => toast.error('Tên bộ sưu tập đã tồn tại hoặc chưa hợp lệ.'),
  })
  const addMutation = useMutation({
    mutationFn: () => process('Đang thêm bài viết...', () => addPostToReadingCollection(selectedCollection, selectedPost)),
    onSuccess: () => { setSelectedPost(''); qc.invalidateQueries({ queryKey: ['reading-collections', userId] }); toast.success('Đã thêm vào bộ sưu tập') },
    onError: () => toast.error('Bài viết đã có trong bộ sưu tập này.'),
  })
  const remove = async (id: string) => {
    await process('Đang xóa bộ sưu tập...', () => deleteReadingCollection(id))
    await qc.invalidateQueries({ queryKey: ['reading-collections', userId] })
    toast.success('Đã xóa bộ sưu tập')
  }

  return <div className="profile-hub-stack">
    <section>
      <div className="profile-section-heading"><div><p className="eyebrow"><BookOpen size={14} /> Bộ sưu tập bài viết</p><h2>Gom câu chuyện theo cách của bạn.</h2></div><button className="btn-primary" onClick={() => setFormOpen(value => !value)}><FolderPlus size={15} /> Tạo bộ sưu tập</button></div>
      {formOpen && <form className="profile-collection-form" onSubmit={(event) => { event.preventDefault(); if (name.trim().length >= 2) createMutation.mutate() }}><label>Tên bộ sưu tập<input className="input" value={name} onChange={event => setName(event.target.value)} maxLength={60} required minLength={2} placeholder="Ví dụ: Chiến thuật hay" /></label><label>Mô tả<input className="input" value={description} onChange={event => setDescription(event.target.value)} maxLength={240} placeholder="Ghi chú ngắn, không bắt buộc" /></label><button className="btn-secondary" disabled={createMutation.isPending}><Plus size={14} /> Tạo mới</button></form>}
      {collections.isLoading ? <MiniSkeleton rows={2} /> : collections.data?.length ? <div className="profile-collection-grid">{collections.data.map(collection => <article key={collection.id} className={`profile-collection-card is-${collection.color}`}><div><span>{collection.items_count.toString().padStart(2, '0')}</span><small>bài viết</small></div><h3>{collection.name}</h3><p>{collection.description || 'Một bộ sưu tập đọc riêng của bạn.'}</p><button onClick={() => void remove(collection.id)} aria-label={`Xóa ${collection.name}`}><Trash2 size={14} /></button></article>)}</div> : <div className="profile-large-empty"><FolderPlus size={26} /><h3>Chưa có bộ sưu tập</h3><p>Tạo một chủ đề rồi thêm các bài đã lưu vào đó.</p></div>}
    </section>
    {collections.data?.length && bookmarks.length ? <section className="profile-panel"><div className="profile-panel-head"><div><p className="eyebrow">Sắp xếp nhanh</p><h3>Thêm bài đã lưu vào bộ sưu tập</h3></div></div><div className="profile-collection-assignment"><select className="input" value={selectedCollection} onChange={e => setSelectedCollection(e.target.value)}><option value="">Chọn bộ sưu tập</option>{collections.data.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="input" value={selectedPost} onChange={e => setSelectedPost(e.target.value)}><option value="">Chọn bài viết</option>{bookmarks.map(post => <option key={post.id} value={post.id}>{post.title}</option>)}</select><button className="btn-primary" disabled={!selectedCollection || !selectedPost || addMutation.isPending} onClick={() => addMutation.mutate()}><Plus size={14} /> Thêm</button></div></section> : null}
  </div>
}

export function ProfileFollowingSection({ userId }: { userId: string }) {
  const [tab, setTab] = useState<'users' | 'series' | 'tags'>('users')
  const following = useQuery({ queryKey: ['profile-following', userId], queryFn: () => fetchFollowingData(userId) })
  const tabs = [{ id: 'users' as const, label: 'Người dùng', count: following.data?.users.length ?? 0 }, { id: 'series' as const, label: 'Chuyên mục', count: following.data?.series.length ?? 0 }, { id: 'tags' as const, label: 'Hashtag', count: following.data?.tags.length ?? 0 }]
  return <section><div className="profile-section-heading"><div><p className="eyebrow"><UserPlus size={14} /> Khu vực theo dõi</p><h2>Những tín hiệu bạn quan tâm.</h2></div></div><div className="profile-follow-tabs">{tabs.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}<span>{item.count}</span></button>)}</div>{following.isLoading ? <MiniSkeleton rows={4} /> : <div className="profile-follow-grid">{tab === 'users' && following.data?.users.map(item => <Link to={`/cong-dong?author=${item.id}`} key={item.id} className="profile-follow-card">{item.avatar ? <img src={item.avatar} alt="" /> : <span>{getInitials(item.username)}</span>}<div><strong>{item.username}</strong><p>{item.bio || 'Thành viên Football Stories'}</p></div><ArrowRight size={14} /></Link>)}{tab === 'series' && following.data?.series.map(item => <Link to={`/series/${item.slug}`} key={item.id} className="profile-follow-card"><span><Radio size={17} /></span><div><strong>{item.name}</strong><p>{item.description || 'Chuyên đề đang theo dõi'}</p></div><ArrowRight size={14} /></Link>)}{tab === 'tags' && following.data?.tags.map(item => <Link to={`/cong-dong?tag=${item.slug}`} key={item.id} className="profile-follow-card"><span><Hash size={17} /></span><div><strong>#{item.name}</strong><p>Xem bài viết mới nhất</p></div><ArrowRight size={14} /></Link>)}</div>} {!following.isLoading && !following.data?.[tab].length && <div className="profile-large-empty"><UserPlus size={25} /><h3>Chưa theo dõi nội dung nào</h3><p>Khám phá cộng đồng để cá nhân hóa dòng nội dung của bạn.</p><Link to="/cong-dong" className="btn-secondary">Đi tới cộng đồng</Link></div>}</section>
}

function SettingToggle({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return <label className="profile-setting-row"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><i aria-hidden="true" /></label>
}

export function ProfileSettingsSection({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const process = useProcessing()
  const preferences = useQuery({ queryKey: ['profile-preferences', userId], queryFn: () => fetchProfilePreferences(userId) })
  const [draft, setDraft] = useState<ProfilePreference | null>(null)
  const current = draft ?? preferences.data
  const update = (key: keyof ProfilePreference, value: boolean | string) => current && setDraft({ ...current, [key]: value })
  const save = async () => {
    if (!current) return
    try { await process('Đang lưu cài đặt...', () => saveProfilePreferences(current)); setDraft(null); await qc.invalidateQueries({ queryKey: ['profile-preferences', userId] }); toast.success('Đã lưu cài đặt cá nhân') } catch { toast.error('Không thể lưu cài đặt lúc này.') }
  }
  if (preferences.isLoading || !current) return <MiniSkeleton rows={5} />
  return <div className="profile-settings-layout"><section className="profile-panel"><div className="profile-panel-head"><div><p className="eyebrow"><LockKeyhole size={14} /> Riêng tư</p><h3>Quyền hiển thị hồ sơ</h3></div><ShieldCheck size={18} /></div><label className="profile-visibility-field">Ai có thể xem hồ sơ<select className="input" value={current.profile_visibility} onChange={event => update('profile_visibility', event.target.value)}><option value="public">Mọi người</option><option value="members">Chỉ thành viên</option><option value="private">Chỉ mình tôi</option></select></label><SettingToggle checked={current.show_activity} onChange={value => update('show_activity', value)} title="Hiển thị dòng hoạt động" description="Cho phép hiển thị hoạt động gần đây trên hồ sơ công khai." /><SettingToggle checked={current.show_reading_stats} onChange={value => update('show_reading_stats', value)} title="Hiển thị thống kê đọc" description="Chia sẻ số bài, phút đọc và streak của bạn." /></section><section className="profile-panel"><div className="profile-panel-head"><div><p className="eyebrow"><Bell size={14} /> Thông báo</p><h3>Chọn điều đáng chú ý</h3></div><Bell size={18} /></div><SettingToggle checked={current.notify_mentions} onChange={value => update('notify_mentions', value)} title="Mention" description="Khi có người nhắc đến bạn." /><SettingToggle checked={current.notify_replies} onChange={value => update('notify_replies', value)} title="Phản hồi" description="Khi bình luận của bạn có reply mới." /><SettingToggle checked={current.notify_follows} onChange={value => update('notify_follows', value)} title="Người theo dõi mới" description="Khi một thành viên bắt đầu theo dõi bạn." /><SettingToggle checked={current.notify_new_content} onChange={value => update('notify_new_content', value)} title="Nội dung đang theo dõi" description="Bài mới từ chuyên mục và hashtag của bạn." /><SettingToggle checked={current.email_notifications} onChange={value => update('email_notifications', value)} title="Nhận qua email" description="Nhận bản tóm tắt qua email tài khoản." /></section><button className="btn-primary profile-settings-save" onClick={() => void save()} disabled={!draft}><Save size={15} /> Lưu cài đặt</button></div>
}
