import type { ClassroomLevel, RecordStatus, UserRole } from './types'

const joinKeyPattern = /^[A-Z0-9]{8}$/

export const CLASSROOM_LEVELS: ReadonlyArray<{ value: ClassroomLevel; label: string }> = [
  { value: 'kelas-1', label: 'Kelas 1' },
  { value: 'kelas-2', label: 'Kelas 2' },
  { value: 'kelas-3', label: 'Kelas 3' },
  { value: 'kelas-4', label: 'Kelas 4' },
  { value: 'kelas-5', label: 'Kelas 5' },
  { value: 'kelas-6', label: 'Kelas 6' },
  { value: 'kelas-7', label: 'Kelas 7' },
  { value: 'kelas-8', label: 'Kelas 8' },
  { value: 'kelas-9', label: 'Kelas 9' },
  { value: 'kelas-10', label: 'Kelas 10' },
  { value: 'kelas-11', label: 'Kelas 11' },
  { value: 'kelas-12', label: 'Kelas 12' },
  { value: 'mahasiswa', label: 'Mahasiswa' },
  { value: 'umum', label: 'Umum' },
]

export function classroomLevelLabel(level: ClassroomLevel | null): string | null {
  if (!level) return null
  return CLASSROOM_LEVELS.find((item) => item.value === level)?.label ?? null
}

export interface ClassroomInput {
  name: string
  description: string | null
  school: string | null
  level: ClassroomLevel | null
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

  const rawLevel = value.level
  let level: ClassroomLevel | null = null
  if (rawLevel !== undefined && rawLevel !== null && rawLevel !== '') {
    const match = CLASSROOM_LEVELS.find((item) => item.value === rawLevel)
    if (!match) issues.push({ path: 'level', message: 'level must be a supported classroom level' })
    else level = match.value
  }

  if (issues.length > 0) return { success: false, issues }
  return { success: true, data: { name, description, school, level } }
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
