'use client'

import { FormEvent, useEffect, useState } from 'react'
import type { Classroom } from '@tuturai/domain'
import { Archive, Copy, Plus, RefreshCw, UserMinus, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'

type CreatedClassroom = Classroom & { joinKey: string }
type ClassroomMember = { studentId: string; name: string; email: string | null; joinedAt: string }

export default function ClassesPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [school, setSchool] = useState('')
  const [created, setCreated] = useState<CreatedClassroom | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null)
  const [members, setMembers] = useState<ClassroomMember[]>([])

  useEffect(() => {
    void loadClassrooms()
  }, [])

  async function loadClassrooms() {
    setLoading(true)
    try {
      const response = await fetch('/api/classrooms', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat kelas')
      setClassrooms(payload.data)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat kelas')
    } finally {
      setLoading(false)
    }
  }

  async function createClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
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
      setDescription('')
      await loadClassrooms()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuat kelas')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(classroom: Classroom) {
    const nextStatus = classroom.status === 'active' ? 'archived' : 'active'
    setActionLoading(`status:${classroom.id}`)
    setError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: classroom.name, description: classroom.description, school: classroom.school, status: nextStatus }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal mengubah status kelas')
      await loadClassrooms()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengubah status kelas')
    } finally {
      setActionLoading(null)
    }
  }

  async function updateJoinKey(classroomId: string, action: 'regenerate' | 'revoke') {
    setActionLoading(`key:${classroomId}`)
    setError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/join-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal mengubah kode join')
      if (action === 'regenerate') {
        const classroom = classrooms.find((item) => item.id === classroomId)
        if (classroom) setCreated({ ...classroom, joinKey: payload.data.joinKey })
      } else {
        setCreated(null)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengubah kode join')
    } finally {
      setActionLoading(null)
    }
  }

  async function loadMembers(classroomId: string) {
    setActionLoading(`members:${classroomId}`)
    setError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/members`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Gagal memuat siswa')
      setSelectedClassroomId(classroomId)
      setMembers(payload.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat siswa')
    } finally {
      setActionLoading(null)
    }
  }

  async function removeMember(classroomId: string, studentId: string) {
    setActionLoading(`remove:${studentId}`)
    setError(null)
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/members/${studentId}`, { method: 'DELETE' })
      const payload = response.status === 204 ? null : await response.json()
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Gagal menghapus siswa')
      setMembers((current) => current.filter((member) => member.studentId !== studentId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menghapus siswa')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Kelas Saya" description="Buat kelas dan bagikan kode join kepada siswa." />

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-base font-bold">Buat classroom</h2>
        </div>
        <form onSubmit={createClassroom} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Nama kelas
            <input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <label className="text-sm font-medium">
            Sekolah (opsional)
            <input value={school} onChange={(event) => setSchool(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Deskripsi (opsional)
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Buat kelas'}</Button>
          </div>
        </form>
      </Card>

      {created && (
        <Card className="border-primary/30 bg-primary/5 p-5">
          <p className="text-sm font-semibold">Kode join untuk {created.name}</p>
          <div className="mt-2 flex items-center gap-3">
            <code className="rounded bg-background px-3 py-2 text-lg font-bold tracking-[0.2em]">{created.joinKey}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard?.writeText(created.joinKey)}>
              <Copy className="mr-2 h-4 w-4" /> Salin
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Kode ini hanya ditampilkan setelah kelas dibuat. Simpan atau bagikan secara aman.</p>
        </Card>
      )}

      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      <section aria-labelledby="classroom-list-heading">
         <h2 id="classroom-list-heading" className="mb-3 font-heading text-lg font-bold">Classroom saya</h2>
        {loading ? <p className="text-sm text-muted-foreground">Memuat classroom...</p> : classrooms.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">Belum ada classroom. Buat classroom pertama untuk mulai mengundang siswa.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
             {classrooms.map((classroom) => (
               <Card key={classroom.id} className="p-5">
                 <h3 className="font-heading text-lg font-bold">{classroom.name}</h3>
                 <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-4 w-4" /> {classroom.status === 'active' ? 'Classroom aktif' : 'Diarsipkan'}</p>
                 {classroom.description && <p className="mt-4 text-sm text-muted-foreground">{classroom.description}</p>}
                 <div className="mt-4 flex flex-wrap gap-2">
                   <Button type="button" size="sm" variant="outline" onClick={() => void loadMembers(classroom.id)} disabled={actionLoading === `members:${classroom.id}`}>
                     <Users className="mr-2 h-4 w-4" /> Siswa
                   </Button>
                   <Button type="button" size="sm" variant="outline" onClick={() => void updateJoinKey(classroom.id, 'regenerate')} disabled={actionLoading === `key:${classroom.id}`}>
                     <RefreshCw className="mr-2 h-4 w-4" /> Regenerate key
                   </Button>
                   <Button type="button" size="sm" variant="outline" onClick={() => void updateJoinKey(classroom.id, 'revoke')} disabled={actionLoading === `key:${classroom.id}`}>
                     Cabut key
                   </Button>
                   <Button type="button" size="sm" variant="outline" onClick={() => void updateStatus(classroom)} disabled={actionLoading === `status:${classroom.id}`}>
                     <Archive className="mr-2 h-4 w-4" /> {classroom.status === 'active' ? 'Arsipkan' : 'Aktifkan'}
                   </Button>
                 </div>
               </Card>
             ))}
           </div>
         )}
       </section>

       {selectedClassroomId && (
         <Card className="p-5">
           <div className="flex items-center justify-between gap-3">
             <div>
               <h2 className="font-heading text-lg font-bold">Siswa di {classrooms.find((item) => item.id === selectedClassroomId)?.name ?? 'classroom'}</h2>
               <p className="text-sm text-muted-foreground">Hapus membership hanya dari classroom yang Anda miliki.</p>
             </div>
             <span className="text-sm text-muted-foreground">{members.length} siswa</span>
           </div>
           <div className="mt-4 divide-y divide-border rounded-lg border border-border">
             {members.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Belum ada siswa aktif.</p> : members.map((member) => (
               <div key={member.studentId} className="flex items-center justify-between gap-3 p-4">
                 <div>
                   <p className="text-sm font-semibold">{member.name}</p>
                   {member.email && <p className="text-xs text-muted-foreground">{member.email}</p>}
                 </div>
                 <Button type="button" size="sm" variant="outline" onClick={() => void removeMember(selectedClassroomId, member.studentId)} disabled={actionLoading === `remove:${member.studentId}`}>
                   <UserMinus className="mr-2 h-4 w-4" /> Hapus
                 </Button>
               </div>
             ))}
           </div>
         </Card>
       )}
     </div>
  )
}
