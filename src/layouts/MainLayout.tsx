import { Outlet, useLocation } from 'react-router-dom'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'

export default function MainLayout() {
  const location = useLocation()
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div id="page-top-marker" aria-hidden="true" />
      <a href="#main-content" className="skip-link">Bỏ qua đến nội dung chính</a>
      <Header />
      <main id="main-content" className="flex-1">
        <div key={location.pathname} className="route-enter">
          <Outlet />
        </div>
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  )
}
