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
      keys.forEach(queryKey => {
        void queryClient.invalidateQueries({ queryKey: [queryKey] })
      })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
        refresh(['post', 'posts', 'liked-posts', 'post-interactions', 'admin-stats'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookmarks' }, () => {
        refresh(['bookmarks', 'post-interactions'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        refresh(['follows', 'series-follow'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_shares' }, () => {
        refresh(['post-shares', 'admin-stats'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'series' }, () => {
        refresh(['series', 'admin-series', 'posts'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        refresh(['user', 'admin-users', 'admin-stats'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        refresh(['admin-reports', 'admin-stats'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_gallery_images' }, () => {
        refresh(['post-gallery', 'gallery-admin', 'post'])
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          toast.error('Kết nối cập nhật trực tiếp bị gián đoạn. Hệ thống đang kết nối lại.', {
            id: 'realtime-connection',
          })
        }
      })

    return () => { void supabase.removeChannel(channel) }
  }, [queryClient])

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
