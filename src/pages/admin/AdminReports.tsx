import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchReports, updateReportStatus } from '@/services/api'
import { AlertTriangle, X, Lock } from 'lucide-react'
import { formatRelativeDate } from '@/utils'
import Tooltip from '@/components/Tooltip'
import toast from 'react-hot-toast'
import ExpandableText from '@/components/ExpandableText'

type AdminReport = {
  id: string
  reason: string
  description: string | null
  status: 'pending' | 'ignored' | 'warned' | 'locked'
  created_at: string
  reporter?: { username?: string | null } | null
  reported?: { username?: string | null; status?: string | null } | null
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Nội dung rác',
  harassment: 'Quấy rối',
  offensive_content: 'Nội dung phản cảm',
  fake_information: 'Thông tin sai lệch',
  other: 'Lý do khác',
}

export default function AdminReports() {
  const qc = useQueryClient()

  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => fetchReports().then(r => r.data ?? []),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ignored' | 'warned' | 'locked' }) =>
      updateReportStatus(id, status).then(() => {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-reports'] }); toast.success('Đã cập nhật báo cáo') },
  })

  const pending = reports.filter((r: AdminReport) => r.status === 'pending')
  const resolved = reports.filter((r: AdminReport) => r.status !== 'pending')

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Quản lý báo cáo</h1>
        {pending.length > 0 && (
          <span className="badge badge-red text-sm">{pending.length} đang chờ</span>
        )}
      </div>

      {/* Pending Reports */}
      <h2 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <AlertTriangle size={16} className="text-orange-400" /> Báo cáo đang chờ xử lý
      </h2>
      {pending.length === 0 ? (
        <div className="card p-8 text-center mb-8" style={{ color: 'var(--text-muted)' }}>
          <p className="text-3xl mb-2">✅</p>
          <p>Không có báo cáo nào đang chờ xử lý.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-10">
          {pending.map((report: AdminReport) => (
            <ReportCard key={report.id} report={report} onAction={(status) => statusMutation.mutate({ id: report.id, status })} />
          ))}
        </div>
      )}

      {/* Resolved Reports */}
      {resolved.length > 0 && (
        <>
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Báo cáo đã xử lý</h2>
          <div className="space-y-3">
            {resolved.map((report: AdminReport) => (
              <ReportCard key={report.id} report={report} resolved />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ReportCard({ report, onAction, resolved }: {
  report: AdminReport
  onAction?: (status: 'ignored' | 'warned' | 'locked') => void
  resolved?: boolean
}) {
  return (
    <div className={`card p-5 ${resolved ? 'opacity-60' : ''}`}>
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-red text-xs">{REASON_LABELS[report.reason] ?? report.reason}</span>
            <span className={`badge text-xs ${
              report.status === 'pending' ? 'badge-orange' :
              report.status === 'ignored' ? '' :
              report.status === 'warned' ? 'badge-orange' : 'badge-red'
            }`} style={report.status === 'ignored' ? { background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)' } : {}}>
              {report.status === 'pending' ? 'Đang chờ' : report.status === 'ignored' ? 'Đã bỏ qua' : report.status === 'warned' ? 'Đã cảnh báo' : 'Đã khóa'}
            </span>
          </div>
          <div className="text-sm">
            <span style={{ color: 'var(--text-muted)' }}>Người báo cáo: </span>
            <span className="font-medium">{report.reporter?.username}</span>
            <span className="mx-2" style={{ color: 'var(--text-muted)' }}>→</span>
            <span style={{ color: 'var(--text-muted)' }}>Người bị báo cáo: </span>
            <span className="font-medium">{report.reported?.username}</span>
            <span className={`ml-2 badge text-xs ${report.reported?.status === 'active' ? 'badge-green' : 'badge-red'}`}>
              {report.reported?.status}
            </span>
          </div>
          {report.description && <ExpandableText text={report.description} className="text-sm p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)' }} label="mô tả" />}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatRelativeDate(report.created_at)}</p>
        </div>

        {!resolved && onAction && (
          <div className="flex gap-2 shrink-0">
            <Tooltip content="Bỏ qua báo cáo này" placement="top">
              <button onClick={() => onAction('ignored')} className="btn-ghost text-xs px-3 py-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <X size={13} /> Bỏ qua
              </button>
            </Tooltip>
            <Tooltip content="Gửi cảnh báo đến người dùng" placement="top">
              <button onClick={() => onAction('warned')} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1" style={{ color: '#fb923c' }}>
                <AlertTriangle size={13} /> Cảnh báo
              </button>
            </Tooltip>
            <Tooltip content="Khóa tài khoản người bị báo cáo" placement="top">
              <button onClick={() => onAction('locked')} className="btn-ghost text-xs px-3 py-2 flex items-center gap-1" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Lock size={13} /> Khóa tài khoản
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
