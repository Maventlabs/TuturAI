import { FieldGrid, SectionHeader, SheetNote, StatusChip } from './primitives'

export interface TeacherProfile {
  displayName: string
  email: string
  school: string
  subject: string | null
}

function initialsOf(name: string | null | undefined) {
  if (!name) return 'GR'
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
  return initials || 'GR'
}

export function IdentityPanel({ profile, error }: { profile: TeacherProfile | null; error: string | null }) {
  const schoolComplete = Boolean(profile?.school && profile?.subject)

  return (
    <section id="identitas" className="scroll-mt-24 px-5 py-5 sm:px-6">
      <SectionHeader
        label="Identitas"
        description="Nama dan email mengikuti akun Firebase. Data sekolah dipakai untuk laporan kelas dan penugasan."
        status={
          <StatusChip tone={schoolComplete ? 'ok' : 'idle'}>
            {schoolComplete ? 'Lengkap' : 'Belum lengkap'}
          </StatusChip>
        }
      />

      <div className="mt-4 flex items-center gap-3.5 border border-rule px-3.5 py-3">
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center bg-primary/10 font-mono text-[15px] font-medium text-primary"
        >
          {initialsOf(profile?.displayName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-foreground">
            {profile?.displayName || 'Memuat profil…'}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">{profile?.email || 'Email belum terbaca'}</p>
        </div>
        <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Guru
        </span>
      </div>

      <p className="mt-4 mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Sekolah</p>
      <FieldGrid
        fields={[
          { label: 'Nama sekolah', value: profile?.school ?? null },
          { label: 'Mata pelajaran', value: profile?.subject ?? null },
          { label: 'NIP', value: null },
          { label: 'Kota / kabupaten', value: null },
        ]}
      />

      <SheetNote>
        NIP, kota/kabupaten, dan tahun ajaran belum tersedia di profil Firebase. Lengkapi lewat onboarding
        berikutnya — halaman ini tidak menyimpan perubahan identitas.
      </SheetNote>
      {error && <SheetNote tone="error">{error}</SheetNote>}
    </section>
  )
}
