import { useState } from 'react'
import { AtSign, Bell, BookOpen, CheckCheck, FileText, Heart, Inbox, MessageSquare, Reply, Share2, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchNotifications,
  markNotificationGroupRead,
  markAllNotificationsRead,
} from '@/services/api'
import { formatRelativeDate } from '@/utils'
import type { GroupedNotificationRow } from '@/types/database'

const NOTIF_ICONS: Record<string, LucideIcon> = {
  new_post: FileText,
  new_series_post: BookOpen,
  comment_reply: MessageSquare,
  post_comment: MessageSquare,
  post_like: Heart,
  post_share: Share2,
  community_like: Heart,
  community_comment: MessageSquare,
  community_reply: MessageSquare,
  mention: Bell,
  user_follow: Bell,
  admin_alert: Bell,
}

interface Props {
  userId: string
  onClose: () => void
}

export default function NotificationDropdown({ userId, onClose }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'unread' | 'mention' | 'replies'>('all')
  const { data: notifications = [], isLoading, isError } = useQuery({
    queryKey: ['notifications', userId, filter],
    queryFn: () => fetchNotifications(userId, 30, filter).then((r) => { if (r.error) throw r.error; return r.data }),
    refetchInterval: false,
  })

  const markRead = useMutation({
    mutationFn: (ids: string[]) => markNotificationGroupRead(ids).then(() => {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  })

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(userId).then(() => {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  })

  const unread = notifications.reduce((total, notification) => total + (!notification.is_read ? notification.group_count : 0), 0)
  const filters = [
    { id: 'all' as const, label: 'Tất cả', Icon: Inbox },
    { id: 'unread' as const, label: 'Chưa đọc', Icon: Bell },
    { id: 'mention' as const, label: 'Được nhắc', Icon: AtSign },
    { id: 'replies' as const, label: 'Phản hồi', Icon: Reply },
  ]

  return (
    <div
      className="notification-dropdown absolute right-0 top-full mt-2 w-80 card animate-fade-in-up"
      style={{ zIndex: 100, maxHeight: '420px', display: 'flex', flexDirection: 'column' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <Bell size={15} />
          <span className="font-semibold text-sm">Thông báo</span>
          {unread > 0 && (
            <span className="badge badge-blue text-xs px-1.5 py-0.5">{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAll.mutate()}
            className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
            title="Đánh dấu tất cả đã đọc"
          >
            <CheckCheck size={13} /> Đã đọc tất cả
          </button>
        )}
      </div>

      <div className="notification-filters" role="tablist" aria-label="Lọc thông báo">
        {filters.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}><item.Icon size={12} /> {item.label}</button>)}
      </div>

      <div className="overflow-y-auto flex-1">
        {isLoading ? <div className="p-4 space-y-2">{[1, 2, 3].map(item => <div key={item} className="skeleton h-16 rounded-lg" />)}</div> : isError ? <div className="py-8 px-4 text-center text-xs" style={{ color: '#f59e0b' }}>Không thể tải thông báo. Vui lòng thử lại.</div> : notifications.length === 0 ? (
          <div className="py-10 text-center" style={{ color: 'var(--text-muted)' }}>
            <Bell size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Chưa có thông báo</p>
          </div>
        ) : (
          notifications.map((n: GroupedNotificationRow) => {
            const NotificationIcon = NOTIF_ICONS[n.type] ?? Bell
            return <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-colors hover:bg-white/5 ${!n.is_read ? 'bg-blue-500/5' : ''}`}
              style={{ borderColor: 'rgba(255,255,255,0.04)' }}
              onClick={() => {
                if (!n.is_read) markRead.mutate(n.notification_ids)
                if (n.link) { onClose(); navigate(n.link) }
              }}
            >
              <span className="w-8 h-8 rounded-lg shrink-0 mt-0.5 grid place-items-center" style={{ background: 'var(--bg-hover)', color: 'var(--accent)' }}>
                <NotificationIcon size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{n.title}</p>
                {n.body && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{n.body}</p>}
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatRelativeDate(n.created_at)}{n.group_count > 1 ? ` · ${n.group_count} hoạt động được gom` : ''}</p>
              </div>
              {!n.is_read && (
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
              )}
            </div>
          })
        )}
      </div>
    </div>
  )
}
