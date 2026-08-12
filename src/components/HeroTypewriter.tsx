import { useEffect, useState } from 'react'

const MESSAGES = [
  'Đọc sâu hơn về trận đấu bạn vừa xem.',
  'Mổ xẻ chiến thuật đứng sau mỗi tỷ số.',
  'Chia sẻ góc nhìn của bạn với cộng đồng.',
  'Từ sân cỏ đến những trận đấu eFootball.',
]

export default function HeroTypewriter() {
  const [messageIndex, setMessageIndex] = useState(0)
  const [text, setText] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? MESSAGES[0]
      : ''
  ))

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let deleting = false
    let cursor = 0
    let timeoutId = 0
    const tick = () => {
      const message = MESSAGES[messageIndex]
      if (!deleting) {
        cursor += 1
        setText(message.slice(0, cursor))
        if (cursor >= message.length) {
          deleting = true
          timeoutId = window.setTimeout(tick, 1900)
          return
        }
      } else {
        cursor -= 1
        setText(message.slice(0, cursor))
        if (cursor <= 0) {
          deleting = false
          setMessageIndex(index => (index + 1) % MESSAGES.length)
        }
      }
      timeoutId = window.setTimeout(tick, deleting ? 32 : 58)
    }
    timeoutId = window.setTimeout(tick, 420)
    return () => window.clearTimeout(timeoutId)
  }, [messageIndex])

  return (
    <p className="hero-typewriter" aria-live="polite">
      <span aria-hidden="true">/</span> {text}<span className="hero-typewriter-cursor" aria-hidden="true" />
    </p>
  )
}
