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
  mode?: 'speaking' | 'pronunciation' | 'conversation'
  transcript: string
  feedback: string
  confidence: number | null
}

export interface Assessment extends NormalizedAssessment {
  id: string
  sessionId: string
  studentId: string
  questionId?: string
  error: AssessmentErrorMetadata | null
  createdAt: string
  /**
   * Canonical scoring block computed by the domain scoring engine
   * (SCORING_SPEC.md §14–§16). Optional for historical documents created before
   * the scoring engine existed; new canonical assessments always carry it.
   * `overall` above stays the engine-computed canonical final score.
   */
  scoring?: CanonicalScoringMetadata
}

export type CanonicalScoringMode = 'OFFLINE_EDGE' | 'ONLINE_FULL'

/** Raw structured evidence preserved for future recomputation (spec §15–§16). */
export interface CanonicalRawMetrics {
  wpm?: number
  pauseRatio?: number
  phonemeErrorRate?: number
  typeTokenRatio?: number
  [key: string]: number | string | boolean | null | undefined
}

export interface CanonicalScoringMetadata {
  scoringVersion: string
  mode: CanonicalScoringMode
  scores: {
    pronunciation: number
    fluency: number
    intonation: number
    grammar: number
    vocabulary: number
    final: number
  }
  rawMetrics?: CanonicalRawMetrics
}

/** Per-dimension provenance: engine-computed vs provider estimate (spec §13). */
export type DimensionScoreSource = 'CANONICAL_ENGINE' | 'PROVIDER_ESTIMATE' | 'PROVIDER_ESTIMATE_FALLBACK'

export interface AssessmentWithScoreSources extends Assessment {
  scoreSources?: Record<string, DimensionScoreSource>
}
