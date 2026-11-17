'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ExportGradesButton({
  classroomId,
  disabled = false,
}: {
  classroomId: string | null
  disabled?: boolean
}) {
  if (!classroomId) return null

  return (
    <Button asChild variant="outline" size="sm" className="gap-2" aria-disabled={disabled || undefined}>
      <a
        href={`/api/classrooms/${classroomId}/grades/export`}
        download
        aria-label="Ekspor buku nilai kelas ini ke Excel"
        className={disabled ? 'pointer-events-none opacity-50' : undefined}
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Ekspor Excel
      </a>
    </Button>
  )
}
