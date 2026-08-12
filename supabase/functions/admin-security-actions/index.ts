import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user: actor } } = await caller.auth.getUser()
  if (!actor) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  const admin = createClient(url, serviceKey)
  const { data: profile } = await admin.from('users').select('role,status').eq('id', actor.id).single()
  if (profile?.role !== 'admin' || profile.status !== 'active') return new Response('Forbidden', { status: 403, headers: corsHeaders })

  const body = await request.json() as { action?: string; userId?: string }
  if (!body.userId || !['lock', 'unlock', 'revoke_sessions'].includes(body.action ?? '')) {
    return new Response(JSON.stringify({ error: 'Thao tác không hợp lệ' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  if (body.userId === actor.id && body.action === 'lock') {
    return new Response(JSON.stringify({ error: 'Không thể tự khóa tài khoản đang đăng nhập' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  if (body.action === 'lock' || body.action === 'unlock') {
    const { error } = await admin.from('users').update({ status: body.action === 'lock' ? 'suspended' : 'active' }).eq('id', body.userId)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  if (body.action === 'revoke_sessions' || body.action === 'lock') {
    const { error } = await admin.auth.admin.signOut(body.userId, 'global')
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  await admin.from('audit_logs').insert({ actor_id: actor.id, action: body.action === 'lock' ? 'lock' : body.action === 'unlock' ? 'unlock' : 'revoke_sessions', entity_type: 'users', entity_id: body.userId })
  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
