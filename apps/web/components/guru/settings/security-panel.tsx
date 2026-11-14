import { FieldGrid, SectionHeader, SheetNote, StatusChip } from './primitives'

export function SecurityPanel({ email }: { email: string | null }) {
  return (
    <section id="keamanan" className="scroll-mt-24 px-5 py-5 sm:px-6">
      <SectionHeader
        label="Keamanan"
        description="Kredensial akun dikelola sepenuhnya oleh Firebase Auth. TuturAI tidak menyimpan atau menyimulasikan password di halaman ini."
        status={<StatusChip tone="ok">Firebase Auth</StatusChip>}
      />

      <div className="mt-4">
        <FieldGrid
          fields={[
            { label: 'Email akun', value: email },
            { label: 'Metode masuk', value: 'Email & password / Google' },
            { label: 'Peran', value: 'Guru', hint: 'permanen setelah onboarding' },
            { label: 'Pengelola kredensial', value: 'Firebase Auth' },
          ]}
        />
      </div>

      <SheetNote>
        Perubahan password belum tersedia di TuturAI. Gunakan alur reset password Firebase Auth agar sesi dan
        audit tetap konsisten.
      </SheetNote>
    </section>
  )
}
