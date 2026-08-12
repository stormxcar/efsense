import { useIsMutating } from '@tanstack/react-query'
import { useUIStore } from '@/store'

export default function GlobalProcessingOverlay() {
  const mutationCount = useIsMutating()
  const manualCount = useUIStore(state => state.processingCount)
  const message = useUIStore(state => state.processingMessage)
  const visible = mutationCount + manualCount > 0

  if (!visible) return null
  return (
    <div className="processing-overlay" role="alert" aria-live="assertive" aria-busy="true">
      <div className="processing-overlay-panel">
        <div className="processing-mark">FS</div>
        <span className="processing-spinner" />
        <p>{manualCount > 0 ? message : 'Đang xử lý yêu cầu...'}</p>
        <span>Vui lòng không đóng hoặc tải lại trang.</span>
      </div>
    </div>
  )
}
