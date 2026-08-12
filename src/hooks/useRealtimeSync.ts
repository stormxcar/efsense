import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { NotificationRow, PostRow } from '@/types/database'

export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    const refresh = (keys: string[]) => {
      void Promise.all([...new Set(keys)].map(queryKey => queryClient.invalidateQueries({ queryKey: [queryKey], refetchType: 'active' })))
    }

    const channel = supabase
      .channel('football-stories-global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, payload => {
        const post = payload.new as Partial<PostRow>
        const oldPost = payload.old as Partial<PostRow>
        refresh(['posts', 'post', 'related', 'weekly-popular', 'admin-posts', 'admin-stats', 'admin-recent-posts', 'admin-charts', 'media'])
        if (
          (payload.eventType === 'INSERT' && post.status === 'published') ||
          (payload.eventType === 'UPDATE' && oldPost.status !== 'published' && post.status === 'published')
        ) {
          toast.success(`Bài viết mới: ${post.title ?? 'Football Stories'}`, {
            id: `realtime-post-${post.id}`,
            duration: 4500,
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, payload => {
        refresh(['comments', 'admin-comments', 'admin-stats'])
        if (payload.eventType === 'INSERT') {
          toast('Vừa có bình luận hoặc phản hồi mới.', {
            id: `realtime-comment-${(payload.new as { id?: string }).id}`,
            className: 'realtime-toast',
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, payload => {
        refresh(['post', 'posts', 'liked-posts', 'post-interactions', 'admin-stats'])
        if (payload.eventType === 'INSERT') toast('Một bài viết vừa nhận lượt thích mới.', { id: `realtime-like-${(payload.new as { post_id?: string; user_id?: string }).post_id}-${(payload.new as { user_id?: string }).user_id}`, className: 'realtime-toast' })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookmarks' }, () => {
        refresh(['bookmarks', 'post-interactions'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        refresh(['follows', 'series-follow'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_shares' }, payload => {
        refresh(['post-shares', 'admin-stats'])
        if (payload.eventType === 'INSERT') toast('Một bài viết vừa được chia sẻ.', { id: `realtime-share-${(payload.new as { id?: string }).id}`, className: 'realtime-toast' })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'series' }, () => {
        refresh(['series', 'admin-series', 'posts'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
        refresh(['user', 'admin-users', 'admin-stats'])
        const changed = payload.new as { id?: string; status?: string }
        if (changed.id === user?.id && changed.status && changed.status !== 'active') {
          void supabase.auth.signOut()
          toast.error('Tài khoản đã bị tạm khóa hoặc cấm. Bạn đã được đăng xuất từ xa.', { id: 'remote-account-lock' })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        refresh(['admin-reports', 'admin-stats'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_gallery_images' }, () => {
        refresh(['post-gallery', 'gallery-admin', 'post'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, payload => {
        refresh(['community-posts', 'community-comments', 'community-like'])
        if (payload.eventType === 'INSERT' && (payload.new as { status?: string }).status === 'published') {
          toast.success('Có bài đăng mới trong cộng đồng eFootball.', { id: `community-post-${(payload.new as { id?: string }).id}` })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_post_comments' }, payload => {
        refresh(['community-comments', 'community-posts'])
        if (payload.eventType === 'INSERT') toast('Có bình luận mới trong cộng đồng eFootball.', { id: `community-comment-${(payload.new as { id?: string }).id}` })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_post_likes' }, payload => {
        refresh(['community-like', 'community-posts'])
        if (payload.eventType === 'INSERT') toast('Tương tác cộng đồng vừa được cập nhật.', { id: 'realtime-community-like', className: 'realtime-toast' })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'history_timeline_events' }, payload => {
        refresh(['timeline-events', 'admin-timeline'])
        if (payload.eventType === 'INSERT' && (payload.new as { status?: string }).status === 'published') toast.success('Timeline bóng đá vừa có cột mốc mới.', { id: `timeline-event-${(payload.new as { id?: string }).id}` })
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          toast.error('Kết nối cập nhật trực tiếp bị gián đoạn. Hệ thống đang kết nối lại.', {
            id: 'realtime-connection',
          })
        }
      })

    return () => { void supabase.removeChannel(channel) }
  }, [queryClient, user?.id])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`football-stories-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        payload => {
          const notification = payload.new as NotificationRow
          void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
          toast(notification.title, {
            id: `notification-${notification.id}`,
            duration: 5000,
            className: 'realtime-toast',
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [queryClient, user?.id])
}

export function RealtimeSync() {
  useRealtimeSync()
  return null
}
