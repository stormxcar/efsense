import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProcessing } from '@/hooks/useProcessing'
import ConfirmModal from '@/components/ConfirmModal'

type Factor = { id: string; friendly_name?: string; factor_type: string; status: string }

function qrSource(value: string) {
  return value.startsWith('data:image/') ? value : `data:image/svg+xml;utf-8,${encodeURIComponent(value)}`
}

export default function AdminSecurity() {
  const process = useProcessing()
  const [factors, setFactors] = useState<Factor[]>([])
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmFactorId, setConfirmFactorId] = useState<string | null>(null)

  const loadFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) toast.error(error.message)
    setFactors((data?.totp ?? []) as Factor[])
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    void supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!mounted) return
      if (error) toast.error(error.message)
      setFactors((data?.totp ?? []) as Factor[])
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const enroll = async () => {
    await process('Đang tạo mã bảo mật 2FA...', async () => {
      const existing = await supabase.auth.mfa.listFactors()
      if (existing.error) throw existing.error
      const sameName = (existing.data?.totp ?? []).find(factor => factor.friendly_name === 'Football Stories Admin')
      if (sameName?.status === 'verified') {
        await loadFactors()
        toast.success('2FA đã được bật. Không cần tạo mã QR mới.')
        return
      }
      if (sameName?.status === 'unverified') {
        const removed = await supabase.auth.mfa.unenroll({ factorId: sameName.id })
        if (removed.error) throw removed.error
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Football Stories Admin', issuer: 'Football Stories' })
      if (error || !data) throw error ?? new Error('Không thể tạo mã 2FA')
      setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể bật 2FA'))
  }

  const verify = async () => {
    if (!setup || !/^\d{6}$/.test(code)) {
      toast.error('Mã xác thực phải gồm 6 chữ số')
      return
    }
    await process('Đang xác minh mã 2FA...', async () => {
      const challenge = await supabase.auth.mfa.challenge({ factorId: setup.id })
      if (challenge.error || !challenge.data) throw challenge.error ?? new Error('Không thể tạo thử thách 2FA')
      const result = await supabase.auth.mfa.verify({ factorId: setup.id, challengeId: challenge.data.id, code })
      if (result.error) throw result.error
      setSetup(null)
      setCode('')
      await loadFactors()
      window.dispatchEvent(new Event('football-stories-mfa-verified'))
      toast.success('Đã bật 2FA cho tài khoản quản trị')
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Mã 2FA không đúng'))
  }

  const remove = async (factorId: string) => {
    await process('Đang tắt yếu tố 2FA...', async () => {
      const result = await supabase.auth.mfa.unenroll({ factorId })
      if (result.error) throw result.error
      await loadFactors()
      setSetup(null)
      toast.success('Đã tắt 2FA. Bạn có thể tạo QR mới.')
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không thể tắt 2FA'))
  }

  const verifiedFactors = factors.filter(factor => factor.status === 'verified')

  return (
    <>
      <div className="p-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="text-green-400" />
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-family-display)' }}>Bảo mật quản trị</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Bật ứng dụng xác thực TOTP để bảo vệ tài khoản admin.</p>
          </div>
        </div>

        <div className="card p-6 space-y-5">
          <div className="flex items-start gap-3">
            <Smartphone className="text-blue-400 mt-1" size={20} />
            <div>
              <h2 className="font-semibold">Xác thực hai lớp</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Dùng Google Authenticator, 1Password hoặc ứng dụng TOTP tương thích.</p>
            </div>
          </div>

          {loading && <div className="skeleton h-10" />}
          {!loading && verifiedFactors.map(factor => (
            <div key={factor.id} className="flex items-center justify-between rounded-xl p-3" style={{ background: 'var(--bg-primary)' }}>
              <span className="text-sm">
                {factor.friendly_name ?? 'Ứng dụng xác thực'} <span className="badge badge-green text-xs ml-2">Đang bật</span>
              </span>
              <button className="btn-ghost p-2" onClick={() => setConfirmFactorId(factor.id)} aria-label="Tắt 2FA"><Trash2 size={15} /></button>
            </div>
          ))}

          {!setup && !loading && verifiedFactors.length === 0 && <button className="btn-primary" onClick={() => void enroll()}>Bật 2FA</button>}

          {setup && (
            <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--bg-primary)' }}>
              <p className="text-sm font-semibold">Quét mã QR bằng ứng dụng xác thực</p>
              <img src={qrSource(setup.qr)} alt="Mã QR thiết lập 2FA" className="w-48 h-48 bg-white p-2 rounded-lg" />
              <p className="text-xs break-all" style={{ color: 'var(--text-muted)' }}>Khóa dự phòng: {setup.secret}</p>
              <div className="flex gap-2">
                <input className="input" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Nhập mã 6 chữ số" />
                <button className="btn-primary" onClick={() => void verify()}>Xác minh</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirmFactorId)}
        title="Tắt xác thực hai lớp?"
        message="Tài khoản admin sẽ mất lớp bảo vệ TOTP cho đến khi bạn bật lại."
        confirmLabel="Tắt 2FA"
        onCancel={() => setConfirmFactorId(null)}
        onConfirm={() => {
          if (confirmFactorId) void remove(confirmFactorId).finally(() => setConfirmFactorId(null))
        }}
      />
    </>
  )
}
