import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { GalleryImageRow } from '@/types/database'

export default function PostGallery({ images }: { images: GalleryImageRow[] }) {
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    if (active === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null)
      if (event.key === 'ArrowLeft') setActive(value => value === null ? null : (value - 1 + images.length) % images.length)
      if (event.key === 'ArrowRight') setActive(value => value === null ? null : (value + 1) % images.length)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [active, images.length])

  if (!images.length) return null
  const current = active === null ? null : images[active]

  return (
    <section className="article-gallery" aria-labelledby="gallery-title">
      <div className="flex items-end justify-between gap-4 mb-5">
        <h2 id="gallery-title" className="section-heading mb-0">Khoảnh khắc trong bài</h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{images.length} ảnh</span>
      </div>
      <div className="article-gallery-grid">
        {images.map((image, index) => (
          <figure key={image.id}>
            <button type="button" onClick={() => setActive(index)} aria-label={`Mở ảnh ${index + 1}: ${image.image_alt}`}>
              <img src={image.image_url} alt={image.image_alt} loading="lazy" decoding="async" />
            </button>
            {(image.caption || image.image_credit) && (
              <figcaption>
                {image.caption}
                {image.image_credit && <span>Ảnh: {image.image_credit}</span>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {current && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Trình xem ảnh">
          <button type="button" className="lightbox-close" onClick={() => setActive(null)} aria-label="Đóng"><X /></button>
          <button type="button" className="lightbox-prev" onClick={() => setActive((active! - 1 + images.length) % images.length)} aria-label="Ảnh trước"><ChevronLeft /></button>
          <figure>
            <img src={current.image_url} alt={current.image_alt} />
            {(current.caption || current.image_credit) && (
              <figcaption>
                {current.caption}
                {current.image_credit && (
                  current.image_source_url
                    ? <a href={current.image_source_url} target="_blank" rel="noreferrer">Ảnh: {current.image_credit}</a>
                    : <span>Ảnh: {current.image_credit}</span>
                )}
              </figcaption>
            )}
          </figure>
          <button type="button" className="lightbox-next" onClick={() => setActive((active! + 1) % images.length)} aria-label="Ảnh sau"><ChevronRight /></button>
        </div>
      )}
    </section>
  )
}
