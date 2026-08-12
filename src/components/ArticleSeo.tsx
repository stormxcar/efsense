import { useEffect } from 'react'
import type { PostWithDetails } from '@/types/database'

const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

function buildOgImageUrl(source: string | null) {
  if (!source) return `${siteUrl}/og-default.svg`
  if (!source.includes('res.cloudinary.com') || !source.includes('/upload/')) return source
  return source.replace('/upload/', '/upload/c_fill,w_1200,h_630,g_auto,q_auto,f_auto/')
}

export default function ArticleSeo({ post }: { post: PostWithDetails }) {
  useEffect(() => {
    const canonicalUrl = `${siteUrl}/posts/${post.slug}`
    const image = post.og_image || buildOgImageUrl(post.cover_image)
    const description = post.meta_desc || post.excerpt || 'Câu chuyện bóng đá từ Football Stories.'
    document.title = `${post.meta_title || post.title} | Football Stories`
    upsertMeta('meta[name="description"]', 'name', 'description', description)
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', post.meta_title || post.title)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description)
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'article')
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', image)
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.footballStoriesArticle = 'true'
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description,
      image: [image],
      datePublished: post.published_at,
      dateModified: post.updated_at,
      author: { '@type': 'Person', name: post.author?.username || 'Ban biên tập Football Stories' },
      publisher: { '@type': 'Organization', name: 'Football Stories', logo: { '@type': 'ImageObject', url: `${siteUrl}/favicon.svg` } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    })
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [post])

  return null
}
