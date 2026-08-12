import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Phương thức không được hỗ trợ' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'Chưa xác thực' }, 401)

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: { user: actor } } = await caller.auth.getUser()
  if (!actor) return json({ error: 'Phiên đăng nhập không hợp lệ' }, 401)

  const { data: actorProfile } = await admin.from('users').select('role,status').eq('id', actor.id).single()
  if (actorProfile?.role !== 'admin' || actorProfile.status !== 'active') return json({ error: 'Bạn không có quyền tạo người dùng' }, 403)

  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const allowedRoles = ['admin', 'editor', 'moderator', 'contributor', 'user'] as const
    const role = allowedRoles.includes(body.role) ? body.role : 'user'
    if (!email || !password || !username) return json({ error: 'Thiếu email, mật khẩu hoặc tên hiển thị' }, 400)

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    })
    if (createError || !created.user) return json({ error: createError?.message ?? 'Không thể tạo người dùng' }, 400)

    if (role !== 'user') {
      const { error: roleError } = await admin.from('users').update({ role }).eq('id', created.user.id)
      if (roleError) {
        await admin.auth.admin.deleteUser(created.user.id)
        return json({ error: 'Không thể cấp quyền quản trị, thao tác đã được hoàn tác' }, 500)
      }
    }
    return json({ id: created.user.id, role })
  } catch {
    return json({ error: 'Dữ liệu tạo người dùng không hợp lệ' }, 400)
  }
})
