import type { UserRole } from '@tuturai/domain'

export interface OnboardingInput {
  displayName: string
  school: string
  role: UserRole
  className?: string
  subject?: string
}

export interface ProfileUpdateInput {
  displayName: string
  school: string
}

export interface TeacherPreferencesInput {
  submissions: boolean
  lowScore: boolean
  weekly: boolean
  device: boolean
}

export interface ValidationIssue {
  path: string
  message: string
}

export function validateOnboardingInput(input: unknown):
  | { success: true; data: OnboardingInput }
  | { success: false; issues: ValidationIssue[] } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: '', message: 'Input is required' }] }
  }

  const candidate = input as Record<string, unknown>
  const issues: ValidationIssue[] = []
  const displayName = typeof candidate.displayName === 'string' ? candidate.displayName.trim() : ''
  const school = typeof candidate.school === 'string' ? candidate.school.trim() : ''
  const role = candidate.role
  const className = typeof candidate.className === 'string' ? candidate.className.trim() : undefined
  const subject = typeof candidate.subject === 'string' ? candidate.subject.trim() : undefined

  if (displayName.length < 2 || displayName.length > 120) {
    issues.push({ path: 'displayName', message: 'Display name must be 2-120 characters' })
  }
  if (school.length < 2 || school.length > 160) {
    issues.push({ path: 'school', message: 'School must be 2-160 characters' })
  }
  if (role !== 'student' && role !== 'teacher') {
    issues.push({ path: 'role', message: 'Role must be student or teacher' })
  }
  if (className !== undefined && className.length > 120) {
    issues.push({ path: 'className', message: 'Class must be at most 120 characters' })
  }
  if (subject !== undefined && subject.length > 120) {
    issues.push({ path: 'subject', message: 'Subject must be at most 120 characters' })
  }
  if (role === 'student' && !className) {
    issues.push({ path: 'className', message: 'Class is required for students' })
  }
  if (role === 'teacher' && !subject) {
    issues.push({ path: 'subject', message: 'Subject is required for teachers' })
  }

  if (issues.length > 0) return { success: false, issues }
  return {
    success: true,
    data: {
      displayName,
      school,
      role: role as UserRole,
      ...(className ? { className } : {}),
      ...(subject ? { subject } : {}),
    },
  }
}

export function validateProfileUpdateInput(input: unknown):
  | { success: true; data: ProfileUpdateInput }
  | { success: false; issues: ValidationIssue[] } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: '', message: 'Input is required' }] }
  }

  const candidate = input as Record<string, unknown>
  const allowedKeys = new Set(['displayName', 'school'])
  if (Object.keys(candidate).some((key) => !allowedKeys.has(key))) {
    return { success: false, issues: [{ path: '', message: 'Only displayName and school can be updated' }] }
  }

  const displayName = typeof candidate.displayName === 'string' ? candidate.displayName.trim() : ''
  const school = typeof candidate.school === 'string' ? candidate.school.trim() : ''
  const issues: ValidationIssue[] = []

  if (displayName.length < 2 || displayName.length > 120) {
    issues.push({ path: 'displayName', message: 'Display name must be 2-120 characters' })
  }
  if (school.length < 2 || school.length > 160) {
    issues.push({ path: 'school', message: 'School must be 2-160 characters' })
  }

  if (issues.length > 0) return { success: false, issues }
  return { success: true, data: { displayName, school } }
}

export function validateTeacherPreferencesInput(input: unknown):
  | { success: true; data: TeacherPreferencesInput }
  | { success: false; issues: ValidationIssue[] } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: '', message: 'Input is required' }] }
  }

  const candidate = input as Record<string, unknown>
  const keys = ['submissions', 'lowScore', 'weekly', 'device']
  if (Object.keys(candidate).some((key) => !keys.includes(key)) || keys.some((key) => typeof candidate[key] !== 'boolean')) {
    return { success: false, issues: [{ path: '', message: 'All notification preferences must be boolean values' }] }
  }

  return {
    success: true,
    data: {
      submissions: candidate.submissions as boolean,
      lowScore: candidate.lowScore as boolean,
      weekly: candidate.weekly as boolean,
      device: candidate.device as boolean,
    },
  }
}
