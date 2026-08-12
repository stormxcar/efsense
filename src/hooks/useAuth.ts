import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import { getCurrentUser } from '@/services/api'

// ---- Global auth bootstrap (runs once per app lifecycle) ----
let _bootstrapped = false

async function bootstrapAuth() {
  if (_bootstrapped) return
  _bootstrapped = true

  const store = useAuthStore.getState()

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await getCurrentUser()
      if (profile && profile.status !== 'active') {
        await supabase.auth.signOut()
        store.reset()
      } else {
        store.setUser(profile)
      }
    } else {
      store.reset()
    }
  } catch {
    store.reset()
  } finally {
    store.setLoading(false)
  }

  // Keep auth state in sync
  supabase.auth.onAuthStateChange((event, session) => {
    // Never await another Supabase auth call inside this callback: it can hold
    // the auth lock and stall every query waiting for the current session.
    window.setTimeout(async () => {
      const s = useAuthStore.getState()
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const profile = await getCurrentUser()
          if (profile && profile.status !== 'active') {
            await supabase.auth.signOut()
            s.reset()
          } else {
            s.setUser(profile)
          }
        } catch {
          s.reset()
        }
      } else if (event === 'SIGNED_OUT') {
        s.reset()
      }
      s.setLoading(false)
    }, 0)
  })
}

// Kick off immediately when module loads
bootstrapAuth()

// ---- React hook (just reads from store, doesn't re-initialize) ----
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)

  return {
    user,
    isLoading,
    isAdmin: user?.role === 'admin',
    isStaff: Boolean(user && ['admin', 'editor', 'moderator', 'contributor'].includes(user.role)),
    canEditContent: Boolean(user && ['admin', 'editor', 'contributor'].includes(user.role)),
    canPublishContent: Boolean(user && ['admin', 'editor'].includes(user.role)),
    canModerateContent: Boolean(user && ['admin', 'moderator'].includes(user.role)),
  }
}

export function useUnreadNotifications(userId: string | undefined) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return

    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .then(({ count: c }) => setCount(c ?? 0))

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => setCount((c) => c + 1)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false)
            .then(({ count: c }) => setCount(c ?? 0))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return count
}
