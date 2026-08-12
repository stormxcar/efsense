import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useProcessing } from '@/hooks/useProcessing'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()
  const process = useProcessing()

  // Supabase sends the user here with a session via the URL hash
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User is now authenticated via recovery link - allow form
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { toast.error('Mật khẩu phải có ít nhất 8 ký tự'); return }
    if (password !== confirm) { toast.error('Mật khẩu xác nhận không khớp'); return }

    setLoading(true)
    try {
      const { error } = await process('Đang cập nhật mật khẩu...', () => supabase.auth.updateUser({ password }))
      if (error) {
        toast.error(error.message)
      } else {
        setDone(true)
        setTimeout(() => navigate('/login'), 3000)
      }
    } catch {
      toast.error('Kết nối bị gián đoạn. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        <BackButton fallback="/login" />
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>FS</div>
            <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>
              Football <span className="gradient-text">Stories</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>
            Đặt mật khẩu mới
          </h1>
        </div>

        <div className="card p-8">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
              <h2 className="font-bold text-lg mb-2">Đã đổi mật khẩu</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Đang chuyển đến trang đăng nhập...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Mật khẩu mới</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input pl-10 pr-10"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 btn-ghost p-0">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Xác nhận mật khẩu</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    required
                    autoComplete="new-password"
                    className="input pl-10"
                  />
                </div>
              </div>
              {password && confirm && password !== confirm && (
                <p className="text-xs text-red-400">Mật khẩu xác nhận không khớp</p>
              )}
              <button type="submit" disabled={loading || !password || !confirm}
                className="btn-primary w-full justify-center disabled:opacity-50">
                {loading
                  ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  : 'Đặt mật khẩu mới'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
