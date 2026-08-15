import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { signIn } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useProcessing } from '@/hooks/useProcessing'
import { getRememberMe } from '@/lib/supabase'
import { validateEmail } from '@/utils/validation'

export default function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const process = useProcessing()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => getRememberMe())
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' })

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailError = !form.email.trim() ? 'Vui lòng nhập email' : (() => { try { validateEmail(form.email); return '' } catch (error) { return error instanceof Error ? error.message : 'Email không hợp lệ' } })()
    const passwordError = !form.password ? 'Vui lòng nhập mật khẩu' : form.password.length < 8 ? 'Mật khẩu cần ít nhất 8 ký tự' : ''
    setFieldErrors({ email: emailError, password: passwordError })
    if (emailError || passwordError) return
    setLoading(true)
    try {
      const { error } = await process('Đang xác thực tài khoản...', () => signIn(form.email, form.password, rememberMe))
      if (error) {
        toast.error(error.message || 'Đăng nhập thất bại')
      } else {
        toast.success('Chào mừng bạn trở lại')
        navigate('/')
      }
    } catch {
      toast.error('Kết nối bị gián đoạn. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] hero-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <BackButton />
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-black"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>FS</div>
          </Link>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-family-display)' }}>Chào mừng trở lại</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Đăng nhập vào tài khoản Football Stories</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => {
                    const value = e.target.value
                    setForm(current => ({ ...current, email: value }))
                    let message = ''
                    if (value.trim()) { try { validateEmail(value) } catch (error) { message = error instanceof Error ? error.message : 'Email không hợp lệ' } }
                    setFieldErrors(current => ({ ...current, email: message }))
                  }}
                  placeholder="you@example.com"
                  className={`input pl-9 ${fieldErrors.email ? 'auth-input-error' : ''}`}
                  aria-invalid={Boolean(fieldErrors.email)}
                  required
                />
              </div>
              {fieldErrors.email && <p className="auth-field-error">{fieldErrors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mật khẩu</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => {
                    const value = e.target.value
                    setForm(current => ({ ...current, password: value }))
                    setFieldErrors(current => ({ ...current, password: value && value.length < 8 ? 'Mật khẩu cần ít nhất 8 ký tự' : '' }))
                  }}
                  placeholder="••••••••"
                  className={`input pl-9 pr-10 ${fieldErrors.password ? 'auth-input-error' : ''}`}
                  aria-invalid={Boolean(fieldErrors.password)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <p className="auth-field-error">{fieldErrors.password}</p>}
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} />
                Ghi nhớ đăng nhập
              </label>
              <Link to="/forgot-password" className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>
                Quên mật khẩu?
              </Link>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>Đăng nhập <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
              Đăng ký ngay
            </Link>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Sau 5 lần đăng nhập sai, tài khoản sẽ tạm thời bị khóa.
        </p>
      </div>
    </div>
  )
}
