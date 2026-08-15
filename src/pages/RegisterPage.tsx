import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { signUp } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useProcessing } from '@/hooks/useProcessing'
import { validateEmail, validatePassword, validateUsername } from '@/utils/validation'

export default function RegisterPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const process = useProcessing()
  const [form, setForm] = useState({ email: '', username: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({ username: '', email: '', password: '', confirmPassword: '' })

  useEffect(() => { if (user) navigate('/') }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors = { username: '', email: '', password: '', confirmPassword: '' }
    try { validateUsername(form.username) } catch (error) { nextErrors.username = error instanceof Error ? error.message : 'Tên hiển thị không hợp lệ' }
    try { validateEmail(form.email) } catch (error) { nextErrors.email = error instanceof Error ? error.message : 'Email không hợp lệ' }
    try { validatePassword(form.password) } catch (error) { nextErrors.password = error instanceof Error ? error.message : 'Mật khẩu chưa hợp lệ' }
    if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp'
    setFieldErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
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
                <input type="text" value={form.username} onChange={e => {
                  const value = e.target.value
                  setForm(current => ({ ...current, username: value }))
                  let message = ''
                  if (value) { try { validateUsername(value) } catch (error) { message = error instanceof Error ? error.message : 'Tên hiển thị không hợp lệ' } }
                  setFieldErrors(current => ({ ...current, username: message }))
                }}
                  placeholder="footballfan" className={`input pl-9 ${fieldErrors.username ? 'auth-input-error' : ''}`} aria-invalid={Boolean(fieldErrors.username)} required minLength={3} maxLength={30} />
              </div>
              {fieldErrors.username && <p className="auth-field-error">{fieldErrors.username}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type="email" value={form.email} onChange={e => {
                  const value = e.target.value
                  setForm(current => ({ ...current, email: value }))
                  let message = ''
                  if (value) { try { validateEmail(value) } catch (error) { message = error instanceof Error ? error.message : 'Email không hợp lệ' } }
                  setFieldErrors(current => ({ ...current, email: message }))
                }}
                  placeholder="you@example.com" className={`input pl-9 ${fieldErrors.email ? 'auth-input-error' : ''}`} aria-invalid={Boolean(fieldErrors.email)} required />
              </div>
              {fieldErrors.email && <p className="auth-field-error">{fieldErrors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mật khẩu</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={e => {
                    const value = e.target.value
                    setForm(current => ({ ...current, password: value }))
                    let message = ''
                    if (value) { try { validatePassword(value) } catch (error) { message = error instanceof Error ? error.message : 'Mật khẩu chưa hợp lệ' } }
                    setFieldErrors(current => ({ ...current, password: message, confirmPassword: current.confirmPassword && current.confirmPassword !== value ? 'Mật khẩu xác nhận không khớp' : '' }))
                  }}
                  placeholder="Tối thiểu 8 ký tự" className={`input pl-9 pr-10 ${fieldErrors.password ? 'auth-input-error' : ''}`} aria-invalid={Boolean(fieldErrors.password)} required minLength={8} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <p className="auth-field-error">{fieldErrors.password}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type="password" value={form.confirmPassword}
                  onChange={e => {
                    const value = e.target.value
                    setForm(current => ({ ...current, confirmPassword: value }))
                    setFieldErrors(current => ({ ...current, confirmPassword: value && value !== form.password ? 'Mật khẩu xác nhận không khớp' : '' }))
                  }}
                  placeholder="••••••••" className={`input pl-9 ${fieldErrors.confirmPassword ? 'auth-input-error' : ''}`} aria-invalid={Boolean(fieldErrors.confirmPassword)} required />
              </div>
              {fieldErrors.confirmPassword && <p className="auth-field-error">{fieldErrors.confirmPassword}</p>}
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
