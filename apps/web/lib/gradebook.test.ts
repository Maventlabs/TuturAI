import { describe, expect, it } from 'vitest'
import { buildGradebook, type GradebookInput, type GradebookStudent } from './gradebook'

const ASSIGNMENT = { id: 'assignment-1', title: 'Self introduction' }

function student(overrides: {
  studentId: string
  name: string
  teacherScore?: number | null
  overall?: number | null
  status?: string
}): GradebookStudent {
  const hasSubmission = overrides.teacherScore !== undefined || overrides.status !== undefined
  return {
    studentId: overrides.studentId,
    name: overrides.name,
    submission: hasSubmission
      ? {
          status: overrides.status ?? 'submitted',
          submittedAt: '2026-10-01T00:00:00.000Z',
          teacherScore: overrides.teacherScore ?? null,
        }
      : null,
    assessment:
      typeof overrides.overall === 'number'
        ? {
            overall: overrides.overall,
            pronunciation: 0,
            fluency: 0,
            intonation: 0,
            grammar: 0,
            vocabulary: 0,
          }
        : null,
  }
}

function build(students: GradebookStudent[]) {
  const inputs: GradebookInput[] = [{ assignment: ASSIGNMENT, students }]
  return buildGradebook(inputs, students.map((entry) => ({ studentId: entry.studentId, name: entry.name })))
}

describe('buildGradebook teacher grades', () => {
  it('prefers the teacher grade over the AI estimate', () => {
    const gradebook = build([student({ studentId: 's1', name: 'Nina', teacherScore: 92, overall: 61 })])

    expect(gradebook.rows[0].cells[0]).toMatchObject({ score: 92, source: 'teacher', status: 'graded' })
    expect(gradebook.rows[0].average).toBe(92)
    expect(gradebook.classAverage).toBe(92)
  })

  it('falls back to the AI score when the teacher has not graded yet', () => {
    const gradebook = build([student({ studentId: 's1', name: 'Nina', overall: 78 })])

    expect(gradebook.rows[0].cells[0]).toMatchObject({ score: 78, source: 'ai', status: 'graded' })
    expect(gradebook.teacherGradedTotal).toBe(0)
  })

  it('counts only teacher grades in teacherGradedTotal', () => {
    const gradebook = build([
      student({ studentId: 's1', name: 'Nina', teacherScore: 90, overall: 70 }),
      student({ studentId: 's2', name: 'Bima', overall: 80 }),
      student({ studentId: 's3', name: 'Sari', status: 'pending_review' }),
    ])

    expect(gradebook.gradedTotal).toBe(2)
    expect(gradebook.teacherGradedTotal).toBe(1)
    expect(gradebook.pendingTotal).toBe(1)
  })

  it('keeps an ungraded submission pending instead of inventing a score', () => {
    const gradebook = build([student({ studentId: 's1', name: 'Nina', status: 'submitted' })])

    expect(gradebook.rows[0].cells[0]).toMatchObject({ score: null, source: null, status: 'pending' })
    expect(gradebook.classAverage).toBeNull()
  })
})
