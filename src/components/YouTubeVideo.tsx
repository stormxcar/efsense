import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, Play, RefreshCw } from 'lucide-react'
import { getYouTubeVideoId } from '@/utils/youtube'

type VideoMode = 'thumbnail' | 'embed' | 'fallback'

interface Props {
  url: string
  title: string
  className?: string
}

export default function YouTubeVideo({ url, title, className = '' }: Props) {
  const videoId = useMemo(() => getYouTubeVideoId(url), [url])
  const [mode, setMode] = useState<VideoMode>(videoId ? 'thumbnail' : 'fallback')
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const [embedFailed, setEmbedFailed] = useState(false)
  const [embedLoaded, setEmbedLoaded] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMode(videoId ? 'thumbnail' : 'fallback')
      setThumbnailFailed(false)
      setEmbedFailed(false)
      setEmbedLoaded(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [videoId])

  useEffect(() => {
    if (mode !== 'embed' || embedLoaded) return
    const timeout = window.setTimeout(() => setEmbedFailed(true), 7000)
    return () => window.clearTimeout(timeout)
  }, [embedLoaded, mode])

  if (!videoId) {
    return (
      <div className={`youtube-video youtube-video-invalid ${className}`} role="status">
        <AlertTriangle size={20} aria-hidden="true" />
        <p>Liên kết YouTube không hợp lệ.</p>
      </div>
    )
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`
  const shouldFallback = mode === 'fallback' || embedFailed

  if (shouldFallback) {
    return (
      <div className={`youtube-video youtube-video-fallback ${className}`}>
        {!thumbnailFailed && <img src={thumbnailUrl} alt={title} loading="lazy" onError={() => setThumbnailFailed(true)} />}
        <div className="youtube-video-fallback-copy">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>Video này chỉ xem được trên YouTube</p>
          <div className="youtube-video-actions">
            <a href={watchUrl} target="_blank" rel="noreferrer" className="btn-primary">Xem trên YouTube <ExternalLink size={14} /></a>
            <button type="button" className="btn-ghost" onClick={() => { setEmbedFailed(false); setEmbedLoaded(false); setMode('embed') }}><RefreshCw size={14} /> Thử phát lại</button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'thumbnail') {
    return (
      <div className={`youtube-video youtube-video-preview ${className}`}>
        {!thumbnailFailed && <img src={thumbnailUrl} alt={title} loading="lazy" onError={() => setThumbnailFailed(true)} />}
        <div className="youtube-video-preview-overlay">
          <button type="button" className="youtube-video-play" onClick={() => setMode('embed')} aria-label={`Phát video: ${title}`}><Play size={22} fill="currentColor" /></button>
          <div><strong>{title}</strong><span>Nhấn để phát video</span></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`youtube-video youtube-video-embed ${className}`}>
      <iframe
        src={embedUrl}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        onLoad={() => setEmbedLoaded(true)}
        onError={() => setEmbedFailed(true)}
      />
      <div className="youtube-video-embed-help">
        <span>Nếu video không phát, hãy mở trực tiếp trên YouTube.</span>
        <a href={watchUrl} target="_blank" rel="noreferrer">Mở YouTube <ExternalLink size={12} /></a>
      </div>
    </div>
  )
}
