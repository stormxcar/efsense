import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = true,
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !loading) onCancel() }}>
      <div className="fixed inset-0 bg-black/65 backdrop-blur-sm" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: danger ? 'rgba(248,113,113,.14)' : 'var(--accent-soft)', color: danger ? '#f87171' : 'var(--accent)' }}><AlertTriangle size={19} /></span>
          <div className="min-w-0 flex-1"><h2 id="confirm-modal-title" className="text-base font-bold">{title}</h2><p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{message}</p></div>
          <button type="button" className="btn-ghost p-1" onClick={onCancel} disabled={loading} aria-label="Đóng hộp thoại"><X size={17} /></button>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-ghost text-sm" onClick={onCancel} disabled={loading}>{cancelLabel}</button><button type="button" className={danger ? 'btn-danger text-sm' : 'btn-primary text-sm'} onClick={onConfirm} disabled={loading}>{loading ? 'Đang xử lý...' : confirmLabel}</button></div>
      </div>
    </div>
  )
}
