import ExcelJS from 'exceljs'
import { TARGET_SCORE, type Gradebook } from './gradebook'

export interface GradebookExportRosterEntry {
  studentId: string
  email: string | null
}

export interface GradebookExportAssignment {
  id: string
  title: string
  dueAt: string | null
}

export interface GradebookExportRow {
  no: number
  name: string
  email: string | null
  scores: Array<number | null>
  average: number | null
  gradedCount: number
  status: string
}

export interface GradebookExportInput {
  className: string
  gradebook: Gradebook
  assignments: GradebookExportAssignment[]
  roster: GradebookExportRosterEntry[]
  generatedAt: Date
}

function rowStatus(pendingCount: number, missingCount: number) {
  if (pendingCount > 0) return `${pendingCount} menunggu`
  if (missingCount > 0) return `${missingCount} kosong`
  return 'Lengkap'
}

/**
 * Rows are alphabetical, not ranked: an exported class list is read as a report
 * card, where a teacher looks a student up by name.
 */
export function buildGradebookExportRows(input: GradebookExportInput): GradebookExportRow[] {
  const emails = new Map(input.roster.map((entry) => [entry.studentId, entry.email]))
  return [...input.gradebook.rows]
    .sort((left, right) => left.name.localeCompare(right.name, 'id'))
    .map((row, index) => ({
      no: index + 1,
      name: row.name,
      email: emails.get(row.studentId) ?? null,
      scores: row.cells.map((cell) => cell.score),
      average: row.average,
      gradedCount: row.gradedCount,
      status: rowStatus(row.pendingCount, row.missingCount),
    }))
}

function formatDate(value: string | null) {
  if (!value) return 'Tanpa tenggat'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'kelas'
}

export function gradebookExportFilename(className: string, generatedAt: Date) {
  const stamp = generatedAt.toISOString().slice(0, 10)
  return `buku-nilai-${slugify(className)}-${stamp}.xlsx`
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F2F4' },
}

