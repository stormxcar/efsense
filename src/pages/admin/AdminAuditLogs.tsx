import { useQuery } from '@tanstack/react-query'
import { fetchAuditLogs } from '@/services/api'
import { formatRelativeDate } from '@/utils'
import { ClipboardList } from 'lucide-react'

const actionLabels: Record<string, string> = { create: 'Tạo', update: 'Sửa', delete: 'Xóa', publish: 'Xuất bản', hide: 'Ẩn', restore: 'Khôi phục', lock: 'Khóa', unlock: 'Mở khóa', revoke_sessions: 'Thu hồi phiên', approve: 'Duyệt', reject: 'Từ chối' }
const entityLabels: Record<string, string> = { posts: 'Bài viết', users: 'Người dùng', series: 'Chuyên đề', community_posts: 'Bài cộng đồng', comments: 'Bình luận', reports: 'Báo cáo' }

export default function AdminAuditLogs() {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-audit-logs'], queryFn: () => fetchAuditLogs().then(result => { if (result.error) throw result.error; return result.data ?? [] }) })
  return <div className="p-8"><div className="flex items-center gap-3 mb-6"><ClipboardList size={21} className="text-blue-400" /><div><h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Nhật ký quản trị</h1><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Theo dõi mọi thay đổi quan trọng trong hệ thống.</p></div></div>
    {error ? <div className="empty-state">Không thể tải nhật ký.</div> : <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b">{['Thời gian', 'Người thực hiện', 'Thao tác', 'Đối tượng'].map(label => <th key={label} className="text-left px-4 py-3 text-xs uppercase" style={{ color: 'var(--text-muted)' }}>{label}</th>)}</tr></thead><tbody>{isLoading ? <tr><td colSpan={4} className="p-6 text-center">Đang tải…</td></tr> : (data ?? []).map(log => <tr key={log.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}><td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{formatRelativeDate(log.created_at)}</td><td className="px-4 py-3">{log.actor?.username ?? 'Hệ thống'}</td><td className="px-4 py-3"><span className="badge badge-blue text-xs">{actionLabels[log.action] ?? log.action}</span></td><td className="px-4 py-3">{entityLabels[log.entity_type] ?? log.entity_type}</td></tr>)}</tbody></table></div></div>}
  </div>
}
