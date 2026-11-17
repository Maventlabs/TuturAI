/**
 * Links are the second attachment channel next to Drive files: a teacher can
 * point at a rubric or a reference video, and a student can hand in a Drive or
 * YouTube link instead of uploading bytes. Both are stored as plain metadata so
 * nothing has to be fetched or proxied to render them.
 */
export interface ResourceLinkInput {
  label: string
  url: string
}

export interface ResourceLink extends ResourceLinkInput {
  id: string
}

export const MAX_RESOURCE_LINKS = 8
const MAX_URL_LENGTH = 2048
const MAX_LABEL_LENGTH = 80

export type ResourceLinkIssue = { path: string; message: string }

export function normalizeResourceLinks(
  input: unknown,
  options: { max?: number } = {},
): { success: true; data: ResourceLinkInput[] } | { success: false; issues: ResourceLinkIssue[] } {
  if (input === undefined || input === null) return { success: true, data: [] }
  if (!Array.isArray(input)) {
    return { success: false, issues: [{ path: 'links', message: 'Links must be a list' }] }
  }

  const max = options.max ?? MAX_RESOURCE_LINKS
  if (input.length > max) {
    return { success: false, issues: [{ path: 'links', message: `At most ${max} links are allowed` }] }
  }

  const issues: ResourceLinkIssue[] = []
  const data: ResourceLinkInput[] = []

  input.forEach((entry, index) => {
    const path = `links.${index}`
    if (!entry || typeof entry !== 'object') {
      issues.push({ path, message: 'Link must be an object' })
      return
    }
    const value = entry as Record<string, unknown>
    const rawUrl = typeof value.url === 'string' ? value.url.trim() : ''
    const rawLabel = typeof value.label === 'string' ? value.label.trim() : ''

    if (!rawUrl) {
      issues.push({ path: `${path}.url`, message: 'Link URL is required' })
      return
    }
    if (rawUrl.length > MAX_URL_LENGTH) {
      issues.push({ path: `${path}.url`, message: 'Link URL is too long' })
      return
    }

    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      issues.push({ path: `${path}.url`, message: 'Link URL must be a valid URL' })
      return
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      issues.push({ path: `${path}.url`, message: 'Link URL must start with http:// or https://' })
      return
    }
    if (rawLabel.length > MAX_LABEL_LENGTH) {
      issues.push({ path: `${path}.label`, message: `Link label must be at most ${MAX_LABEL_LENGTH} characters` })
      return
    }

    data.push({ label: rawLabel || parsed.hostname.replace(/^www\./, ''), url: parsed.toString() })
  })

  if (issues.length > 0) return { success: false, issues }
  return { success: true, data }
}