export async function buildGradebookWorkbook(input: GradebookExportInput): Promise<Buffer> {
  const { className, gradebook, assignments, generatedAt } = input
  const rows = buildGradebookExportRows(input)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'TuturAI'
  workbook.created = generatedAt

  const sheet = workbook.addWorksheet('Buku Nilai', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
  })

  sheet.mergeCells(1, 1, 1, 3 + gradebook.columns.length + 3)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `Buku Nilai — ${className}`
  titleCell.font = { size: 14, bold: true }

  sheet.mergeCells(2, 1, 2, 3 + gradebook.columns.length + 3)
  const noteCell = sheet.getCell(2, 1)
  noteCell.value = `Diekspor ${formatDate(generatedAt.toISOString())} · Skala 1–100 · Nilai guru diutamakan; sel kosong berarti belum dinilai.`
  noteCell.font = { size: 10, color: { argb: 'FF6E6E73' } }

  const headerRow = sheet.getRow(4)
  headerRow.values = [
    'No',
    'Nama',
    'Email',
    ...gradebook.columns.map((column) => column.short),
    'Rata-rata',
    'Ternilai',
    'Status',
  ]
  headerRow.font = { bold: true }
  headerRow.alignment = { vertical: 'middle' }
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD2D2D7' } } }
  })

  rows.forEach((row, index) => {
    const sheetRow = sheet.getRow(5 + index)
    sheetRow.values = [
      row.no,
      row.name,
      row.email ?? '',
      ...row.scores.map((score) => score ?? null),
      row.average ?? null,
      row.gradedCount,
      row.status,
    ]
    sheetRow.getCell(1).alignment = { horizontal: 'center' }
    for (let column = 4; column < 4 + row.scores.length; column += 1) {
      sheetRow.getCell(column).alignment = { horizontal: 'center' }
      sheetRow.getCell(column).numFmt = '0'
    }
    const averageCell = sheetRow.getCell(4 + row.scores.length)
    averageCell.numFmt = '0.0'
    averageCell.alignment = { horizontal: 'center' }
    averageCell.font = { bold: true }
    sheetRow.getCell(5 + row.scores.length).alignment = { horizontal: 'center' }
  })

  const footerRow = sheet.getRow(5 + rows.length)
  footerRow.values = [
    '',
    'Rata-rata penugasan',
    '',
    ...gradebook.columns.map((column) => column.average ?? null),
    gradebook.classAverage ?? null,
    gradebook.gradedTotal,
    '',
  ]
  footerRow.font = { bold: true }
  footerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.border = { top: { style: 'thin', color: { argb: 'FFD2D2D7' } } }
  })
  for (let column = 4; column < 4 + gradebook.columns.length; column += 1) {
    footerRow.getCell(column).numFmt = '0.0'
    footerRow.getCell(column).alignment = { horizontal: 'center' }
  }
  footerRow.getCell(4 + gradebook.columns.length).numFmt = '0.0'
  footerRow.getCell(4 + gradebook.columns.length).alignment = { horizontal: 'center' }

  sheet.getColumn(1).width = 5
  sheet.getColumn(2).width = 30
  sheet.getColumn(3).width = 30
  for (let column = 4; column < 4 + gradebook.columns.length; column += 1) {
    sheet.getColumn(column).width = 11
  }
  sheet.getColumn(4 + gradebook.columns.length).width = 12
  sheet.getColumn(5 + gradebook.columns.length).width = 10
  sheet.getColumn(6 + gradebook.columns.length).width = 14

  const assignmentSheet = workbook.addWorksheet('Penugasan', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const assignmentHeader = assignmentSheet.getRow(1)
  assignmentHeader.values = ['Kode', 'Judul', 'Tenggat', 'Dinilai', 'Rata-rata']
  assignmentHeader.font = { bold: true }
  assignmentHeader.eachCell((cell) => {
    cell.fill = HEADER_FILL
  })
  gradebook.columns.forEach((column, index) => {
    const assignment = assignments.find((entry) => entry.id === column.assignmentId)
    const sheetRow = assignmentSheet.getRow(2 + index)
    sheetRow.values = [
      column.short,
      assignment?.title ?? column.title,
      formatDate(assignment?.dueAt ?? null),
      `${column.gradedCount}/${column.totalStudents}`,
      column.average ?? null,
    ]
    sheetRow.getCell(1).alignment = { horizontal: 'center' }
    sheetRow.getCell(4).alignment = { horizontal: 'center' }
    sheetRow.getCell(5).numFmt = '0.0'
    sheetRow.getCell(5).alignment = { horizontal: 'center' }
  })
  assignmentSheet.getColumn(1).width = 7
  assignmentSheet.getColumn(2).width = 44
  assignmentSheet.getColumn(3).width = 18
  assignmentSheet.getColumn(4).width = 10
  assignmentSheet.getColumn(5).width = 11

  const infoSheet = workbook.addWorksheet('Info')
  const aiGradedTotal = Math.max(0, gradebook.gradedTotal - gradebook.teacherGradedTotal)
  const infoRows: Array<[string, string | number]> = [
    ['Kelas', className],
    ['Diekspor', formatDate(generatedAt.toISOString())],
    ['Jumlah siswa', gradebook.rows.length],
    ['Jumlah penugasan', gradebook.columns.length],
    ['Nilai guru', gradebook.teacherGradedTotal],
    ['Skor AI (belum dinilai guru)', aiGradedTotal],
    ['Belum dinilai', gradebook.possibleTotal - gradebook.gradedTotal],
    ['Rata-rata kelas', gradebook.classAverage ?? 'Belum ada'],
    ['Target', TARGET_SCORE],
    ['Nilai tertinggi', gradebook.highest ?? 'Belum ada'],
    ['Di bawah target', gradebook.belowTarget],
    ['Keterangan', 'Nilai guru diutamakan. Skor AI hanya dipakai bila guru belum mengisi nilai.'],
  ]
  infoRows.forEach(([label, value], index) => {
    const sheetRow = infoSheet.getRow(1 + index)
    sheetRow.values = [label, value]
    sheetRow.getCell(1).font = { bold: true }
  })
  infoSheet.getColumn(1).width = 30
  infoSheet.getColumn(2).width = 60

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
