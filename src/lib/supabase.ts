import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables')
}

const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort('Yêu cầu dữ liệu đã quá thời gian chờ'), 12_000)
  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal
  try {
    return await fetch(input, { ...init, signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

// Using untyped client to avoid conflicts with strict generic resolution.
// All data types are asserted at the call site via our typed helpers in api.ts.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: { fetch: fetchWithTimeout },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})
