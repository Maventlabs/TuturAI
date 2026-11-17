import { describe, expect, it } from 'vitest'
import { MAX_RESOURCE_LINKS, normalizeResourceLinks } from './links'

describe('normalizeResourceLinks', () => {
  it('treats a missing list as no links', () => {
    expect(normalizeResourceLinks(undefined)).toEqual({ success: true, data: [] })
  })

  it('falls back to the hostname when a label is omitted', () => {
    expect(normalizeResourceLinks([{ url: 'https://www.youtube.com/watch?v=abc' }])).toEqual({
      success: true,
      data: [{ label: 'youtube.com', url: 'https://www.youtube.com/watch?v=abc' }],
    })
  })

  it('rejects non-http protocols and malformed URLs', () => {
    const result = normalizeResourceLinks([{ url: 'javascript:alert(1)' }, { url: 'nope' }])
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues.map((issue) => issue.path)).toEqual(['links.0.url', 'links.1.url'])
  })

  it('caps the number of links', () => {
    const links = Array.from({ length: MAX_RESOURCE_LINKS + 1 }, (_, index) => ({
      url: `https://example.com/${index}`,
    }))
    const result = normalizeResourceLinks(links)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues[0]?.path).toBe('links')
  })
})
