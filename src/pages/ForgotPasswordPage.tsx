import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import BackButton from '@/components/BackButton'
import { useProcessing } from '@/hooks/useProcessing'
import { validateEmail } from '@/utils/validation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const process = useProcessing()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let validationError = ''
    try { validateEmail(email) } catch (validation) { validationError = validation instanceof Error ? validation.message : 'Email không hợp lệ' }
    setFieldError(validationError)
    if (validationError) return

    setLoading(true)
    setError('')

    try {
      const { error: err } = await process('Đang gửi liên kết đặt lại mật khẩu...', () =>
        supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
      )
      if (err) {
        setError(err.message)
      } else {
        setSent(true)
      }
    } catch {
      setError('Kết nối bị gián đoạn. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        <BackButton fallback="/login" />
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>FS</div>
            <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>
              Football <span className="gradient-text">Stories</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>
            Quên mật khẩu
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            Nhập email để nhận liên kết đặt lại mật khẩu
          </p>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
              <h2 className="text-lg font-bold mb-2">Hãy kiểm tra hộp thư</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Chúng tôi đã gửi liên kết đặt lại mật khẩu tới{' '}
                <strong className="text-blue-400">{email}</strong>.
                Liên kết có hiệu lực trong 24 giờ.
              </p>
              <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                Chưa nhận được email? Hãy kiểm tra thư rác hoặc{' '}
                <button onClick={() => setSent(false)} className="text-blue-400 hover:underline">
                  thử lại
                </button>.
              </p>
              <Link to="/login" className="btn-primary w-full justify-center">
                Về trang đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Địa chỉ email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => {
                      const value = e.target.value
                      setEmail(value)
                      let message = ''
                      if (value) { try { validateEmail(value) } catch (validation) { message = validation instanceof Error ? validation.message : 'Email không hợp lệ' } }
                      setFieldError(message)
                    }}
                    placeholder="you@example.com"
                    required
                    className={`input pl-10 ${fieldError ? 'auth-input-error' : ''}`}
                    aria-invalid={Boolean(fieldError)}
                    autoFocus
                  />
                </div>
                {fieldError && <p className="auth-field-error">{fieldError}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim() || Boolean(fieldError)}
                className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  : 'Gửi liên kết đặt lại'
                }
              </button>

              <Link to="/login" className="btn-ghost w-full justify-center text-sm">
                <ArrowLeft size={14} /> Về trang đăng nhập
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
