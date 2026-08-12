import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Top-of-page loading bar component
export function PageProgressBar() {
  const barRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    // Start
    bar.style.transition = 'none'
    bar.style.width = '0%'
    bar.style.opacity = '1'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = 'width 0.4s ease'
        bar.style.width = '70%'
      })
    })
    // Finish after short delay
    const t = setTimeout(() => {
      bar.style.transition = 'width 0.3s ease, opacity 0.3s ease'
      bar.style.width = '100%'
      setTimeout(() => { bar.style.opacity = '0' }, 300)
    }, 300)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <div
      ref={barRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '3px',
        width: '0%',
        zIndex: 9999,
        background: 'var(--accent)',
        boxShadow: '0 0 10px var(--accent-soft)',
        borderRadius: '0 2px 2px 0',
        pointerEvents: 'none',
      }}
    />
  )
}

// Full page spinner (for Suspense fallback)
export function PageLoader() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="relative w-14 h-14">
        <div className="w-14 h-14 rounded-lg grid place-items-center text-2xl font-black animate-pulse" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', fontFamily: 'var(--font-family-display)' }}>
          FS
        </div>
      </div>

      {/* Dot loader */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s', background: 'var(--accent)' }}
          />
        ))}
      </div>
    </div>
  )
}
