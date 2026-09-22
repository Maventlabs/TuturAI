export type UserRole = 'student' | 'teacher'

export type RecordStatus = 'active' | 'archived'

export interface UserProfile {
  id: string
  email: string
  displayName: string
  school: string | null
  role: UserRole
  createdAt: string
  updatedAt: string
}

export interface Classroom {
  id: string
  teacherId: string
  name: string
  description: string | null
  school: string | null
  status: RecordStatus
  createdAt: string
  updatedAt: string
}

export interface ClassMembership {
  id: string
  classId: string
  studentId: string
  status: RecordStatus
  joinedAt: string
}

export type AssignmentStatus = 'draft' | 'published' | 'archived'

export interface Assignment {
  id: string
  classId: string
  title: string
  instructions: string
  dueAt: string | null
  maxAttempts: number
  status: AssignmentStatus
  createdAt: string
  updatedAt: string
  attachments?: DriveFileMetadata[]
}

export type SubmissionStatus =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'returned'

export interface Submission {
  id: string
  assignmentId: string
  studentId: string
  attempt: number
  status: SubmissionStatus
  isLate: boolean
  teacherFeedback: string | null
  submittedAt: string | null
  updatedAt: string
  files?: DriveFileMetadata[]
}

export interface DriveFileMetadata {
  id: string
  name: string
  mimeType: string
  size?: string
  webViewLink?: string
}

export interface AssessmentDimensions {
  pronunciation: number
  fluency: number
  intonation: number
  grammar: number
  vocabulary: number
  overall: number
}

export interface AssessmentErrorMetadata {
  code: string
  message: string
  retryable: boolean
}

export interface NormalizedAssessment extends AssessmentDimensions {
  transcript: string
  feedback: string
  confidence: number | null
}

export interface Assessment extends NormalizedAssessment {
  id: string
  sessionId: string
  error: AssessmentErrorMetadata | null
  createdAt: string
}
