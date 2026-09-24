function escapePdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1')
}

export function createReportPdf(lines: string[]) {
  const safeLines = lines.length ? lines : ['Tidak ada data untuk laporan ini.']
  const content = [
    'BT',
    '/F1 16 Tf',
    '50 760 Td',
    `(${escapePdfText(safeLines[0])}) Tj`,
    '/F1 10 Tf',
    ...safeLines.slice(1).flatMap((line) => ['0 -20 Td', `(${escapePdfText(line)}) Tj`]),
    'ET',
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'ascii')
}
