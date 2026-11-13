'use client'

import Link from 'next/link'
import { Archive, ArchiveRestore, Ban, ClipboardList, MoreVertical, RefreshCw, Users } from 'lucide-react'
import type { Classroom } from '@tuturai/domain'
import { classBandColor, classInitials } from '@/lib/class-tint'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ClassCardProps {
  classroom: Classroom
  teacherName: string
  studentCount: number
  assignmentCount: number
  pendingReview: number
  busy?: boolean
  onRegenerateKey: (classroom: Classroom) => void
  onRevokeKey: (classroom: Classroom) => void
  onToggleArchive: (classroom: Classroom) => void
}

export function ClassCard({
  classroom,
  teacherName,
  studentCount,
  assignmentCount,
  pendingReview,
  busy,
  onRegenerateKey,
  onRevokeKey,
  onToggleArchive,
}: ClassCardProps) {
  const archived = classroom.status === 'archived'
  const href = `/guru/kelas/${classroom.id}`

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      <div
        className="relative px-4 pb-10 pt-4"
        style={{ backgroundColor: classBandColor(classroom.id), opacity: archived ? 0.65 : 1 }}
      >
        <Link href={href} className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white/70">
          <h3 className="line-clamp-2 font-heading text-[17px] font-semibold leading-snug text-white">
            {classroom.name}
          </h3>
          <p className="mt-1 truncate text-xs text-white">{classroom.school ?? 'TuturAI Classroom'}</p>
          <p className="truncate text-xs text-white">{teacherName}</p>
        </Link>
        <span
          aria-hidden="true"
          className="absolute -bottom-6 right-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-foreground ring-2 ring-card"
        >
          {classInitials(classroom.name)}
        </span>
      </div>

      <div className="flex-1 px-4 pb-3 pt-8">
        {archived ? (
          <p className="text-xs font-medium text-muted-foreground">Diarsipkan</p>
        ) : pendingReview > 0 ? (
          <p className="text-xs font-semibold text-primary-deep">{pendingReview} submission menunggu review</p>
        ) : (
          <p className="text-xs text-muted-foreground">Tidak ada submission menunggu</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {studentCount} siswa · {assignmentCount} penugasan
        </p>
      </div>

      <div className="flex items-center justify-end gap-0.5 border-t border-border px-2 py-1">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
          <Link href={`${href}/people`} aria-label={`Siswa di ${classroom.name}`}>
            <Users className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
          <Link href={`${href}/classwork`} aria-label={`Penugasan ${classroom.name}`}>
            <ClipboardList className="h-4 w-4" />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                aria-label={`Aksi untuk ${classroom.name}`}
              />
            }
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer p-0">
                <Link href={href} className="flex w-full items-center px-1.5 py-1">
                  Buka kelas
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => onRegenerateKey(classroom)}
                className="cursor-pointer"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate kode join
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => onRevokeKey(classroom)}
                className="cursor-pointer"
              >
                <Ban className="mr-2 h-4 w-4" />
                Cabut kode join
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={busy}
              onClick={() => onToggleArchive(classroom)}
              className="cursor-pointer"
            >
              {archived ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
              {archived ? 'Aktifkan kelas' : 'Arsipkan kelas'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}
