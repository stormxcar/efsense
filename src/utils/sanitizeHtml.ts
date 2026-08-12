const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H1', 'H2', 'H3',
  'BLOCKQUOTE', 'PRE', 'CODE', 'OL', 'UL', 'LI', 'A', 'IMG', 'HR',
])
const ALLOWED_ATTRIBUTES = new Set(['class', 'style', 'href', 'target', 'rel', 'src', 'alt', 'title'])

function safeUrl(value: string): boolean {
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(value)) return true
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

/** Sanitize editor HTML before it reaches dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  if (!html || typeof document === 'undefined') return ''
  const template = document.createElement('template')
  template.innerHTML = html

  const walk = (parent: ParentNode) => {
    Array.from(parent.childNodes).forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const element = node as HTMLElement
      if (!ALLOWED_TAGS.has(element.tagName)) {
        element.replaceWith(document.createTextNode(element.textContent ?? ''))
        return
      }
      Array.from(element.attributes).forEach(attribute => {
        const name = attribute.name.toLowerCase()
        if (name.startsWith('on') || !ALLOWED_ATTRIBUTES.has(name)) element.removeAttribute(attribute.name)
        if ((name === 'href' || name === 'src') && !safeUrl(attribute.value)) element.removeAttribute(attribute.name)
        if (name === 'style') {
          const safeStyle = attribute.value.split(';').filter(rule => /^(color|background-color|text-align|font-weight|font-style|text-decoration)\s*:/i.test(rule.trim()) && !/[{}]/.test(rule)).join(';')
          if (safeStyle) element.setAttribute('style', safeStyle)
          else element.removeAttribute('style')
        }
      })
      if (element.tagName === 'A') element.setAttribute('rel', 'noopener noreferrer')
      walk(element)
    })
  }

  walk(template.content)
  return template.innerHTML
}
