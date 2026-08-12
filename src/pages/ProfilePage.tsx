import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { updateProfile, uploadAvatar } from '@/services/api'
import PostCard from '@/components/PostCard'
import { Camera, Bookmark, Rss, Edit2, Save, X, Heart } from 'lucide-react'
import { getInitials, formatDate } from '@/utils'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useProcessing } from '@/hooks/useProcessing'

export default function ProfilePage() {
  const { user, isLoading } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const process = useProcessing()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ username: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'likes' | 'follows'>('bookmarks')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isLoading && !user) navigate('/login')
    if (user) setForm({ username: user.username, bio: user.bio ?? '' })
  }, [user, isLoading])

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bookmarks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('post:posts(*, author:users!posts_author_id_fkey(username, avatar), series:series(name, slug))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data?.map(b => b.post) ?? []
    },
    enabled: !!user,
  })

  const { data: followed = [] } = useQuery({
    queryKey: ['follows', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('series:series(*)')
        .eq('user_id', user!.id)
      if (error) throw error
      return data?.map(f => f.series) ?? []
    },
    enabled: !!user,
  })

  const { data: likedPosts = [] } = useQuery({
    queryKey: ['liked-posts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('likes')
        .select('post:posts(*, author:users!posts_author_id_fkey(username, avatar), series:series(name, slug))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data?.map(item => item.post) ?? []
    },
    enabled: !!user,
  })

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      await process('Đang cập nhật ảnh đại diện...', async () => {
        const url = await uploadAvatar(file, user.id)
        const { error } = await updateProfile(user.id, { avatar: url })
        if (error) throw error
      })
      qc.invalidateQueries({ queryKey: ['user'] })
      toast.success('Đã cập nhật ảnh đại diện')
    } catch {
      toast.error('Không thể cập nhật ảnh đại diện')
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await process('Đang lưu thay đổi hồ sơ...', () => updateProfile(user.id, { username: form.username, bio: form.bio }))
      if (error) { toast.error(error.message); return }
      toast.success('Đã cập nhật hồ sơ')
      setEditing(false)
      qc.invalidateQueries()
    } catch {
      toast.error('Kết nối bị gián đoạn. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="card p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative">
            {user.avatar ? (
              <img src={user.avatar} alt={user.username} className="w-24 h-24 rounded-2xl object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-2xl font-bold"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                {getInitials(user.username)}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#3b82f6', color: 'white' }}
            >
              <Camera size={14} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="input text-lg font-bold" placeholder="Username" />
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  className="input resize-none text-sm" rows={2} placeholder="Bio (optional)" maxLength={200} />
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-4 py-2">
                    <Save size={14} /> Lưu
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-ghost text-sm px-3 py-2">
                    <X size={14} /> Hủy
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>{user.username}</h1>
                  <span className={`badge ${user.role === 'admin' ? 'badge-blue' : 'badge-green'} text-xs`}>{user.role}</span>
                  <button onClick={() => setEditing(true)} className="btn-ghost p-1.5 ml-auto">
                    <Edit2 size={15} />
                  </button>
                </div>
                <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                {user.bio && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user.bio}</p>}
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                  Tham gia {formatDate(user.created_at)}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 mt-6 pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-center">
            <p className="text-xl font-bold">{bookmarks.length}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Đã lưu</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{followed.length}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Đang theo dõi</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{likedPosts.length}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Yêu thích</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['bookmarks', 'likes', 'follows'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-sm px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === tab ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'btn-ghost'
            }`}
          >
            {tab === 'bookmarks'
              ? <><Bookmark size={14} className="inline mr-1" /> Bài viết đã lưu</>
              : tab === 'likes'
                ? <><Heart size={14} className="inline mr-1" /> Bài viết yêu thích</>
                : <><Rss size={14} className="inline mr-1" /> Chuyên đề đang theo dõi</>}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'bookmarks' && (
        bookmarks.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p className="text-4xl mb-3">🔖</p>
            <p>Chưa có bài viết đã lưu. Hãy lưu lại để đọc sau.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {bookmarks.map((post: any) => post && <PostCard key={post.id} post={post} />)}
          </div>
        )
      )}

      {activeTab === 'likes' && (
        likedPosts.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <Heart size={36} className="mx-auto mb-3" />
            <p>Bạn chưa yêu thích bài viết nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {likedPosts.map((post: any) => post && <PostCard key={post.id} post={post} />)}
          </div>
        )
      )}

      {activeTab === 'follows' && (
        followed.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p className="text-4xl mb-3">📚</p>
            <p>Bạn chưa theo dõi chuyên đề nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {followed.map((series: any) => series && (
              <a key={series.id} href={`/series/${series.slug}`}
                className="card p-5 flex items-center gap-4 hover:border-blue-500/30">
                <span className="text-3xl">{({ 'tactical-analysis': '🎯', 'football-legends': '⭐', 'club-history': '🏛️', 'world-cup-stories': '🏆' } as any)[series.slug] ?? '📰'}</span>
                <div>
                  <p className="font-semibold">{series.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{series.description}</p>
                </div>
              </a>
            ))}
          </div>
        )
      )}
    </div>
  )
}
