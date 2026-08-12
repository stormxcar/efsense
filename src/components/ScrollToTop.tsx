import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const marker = document.getElementById('page-top-marker')
    if (!marker) return
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), {
      rootMargin: '-560px 0px 0px 0px',
    })
    observer.observe(marker)

    return () => observer.disconnect()
  }, [])

  return (
    <button
      type="button"
      className={`scroll-top ${visible ? 'is-visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Cuộn lên đầu trang"
      title="Lên đầu trang"
    >
      <span className="scroll-top-inner"><ArrowUp size={18} /></span>
    </button>
  )
}
