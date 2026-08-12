import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { signUp } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useProcessing } from '@/hooks/useProcessing'

export default function RegisterPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const process = useProcessing()
  const [form, setForm] = useState({ email: '', username: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (user) navigate('/') }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    if (form.password.length < 8) {
      toast.error('Mật khẩu phải có ít nhất 8 ký tự')
      return
    }
    setLoading(true)
    try {
      const { error } = await process('Đang tạo tài khoản...', () => signUp(form.email, form.password, form.username))
      if (error) {
        toast.error(error.message || 'Đăng ký thất bại')
      } else {
        toast.success('Đã tạo tài khoản. Vui lòng kiểm tra email để xác minh')
        navigate('/login')
      }
    } catch {
      toast.error('Kết nối bị gián đoạn. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] hero-gradient flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <BackButton />
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-black"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>FS</div>
          </Link>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-family-display)' }}>Tham gia Football Stories</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tạo tài khoản miễn phí</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Tên hiển thị</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                  placeholder="footballfan" className="input pl-9" required minLength={3} maxLength={30} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com" className="input pl-9" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mật khẩu</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Tối thiểu 8 ký tự" className="input pl-9 pr-10" required minLength={8} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type="password" value={form.confirmPassword}
                  onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="••••••••" className="input pl-9" required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <>Tạo tài khoản <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-medium" style={{ color: 'var(--accent)' }}>Đăng nhập</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
