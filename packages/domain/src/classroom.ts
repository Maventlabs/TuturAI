import type { RecordStatus, UserRole } from './types'

const joinKeyPattern = /^[A-Z0-9]{8}$/

export interface ClassroomInput {
  name: string
  description: string | null
  school: string | null
}

export function validateClassroomInput(input: unknown):
  | { success: true; data: ClassroomInput }
  | { success: false; issues: Array<{ path: string; message: string }> } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: 'root', message: 'Classroom payload is required' }] }
  }

  const value = input as Record<string, unknown>
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const issues: Array<{ path: string; message: string }> = []
  if (name.length < 2 || name.length > 120) {
    issues.push({ path: 'name', message: 'Classroom name must be 2-120 characters' })
  }

  const optionalText = (key: string, max: number) => {
    const raw = value[key]
    if (raw === undefined || raw === null || raw === '') return null
    if (typeof raw !== 'string' || raw.trim().length > max) {
      issues.push({ path: key, message: `${key} must be at most ${max} characters` })
      return null
    }
    return raw.trim()
  }

  const description = optionalText('description', 500)
  const school = optionalText('school', 160)
  if (issues.length > 0) return { success: false, issues }
  return { success: true, data: { name, description, school } }
}

export function validateJoinKey(input: unknown):
  | { success: true; value: string }
  | { success: false; message: string } {
  if (typeof input !== 'string') {
    return { success: false, message: 'Join key must be 8 letters or numbers' }
  }

  const value = input.trim().toUpperCase()
  if (!joinKeyPattern.test(value)) {
    return { success: false, message: 'Join key must be 8 letters or numbers' }
  }

  return { success: true, value }
}

export function canJoinClassroom(input: {
  role: UserRole
  classroomStatus: RecordStatus
  joinKeyRevoked: boolean
  alreadyMember: boolean
}): boolean {
  return (
    input.role === 'student' &&
    input.classroomStatus === 'active' &&
    !input.joinKeyRevoked &&
    !input.alreadyMember
  )
}

export function canManageClassroom(role: UserRole, actorId: string, teacherId: string): boolean {
  return role === 'teacher' && actorId === teacherId
}

export function validateClassroomStatus(input: unknown):
  | { success: true; value: RecordStatus }
  | { success: false; message: string } {
  if (input === 'active' || input === 'archived') return { success: true, value: input }
  return { success: false, message: 'Classroom status must be active or archived' }
}

export function canManageMembership(role: UserRole, actorId: string, teacherId: string, studentId: string) {
  return role === 'teacher' && actorId === teacherId && actorId !== studentId
}

export function canAccessRole(role: UserRole, requiredRole: UserRole): boolean {
  return role === requiredRole
}
