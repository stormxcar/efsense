import { useState } from 'react'
import { ArrowRight, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { subscribeNewsletter } from '@/services/api'
import { useProcessing } from '@/hooks/useProcessing'

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const process = useProcessing()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const { error } = await process('Đang đăng ký nhận bản tin...', () => subscribeNewsletter(email))
      if (error) {
        toast.error('Email chưa hợp lệ hoặc chưa thể đăng ký lúc này')
        return
      }
      setEmail('')
      toast.success('Đã đăng ký nhận câu chuyện mới từ Football Stories.')
    } catch {
      toast.error('Kết nối bị gián đoạn. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="newsletter-form">
      <label htmlFor="newsletter-email">
        <Mail size={15} /> Nhận câu chuyện mới mỗi tuần
      </label>
      <div>
        <input id="newsletter-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="email@cuaban.vn" required />
        <button type="submit" disabled={loading} aria-label="Đăng ký nhận bản tin">
          {loading ? <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : <ArrowRight size={17} />}
        </button>
      </div>
      <p>Không spam. Chỉ bài viết mới và tuyển tập đáng đọc.</p>
    </form>
  )
}
