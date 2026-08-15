import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables')
}

const REMEMBER_ME_KEY = 'football-stories-remember-me'
const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

function readRememberMe() {
  try {
    return window.localStorage.getItem(REMEMBER_ME_KEY) !== 'false'
  } catch {
    return true
  }
}

const authStorage = {
  getItem(key: string) {
    try {
      const storage = readRememberMe() ? window.localStorage : window.sessionStorage
      return storage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      const storage = readRememberMe() ? window.localStorage : window.sessionStorage
      storage.setItem(key, value)
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }
  },
}

export function getRememberMe() {
  return readRememberMe()
}

export function setRememberMe(remember: boolean) {
  try {
    window.localStorage.setItem(REMEMBER_ME_KEY, String(remember))
    const inactiveStorage = remember ? window.sessionStorage : window.localStorage
    inactiveStorage.removeItem(AUTH_STORAGE_KEY)
    if (!remember) window.localStorage.removeItem('auth-storage')
  } catch {
    // Keep the in-memory session working if storage is unavailable.
  }
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
    storage: authStorage,
    storageKey: AUTH_STORAGE_KEY,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})
