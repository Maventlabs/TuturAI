'use client'

import { useState } from 'react'
import { Search, UserMinus, Users } from 'lucide-react'
import { classInitials } from '@/lib/class-tint'
import { Button } from '@/components/ui/button'
import type { ClassroomMemberSummary } from '@/components/guru/use-classroom-overview'

export function PeoplePanel({
  members,
  teacherName,
  band,
  removingId,
  memberError,
  onRemove,
}: {
  members: ClassroomMemberSummary[]
  teacherName: string
  band: string
  removingId: string | null
  memberError: string | null
  onRemove: (studentId: string) => void
}) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()
  const filtered = normalized
    ? members.filter(
        (member) =>
          member.name.toLowerCase().includes(normalized) ||
          (member.email ?? '').toLowerCase().includes(normalized),
      )
    : members

  return (
    <div className="space-y-6">
      <section aria-label="Guru pengampu">
        <h2 className="mb-2 font-heading text-sm font-bold text-foreground">Guru</h2>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: band }}
          >
            {classInitials(teacherName)}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{teacherName}</p>
            <p className="text-xs text-muted-foreground">Guru pengampu</p>
          </div>
        </div>
      </section>

      <section aria-label="Daftar siswa">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="font-heading text-sm font-bold text-foreground">Siswa</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{members.length}</span>
          </div>
          {members.length > 0 && (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama atau email"
                aria-label="Cari siswa"
                className="h-9 w-60 rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
              />
            </div>
          )}
        </div>

        {memberError && (
          <p role="alert" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {memberError}
          </p>
        )}

        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-heading text-base font-bold text-foreground">Belum ada siswa</h3>
            <p className="mx-auto mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
              Bagikan kode join kelas agar siswa dapat bergabung.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            Tidak ada siswa yang cocok dengan &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {filtered.map((member) => (
              <li key={member.studentId} className="flex items-center gap-3 px-4 py-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground"
                >
                  {classInitials(member.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                  {member.email && <p className="truncate text-xs text-muted-foreground">{member.email}</p>}
                </div>
                {typeof member.speakingScore === 'number' && (
                  <span className="hidden shrink-0 rounded-md bg-secondary px-2 py-1 font-mono text-xs font-semibold tabular-nums text-foreground sm:inline-flex">
                    {member.speakingScore}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(member.studentId)}
                  disabled={removingId === member.studentId}
                  className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                >
                  <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Hapus</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
