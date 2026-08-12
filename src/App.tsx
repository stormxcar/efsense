import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { Suspense, lazy, useEffect } from 'react'

import MainLayout from '@/layouts/MainLayout'
import AdminLayout from '@/layouts/AdminLayout'
import { useThemeStore } from '@/store'
import { PageProgressBar, PageLoader } from '@/components/PageLoader'
import GlobalProcessingOverlay from '@/components/GlobalProcessingOverlay'
import QueryRecoveryBanner from '@/components/QueryRecoveryBanner'
import { RealtimeSync } from '@/hooks/useRealtimeSync'
// Auth is self-bootstrapped at module level in useAuth.ts

// Lazy load pages
const HomePage = lazy(() => import('@/pages/HomePage'))
const SeriesListPage = lazy(() => import('@/pages/SeriesListPage'))
const SeriesPage = lazy(() => import('@/pages/SeriesPage'))
const PostDetailPage = lazy(() => import('@/pages/PostDetailPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const MediaPage = lazy(() => import('@/pages/MediaPage'))
const WeeklyPopularPage = lazy(() => import('@/pages/WeeklyPopularPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// Admin
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminPosts = lazy(() => import('@/pages/admin/AdminPosts'))
const AdminPostEditor = lazy(() => import('@/pages/admin/AdminPostEditor'))
const AdminSeries = lazy(() => import('@/pages/admin/AdminSeries'))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))
const AdminComments = lazy(() => import('@/pages/admin/AdminComments'))
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'))
const AdminPostPreview = lazy(() => import('@/pages/admin/AdminPostPreview'))

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (_error, query) => {
      if (query.state.data === undefined) {
        toast.error('Không thể tải dữ liệu. Vui lòng thử lại.', { id: `query-${query.queryHash}` })
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 0,
    },
  },
})

const S = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
)

function AppRoutes() {
  const { theme } = useThemeStore()
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <>
      <PageProgressBar />
      <Routes>
        {/* Public */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<S><HomePage /></S>} />
          <Route path="/series" element={<S><SeriesListPage /></S>} />
          <Route path="/series/:slug" element={<S><SeriesPage /></S>} />
          <Route path="/posts/:slug" element={<S><PostDetailPage /></S>} />
          <Route path="/search" element={<S><SearchPage /></S>} />
          <Route path="/media" element={<S><MediaPage /></S>} />
          <Route path="/doc-nhieu-tuan-nay" element={<S><WeeklyPopularPage /></S>} />
          <Route path="/profile" element={<S><ProfilePage /></S>} />
        </Route>

        {/* Auth pages (no layout) */}
        <Route path="/login" element={<S><LoginPage /></S>} />
        <Route path="/register" element={<S><RegisterPage /></S>} />
        <Route path="/forgot-password" element={<S><ForgotPasswordPage /></S>} />
        <Route path="/reset-password" element={<S><ResetPasswordPage /></S>} />

        {/* Admin */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<S><AdminDashboard /></S>} />
          <Route path="posts" element={<S><AdminPosts /></S>} />
          <Route path="posts/new" element={<S><AdminPostEditor /></S>} />
          <Route path="posts/:id/edit" element={<S><AdminPostEditor /></S>} />
          <Route path="posts/:id/preview" element={<S><AdminPostPreview /></S>} />
          <Route path="series" element={<S><AdminSeries /></S>} />
          <Route path="users" element={<S><AdminUsers /></S>} />
          <Route path="comments" element={<S><AdminComments /></S>} />
          <Route path="reports" element={<S><AdminReports /></S>} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<S><NotFoundPage /></S>} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RealtimeSync />
        <AppRoutes />
        <GlobalProcessingOverlay />
        <QueryRecoveryBanner />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#4ade80', secondary: 'transparent' } },
            error: { iconTheme: { primary: '#f87171', secondary: 'transparent' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
