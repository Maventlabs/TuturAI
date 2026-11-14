import type { DriveFileMetadata } from './types'

export type MaterialStatus = 'draft' | 'published'

export interface Material {
  id: string
  classId: string
  title: string
  description: string
  topic: string | null
  attachments: DriveFileMetadata[]
  status: MaterialStatus
  createdAt: string
  updatedAt: string
}

export interface MaterialInput {
  title: string
  description: string
  topic: string | null
}

export function validateMaterialInput(input: unknown):
  | { success: true; data: MaterialInput }
  | { success: false; issues: Array<{ path: string; message: string }> } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: 'root', message: 'Material payload is required' }] }
  }

  const value = input as Record<string, unknown>
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const description = typeof value.description === 'string' ? value.description.trim() : ''
  const topic = typeof value.topic === 'string' && value.topic.trim().length > 0 ? value.topic.trim() : null
  const issues: Array<{ path: string; message: string }> = []

  if (title.length < 2 || title.length > 160) {
    issues.push({ path: 'title', message: 'Material title must be 2-160 characters' })
  }
  if (description.length < 1 || description.length > 5000) {
    issues.push({ path: 'description', message: 'Material description must be 1-5000 characters' })
  }
  if (topic && topic.length > 80) {
    issues.push({ path: 'topic', message: 'Material topic must be at most 80 characters' })
  }

  if (issues.length > 0) return { success: false, issues }
  return { success: true, data: { title, description, topic } }
}
