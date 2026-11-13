'use client'

import { FormEvent, useState } from 'react'
import type { Classroom } from '@tuturai/domain'
import { Copy, GraduationCap, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ClassCard } from '@/components/guru/class-card'
import { useClassroomOverview, useTeacherName } from '@/components/guru/use-classroom-overview'

type CreatedClassroom = Classroom & { joinKey: string }

export default function ClassesPage() {
  const { classrooms, loading, error, reload } = useClassroomOverview()
  const teacherName = useTeacherName()

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedClassroom | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function createClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const response = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, school }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal membuat kelas')
      setCreated(payload.data)
      setName('')
      setSchool('')
      setDescription('')
      setCreateOpen(false)
      reload()
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Gagal membuat kelas')
    } finally {
      setSaving(false)
    }
  }

  async function regenerateKey(classroom: Classroom) {
    setBusyId(classroom.id)
    setActionError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroom.id}/join-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal mengubah kode join')
      setCreated({ ...classroom, joinKey: payload.data.joinKey })
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Gagal mengubah kode join')
    } finally {
      setBusyId(null)
    }
  }

  async function revokeKey(classroom: Classroom) {
    setBusyId(classroom.id)
    setActionError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroom.id}/join-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal mencabut kode join')
      setCreated(null)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Gagal mencabut kode join')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleArchive(classroom: Classroom) {
    const nextStatus = classroom.status === 'active' ? 'archived' : 'active'
    setBusyId(classroom.id)
    setActionError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: classroom.name,
          description: classroom.description,
          school: classroom.school,
          status: nextStatus,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal mengubah status kelas')
      reload()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Gagal mengubah status kelas')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Kelas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola classroom, siswa, dan penugasan speaking dari satu tempat.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Buat kelas
        </Button>
      </div>

      {(error || actionError) && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <span>{actionError ?? error}</span>
          <Button type="button" size="sm" variant="outline" onClick={reload}>
            Coba lagi
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : classrooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <GraduationCap className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
          <h2 className="font-heading text-lg font-bold text-foreground">Belum ada kelas</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Buat kelas pertama, lalu bagikan kode join agar siswa dapat bergabung.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5 gap-2">
            <Plus className="h-4 w-4" />
            Buat kelas
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {classrooms.map((classroom) => (
            <ClassCard
              key={classroom.id}
              classroom={classroom}
              teacherName={teacherName}
              studentCount={classroom.members.length}
              assignmentCount={classroom.assignments.length}
              pendingReview={classroom.pendingReview}
              busy={busyId === classroom.id}
              onRegenerateKey={regenerateKey}
              onRevokeKey={revokeKey}
              onToggleArchive={toggleArchive}
            />
          ))}
        </div>
      )}

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Buat kelas</SheetTitle>
            <SheetDescription>
              Kode join dibuat otomatis dan ditampilkan sekali setelah kelas tersimpan.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={createClassroom} className="flex flex-1 flex-col gap-4 px-4">
            <label className="text-sm font-medium text-foreground">
              Nama kelas
              <input
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Contoh: Kelas X IPA 1"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              />
            </label>
            <label className="text-sm font-medium text-foreground">
              Sekolah (opsional)
              <input
                value={school}
                onChange={(event) => setSchool(event.target.value)}
                placeholder="Nama sekolah"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              />
            </label>
            <label className="text-sm font-medium text-foreground">
              Deskripsi (opsional)
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Deskripsi singkat kelas"
                className="mt-1 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              />
            </label>
            {formError && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {formError}
              </p>
            )}
            <SheetFooter className="px-0">
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Menyimpan...' : 'Buat kelas'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={created !== null} onOpenChange={(open) => { if (!open) setCreated(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Kode join kelas</SheetTitle>
            <SheetDescription>
              Bagikan kode ini kepada siswa. Kode hanya ditampilkan sekali, simpan sebelum menutup panel.
            </SheetDescription>
          </SheetHeader>
          {created && (
            <div className="space-y-4 px-4">
              <p className="text-sm font-semibold text-foreground">{created.name}</p>
              <div className="flex items-center gap-3">
                <code className="rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-xl font-bold tracking-[0.25em] text-foreground">
                  {created.joinKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard?.writeText(created.joinKey)}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Salin
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Kode dapat dibuat ulang kapan saja dari menu kartu kelas.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
