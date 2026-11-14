export const TARGET_SCORE = 75

export type CellStatus = 'graded' | 'pending' | 'missing'

export interface GradebookCell {
  assignmentId: string
  score: number | null
  status: CellStatus
}

export interface GradebookRow {
  studentId: string
  name: string
  cells: GradebookCell[]
  average: number | null
  gradedCount: number
  pendingCount: number
  missingCount: number
}

export interface GradebookColumn {
  assignmentId: string
  title: string
  short: string
  average: number | null
  gradedCount: number
  totalStudents: number
}

export type DimensionKey = 'pronunciation' | 'fluency' | 'intonation' | 'grammar' | 'vocabulary'

export interface DimensionSummary {
  key: DimensionKey
  label: string
  short: string
  value: number | null
  sampleCount: number
}

export interface Gradebook {
  columns: GradebookColumn[]
  rows: GradebookRow[]
  classAverage: number | null
  distribution: Array<{ label: string; count: number }>
  dimensions: DimensionSummary[]
  belowTarget: number
  highest: number | null
  gradedTotal: number
  possibleTotal: number
  pendingTotal: number
}

export interface GradebookAssessment {
  overall: number
  pronunciation: number
  fluency: number
  intonation: number
  grammar: number
  vocabulary: number
  metricStatuses?: Record<string, string>
}

export interface GradebookStudent {
  studentId: string
  name: string
  submission: { status: string; submittedAt: string | null } | null
  assessment: GradebookAssessment | null
}

export interface GradebookInput {
  assignment: { id: string; title: string }
  students: GradebookStudent[]
}

export interface RosterEntry {
  studentId: string
  name: string
}

const DIMENSIONS: Array<{ key: DimensionKey; label: string; short: string }> = [
  { key: 'pronunciation', label: 'Pronunciation', short: 'PRO' },
  { key: 'fluency', label: 'Fluency', short: 'FLU' },
  { key: 'intonation', label: 'Intonation', short: 'INT' },
  { key: 'grammar', label: 'Grammar', short: 'GRA' },
  { key: 'vocabulary', label: 'Vocabulary', short: 'VOC' },
]

const BANDS = [
  { label: '<60', min: 0, max: 60 },
  { label: '60-74', min: 60, max: 75 },
  { label: '75-84', min: 75, max: 85 },
  { label: '85-100', min: 85, max: 101 },
]

const AWAITING_REVIEW = new Set(['submitted', 'pending_review'])

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function mean(values: number[]) {
  if (values.length === 0) return null
  return round1(values.reduce((total, value) => total + value, 0) / values.length)
}

/**
 * A dimension only counts when the provider actually produced evidence for it.
 * SCORING_SPEC §10 marks unsupported dimensions `insufficient_evidence`, and
 * those must never be averaged in as if they were a real score.
 */
function dimensionValue(assessment: GradebookAssessment, key: DimensionKey) {
  if (assessment.metricStatuses?.[key] === 'insufficient_evidence') return null
  const value = assessment[key]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function buildGradebook(inputs: GradebookInput[], roster: RosterEntry[] = []): Gradebook {
  const names = new Map<string, string>()
  for (const entry of roster) names.set(entry.studentId, entry.name)
  for (const input of inputs) {
    for (const student of input.students) {
      if (!names.has(student.studentId)) names.set(student.studentId, student.name)
    }
  }

  const columns: GradebookColumn[] = inputs.map((input, index) => {
    const scores = input.students
      .map((student) => student.assessment?.overall)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    return {
      assignmentId: input.assignment.id,
      title: input.assignment.title,
      short: `A${index + 1}`,
      average: mean(scores),
      gradedCount: scores.length,
      totalStudents: input.students.length,
    }
  })

  const rows: GradebookRow[] = Array.from(names.entries())
    .map(([studentId, name]) => {
      const cells: GradebookCell[] = inputs.map((input) => {
        const student = input.students.find((entry) => entry.studentId === studentId)
        const score = student?.assessment?.overall
        if (typeof score === 'number' && Number.isFinite(score)) {
          return { assignmentId: input.assignment.id, score, status: 'graded' as const }
        }
        const awaiting = student?.submission ? AWAITING_REVIEW.has(student.submission.status) : false
        return {
          assignmentId: input.assignment.id,
          score: null,
          status: awaiting ? ('pending' as const) : ('missing' as const),
        }
      })

      const graded = cells.filter((cell) => cell.score !== null).map((cell) => cell.score as number)
      return {
        studentId,
        name,
        cells,
        average: mean(graded),
        gradedCount: graded.length,
        pendingCount: cells.filter((cell) => cell.status === 'pending').length,
        missingCount: cells.filter((cell) => cell.status === 'missing').length,
      }
    })
    .sort((left, right) => {
      if (left.average === null && right.average === null) return left.name.localeCompare(right.name)
      if (left.average === null) return 1
      if (right.average === null) return -1
      return right.average - left.average
    })

  const allScores = rows.flatMap((row) =>
    row.cells.map((cell) => cell.score).filter((score): score is number => score !== null),
  )

  const distribution = BANDS.map((band) => ({
    label: band.label,
    count: allScores.filter((score) => score >= band.min && score < band.max).length,
  }))

  const dimensions: DimensionSummary[] = DIMENSIONS.map((dimension) => {
    const values: number[] = []
    for (const input of inputs) {
      for (const student of input.students) {
        if (!student.assessment) continue
        const value = dimensionValue(student.assessment, dimension.key)
        if (value !== null) values.push(value)
      }
    }
    return {
      key: dimension.key,
      label: dimension.label,
      short: dimension.short,
      value: mean(values),
      sampleCount: values.length,
    }
  })

  return {
    columns,
    rows,
    classAverage: mean(allScores),
    distribution,
    dimensions,
    belowTarget: rows.filter((row) => row.average !== null && row.average < TARGET_SCORE).length,
    highest: allScores.length > 0 ? Math.max(...allScores) : null,
    gradedTotal: allScores.length,
    possibleTotal: rows.length * columns.length,
    pendingTotal: rows.reduce((total, row) => total + row.pendingCount, 0),
  }
}
