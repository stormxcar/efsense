import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type GuardAction = 'comment' | 'report' | 'post'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map(value => value.trim()).filter(Boolean).at(-1)
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || forwarded || 'unknown'
}

async function verifyTurnstile(secret: string, token: string, ip: string) {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip === 'unknown' ? undefined : ip }),
  })
  if (!response.ok) return false
  const result = await response.json() as { success?: boolean }
  return result.success === true
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ ok: false, error: 'Phương thức không được hỗ trợ.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: 'Guard chưa được cấu hình.' }, 500)

  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.toLowerCase().startsWith('bearer ')) return json({ ok: false, error: 'Bạn cần đăng nhập để thực hiện thao tác này.' }, 401)
  const auth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  try {
    const body = await request.json() as {
      action?: GuardAction
      fingerprint?: string
      startedAt?: number
      honeypot?: string
      humanCheck?: boolean
      captchaToken?: string
    }
    const action = body.action
    if (action !== 'comment' && action !== 'report' && action !== 'post') return json({ ok: false, error: 'Thao tác không hợp lệ.' }, 400)

    const { data: authData, error: authError } = await auth.auth.getUser()
    const user: User | null = authData.user
    if (authError || !user) return json({ ok: false, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }, 401)

    const ip = getClientIp(request)
    const fingerprint = typeof body.fingerprint === 'string' && body.fingerprint.trim().length >= 8
      ? body.fingerprint.trim().slice(0, 160)
      : 'unknown'
    // Keep the network reputation independent from the device token so that
    // many accounts from one IP are still grouped without storing raw IPs.
    const ipHash = await sha256(ip)
    const fingerprintHash = fingerprint === 'unknown' ? null : await sha256(fingerprint)
    const metadata = { user_agent: request.headers.get('user-agent')?.slice(0, 160) ?? null }
    const record = async (passed: boolean, reason?: string) => {
      await admin.from('community_abuse_events').insert({
        actor_user_id: user.id,
        action,
        ip_hash: ipHash,
        fingerprint_hash: fingerprintHash,
        passed,
        metadata: reason ? { ...metadata, reason } : metadata,
      })
    }

    const since = new Date(Date.now() - (action === 'report' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000)).toISOString()
    const [ipCountResult, fingerprintCountResult, actorCountResult] = await Promise.all([
      admin.from('community_abuse_events').select('id', { count: 'exact', head: true }).eq('action', action).eq('ip_hash', ipHash).gte('created_at', since),
      fingerprintHash
        ? admin.from('community_abuse_events').select('id', { count: 'exact', head: true }).eq('action', action).eq('fingerprint_hash', fingerprintHash).gte('created_at', since)
        : Promise.resolve({ count: 0, error: null }),
      admin.from('community_abuse_events').select('id', { count: 'exact', head: true }).eq('action', action).eq('actor_user_id', user.id).gte('created_at', since),
    ])
    if (ipCountResult.error || actorCountResult.error || fingerprintCountResult.error) return json({ ok: false, error: 'Không thể kiểm tra an toàn lúc này. Vui lòng thử lại.' }, 503)

    const ipCount = ipCountResult.count ?? 0
    const fingerprintCount = fingerprintCountResult.count ?? 0
    const actorCount = actorCountResult.count ?? 0
    const limits = action === 'report'
      ? { ip: 30, fingerprint: 15, actor: 5, stepUp: 3 }
      : action === 'post'
        ? { ip: 20, fingerprint: 12, actor: 8, stepUp: 5 }
        : { ip: 40, fingerprint: 30, actor: 12, stepUp: 6 }
    if (ipCount >= limits.ip || fingerprintCount >= limits.fingerprint || actorCount >= limits.actor) {
      await record(false, 'rate_limit')
      return json({ ok: false, error: 'Bạn đang thao tác quá thường xuyên. Vui lòng thử lại sau ít phút.' }, 429)
    }

    const startedAt = Number(body.startedAt)
    if ((body.honeypot ?? '').trim() || (Number.isFinite(startedAt) && Date.now() - startedAt < 1200)) {
      await record(false, 'bot_signal')
      return json({ ok: false, error: 'Thao tác được nhận diện là không hợp lệ.' }, 400)
    }

    const risky = Math.max(ipCount, fingerprintCount, actorCount) >= limits.stepUp
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
    if (turnstileSecret && body.captchaToken) {
      const captchaValid = await verifyTurnstile(turnstileSecret, body.captchaToken, ip)
      if (!captchaValid) {
        await record(false, 'captcha_failed')
        return json({ ok: false, error: 'Xác minh chống spam không thành công. Vui lòng thử lại.' }, 400)
      }
    } else if (risky && !body.humanCheck) {
      await record(false, 'step_up_required')
      return json({ ok: false, requiresHuman: true, error: 'Vui lòng xác nhận bạn là người dùng thật rồi gửi lại.' }, 200)
    }

    await record(true)
    return json({ ok: true, requiresHuman: false })
  } catch {
    return json({ ok: false, error: 'Không thể kiểm tra an toàn lúc này.' }, 500)
  }
})
