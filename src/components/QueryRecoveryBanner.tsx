import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'

export default function QueryRecoveryBanner() {
  const queryClient = useQueryClient()
  const [failedQueries, setFailedQueries] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const update = () => {
      const failed = queryClient.getQueryCache().getAll()
        .filter(query => query.state.status === 'error').length
      setFailedQueries(failed)
      if (failed === 0) setDismissed(false)
    }

    update()
    return queryClient.getQueryCache().subscribe(update)
  }, [queryClient])

  if (failedQueries === 0 || dismissed) return null

  const retry = async () => {
    setRetrying(true)
    try {
      await queryClient.refetchQueries({
        predicate: query => query.state.status === 'error' && query.getObserversCount() > 0,
      })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <aside className="query-recovery-banner" role="alert" aria-live="polite">
      <AlertTriangle size={18} />
      <div>
        <strong>Một phần dữ liệu chưa tải được</strong>
        <span>Kết nối có thể đang chậm. Bạn không cần tải lại trình duyệt.</span>
      </div>
      <button type="button" onClick={retry} disabled={retrying}>
        <RefreshCw size={15} className={retrying ? 'animate-spin' : ''} />
        {retrying ? 'Đang thử lại' : 'Thử lại'}
      </button>
      <button type="button" className="query-recovery-close" onClick={() => setDismissed(true)} aria-label="Đóng thông báo">
        <X size={16} />
      </button>
    </aside>
  )
}
