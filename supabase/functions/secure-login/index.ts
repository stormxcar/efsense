import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Phương thức không được hỗ trợ' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

  // Prefer platform-managed headers. If a proxy chain is present, the last
  // address is the client address appended by the edge proxy, not a spoofed
  // first value supplied by the caller.
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map(value => value.trim()).filter(Boolean).at(-1)
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || forwarded || 'unknown'

  try {
    const { email, password } = await request.json()
    if (typeof email !== 'string' || typeof password !== 'string') return json({ error: 'Email hoặc mật khẩu không hợp lệ' }, 400)
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail)) return json({ error: 'Email cần có dạng ten@mien.com' }, 400)
    if (!password) return json({ error: 'Vui lòng nhập mật khẩu' }, 400)

    const { data: block } = await admin.from('ip_blocks')
      .select('blocked_until')
      .eq('ip_address', ip)
      .maybeSingle()
    if (block?.blocked_until && new Date(block.blocked_until) > new Date()) {
      return json({ error: 'Địa chỉ mạng đang tạm khóa. Vui lòng thử lại sau 30 phút.' }, 429)
    }

    const { data, error } = await auth.auth.signInWithPassword({ email: normalizedEmail, password })
    await admin.from('login_attempts').insert({
      email: normalizedEmail,
      ip_address: ip,
      success: !error,
    })

    if (error) {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { count } = await admin.from('login_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .eq('success', false)
        .gte('attempted_at', since)
      if ((count ?? 0) >= 5) {
        await admin.from('ip_blocks').upsert({
          ip_address: ip,
          attempt_count: count,
          blocked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }, { onConflict: 'ip_address' })
      }
      return json({ error: 'Email hoặc mật khẩu chưa đúng' }, 401)
    }

    if (data.user) {
      await admin.from('users').update({ last_login: new Date().toISOString() }).eq('id', data.user.id)
    }
    return json({ session: data.session, user: data.user })
  } catch {
    return json({ error: 'Không thể xử lý đăng nhập lúc này' }, 500)
  }
})
