import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('NEWSLETTER_FROM_EMAIL')
  if (!resendKey || !from) return new Response(JSON.stringify({ skipped: true, reason: 'Email provider is not configured' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const admin = createClient(url, serviceKey)
  const { data: profile } = await admin.from('users').select('role,status').eq('id', user.id).single()
  if (profile?.role !== 'admin' || profile.status !== 'active') return new Response('Forbidden', { status: 403, headers: corsHeaders })

  const { postId } = await request.json()
  const [{ data: post }, { data: subscribers }] = await Promise.all([
    admin.from('posts').select('title,slug,excerpt').eq('id', postId).eq('status', 'published').single(),
    admin.from('newsletter_subscribers').select('email').eq('status', 'active'),
  ])
  if (!post || !subscribers?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const siteUrl = Deno.env.get('SITE_URL') || 'https://footballstories.vn'
  let sent = 0
  for (let index = 0; index < subscribers.length; index += 50) {
    const batch = subscribers.slice(index, index + 50).map(item => item.email)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [from],
        bcc: batch,
        subject: `Bài mới: ${post.title}`,
        html: `<h1>${post.title}</h1><p>${post.excerpt || ''}</p><p><a href="${siteUrl}/posts/${post.slug}">Đọc bài viết</a></p>`,
      }),
    })
    if (response.ok) sent += batch.length
  }
  return new Response(JSON.stringify({ sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
