import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function BackButton({ fallback = '/' }: { fallback?: string }) {
  const navigate = useNavigate()

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(fallback)
  }

  return (
    <button type="button" onClick={goBack} className="btn-ghost auth-back">
      <ArrowLeft size={16} /> Quay lại
    </button>
  )
}
