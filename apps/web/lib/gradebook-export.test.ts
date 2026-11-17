import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { buildGradebook, type GradebookInput } from './gradebook'
import { buildGradebookExportRows, buildGradebookWorkbook, gradebookExportFilename } from './gradebook-export'

const inputs: GradebookInput[] = [
  {
    assignment: { id: 'assignment-1', title: 'Self introduction' },
    students: [
      {
        studentId: 's2',
        name: 'Bima',
        submission: { status: 'submitted', submittedAt: '2026-10-01T00:00:00.000Z', teacherScore: 70 },
        assessment: null,
      },
      {
        studentId: 's1',
        name: 'Ani',
        submission: { status: 'submitted', submittedAt: '2026-10-01T00:00:00.000Z', teacherScore: 95 },
        assessment: null,
      },
    ],
  },
]

const gradebook = buildGradebook(inputs, [
  { studentId: 's1', name: 'Ani' },
  { studentId: 's2', name: 'Bima' },
])

describe('buildGradebookExportRows', () => {
  it('lists students alphabetically with their teacher grades', () => {
    const rows = buildGradebookExportRows({
      className: 'Speaking XI',
      gradebook,
      assignments: [{ id: 'assignment-1', title: 'Self introduction', dueAt: null }],
      roster: [
        { studentId: 's1', email: 'ani@example.test' },
        { studentId: 's2', email: null },
      ],
      generatedAt: new Date('2026-11-17T00:00:00.000Z'),
    })

    expect(rows.map((row) => row.name)).toEqual(['Ani', 'Bima'])
    expect(rows[0]).toMatchObject({ no: 1, email: 'ani@example.test', scores: [95], average: 95, status: 'Lengkap' })
    expect(rows[1]).toMatchObject({ no: 2, email: null, scores: [70], average: 70 })
  })
})

describe('buildGradebookWorkbook', () => {
  it('writes a readable workbook with the gradebook sheets', async () => {
    const buffer = await buildGradebookWorkbook({
      className: 'Speaking XI',
      gradebook,
      assignments: [{ id: 'assignment-1', title: 'Self introduction', dueAt: '2026-10-05T00:00:00.000Z' }],
      roster: [
        { studentId: 's1', email: 'ani@example.test' },
        { studentId: 's2', email: null },
      ],
      generatedAt: new Date('2026-11-17T00:00:00.000Z'),
    })

    expect(buffer.subarray(0, 2).toString()).toBe('PK')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Buku Nilai', 'Penugasan', 'Info'])

    const sheet = workbook.getWorksheet('Buku Nilai')
    expect(sheet?.getCell('B5').value).toBe('Ani')
    expect(sheet?.getCell('D5').value).toBe(95)
    expect(sheet?.getCell('B6').value).toBe('Bima')
    expect(sheet?.getCell('D6').value).toBe(70)
  })
})

describe('buildGradebookWorkbook column growth', () => {
  function manyInputs(count: number): GradebookInput[] {
    return Array.from({ length: count }, (_, index) => ({
      assignment: { id: `assignment-${index + 1}`, title: `Tugas ${index + 1}` },
      students: [
        {
          studentId: 's1',
          name: 'Ani',
          submission: { status: 'submitted', submittedAt: '2026-10-01T00:00:00.000Z', teacherScore: 80 + index },
          assessment: null,
        },
      ],
    }))
  }

  it('adds one column per assignment instead of stopping at a fixed count', async () => {
    for (const count of [5, 8, 12]) {
      const inputs = manyInputs(count)
      const buffer = await buildGradebookWorkbook({
        className: 'Speaking XI',
        gradebook: buildGradebook(inputs, [{ studentId: 's1', name: 'Ani' }]),
        assignments: inputs.map((input) => ({ id: input.assignment.id, title: input.assignment.title, dueAt: null })),
        roster: [{ studentId: 's1', email: 'ani@example.test' }],
        generatedAt: new Date('2026-11-17T00:00:00.000Z'),
      })

      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
      const sheet = workbook.getWorksheet('Buku Nilai')
      const header = (sheet?.getRow(4).values as unknown[]).slice(1)

      expect(header.slice(3, 3 + count)).toEqual(Array.from({ length: count }, (_, index) => `A${index + 1}`))
      expect(header[3 + count]).toBe('Rata-rata')
      expect(sheet?.getCell(5, 4).value).toBe(80)
      expect(sheet?.getCell(5, 3 + count).value).toBe(80 + count - 1)
    }
  })
})

describe('gradebookExportFilename', () => {
  it('slugifies the class name and stamps the export date', () => {
    expect(gradebookExportFilename('Speaking XI / Kelas A', new Date('2026-11-17T10:00:00.000Z'))).toBe(
      'buku-nilai-speaking-xi-kelas-a-2026-11-17.xlsx',
    )
  })
})
