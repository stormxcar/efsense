import { useEffect, useState } from 'react'

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const update = () => {
      const article = document.querySelector('article')
      if (!article) return
      const rect = article.getBoundingClientRect()
      const start = window.scrollY + rect.top
      const distance = Math.max(1, article.scrollHeight - window.innerHeight)
      setProgress(Math.min(100, Math.max(0, ((window.scrollY - start) / distance) * 100)))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return <div className="reading-progress" style={{ transform: `scaleX(${progress / 100})` }} aria-hidden="true" />
}
