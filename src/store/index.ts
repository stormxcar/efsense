import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRow } from '@/types/database'

interface AuthState {
  user: UserRow | null
  isLoading: boolean
  setUser: (user: UserRow | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ user: null, isLoading: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
)

// ---- Theme Store ----
type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.setAttribute('data-theme', theme)
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        document.documentElement.setAttribute('data-theme', next)
      },
    }),
    { name: 'theme-storage' }
  )
)

// ---- UI Store ----
interface UIState {
  sidebarOpen: boolean
  notificationDropdownOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleNotifications: () => void
  closeNotifications: () => void
  processingCount: number
  processingMessage: string
  startProcessing: (message?: string) => void
  stopProcessing: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  notificationDropdownOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleNotifications: () => set((s) => ({ notificationDropdownOpen: !s.notificationDropdownOpen })),
  closeNotifications: () => set({ notificationDropdownOpen: false }),
  processingCount: 0,
  processingMessage: 'Đang xử lý...',
  startProcessing: (processingMessage = 'Đang xử lý...') => set((state) => ({
    processingCount: state.processingCount + 1,
    processingMessage,
  })),
  stopProcessing: () => set((state) => ({
    processingCount: Math.max(0, state.processingCount - 1),
    processingMessage: state.processingCount <= 1 ? 'Đang xử lý...' : state.processingMessage,
  })),
}))
