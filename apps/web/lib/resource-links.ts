import { randomUUID } from 'node:crypto'
import type { ResourceLink, ResourceLinkInput } from '@tuturai/domain'

/** Assigns the stable id the UI needs as a React key and for removal. */
export function withLinkIds(links: ResourceLinkInput[] | undefined): ResourceLink[] {
  return (links ?? []).map((link) => ({ id: randomUUID(), label: link.label, url: link.url }))
}

/**
 * Firestore documents are untyped at rest, so anything that is not a complete
 * link is dropped instead of reaching the UI as a half-rendered row.
 */
export function linksFromData(value: unknown): ResourceLink[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.url !== 'string') return []
    return [{
      id: record.id,
      url: record.url,
      label: typeof record.label === 'string' && record.label.trim() ? record.label : record.url,
    }]
  })
}
