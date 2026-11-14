import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const STEPS = [
  {
    index: '01',
    title: 'Undang siswa ke kelas',
    detail: 'Bagikan kode kelas. Siswa yang bergabung langsung terhitung di readout atas.',
    href: '/guru/kelas',
    cta: 'Buka kelas',
  },
  {
    index: '02',
    title: 'Tugaskan latihan',
    detail: 'Attempt kuis dan sesi speaking yang dinilai provider mengalir ke panel ini.',
    href: '/guru/kelas',
    cta: 'Buat penugasan',
  },
  {
    index: '03',
    title: 'Laporan terisi sendiri',
    detail: 'Tidak ada skor contoh. Dimensi tanpa bukti tetap kosong sampai provider menilai.',
    href: null,
    cta: null,
  },
]

export function NextSteps() {
  return (
    <ol className="grid gap-4 sm:grid-cols-3">
      {STEPS.map((step) => (
        <li key={step.index} className="flex flex-col">
          <span className="font-mono text-[10px] tabular-nums tracking-[0.12em] text-muted-foreground/50">
            {step.index}
          </span>
          <p className="mt-1.5 text-[13px] font-medium text-foreground">{step.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{step.detail}</p>
          {step.href && step.cta && (
            <Link
              href={step.href}
              className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
            >
              {step.cta} <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          )}
        </li>
      ))}
    </ol>
  )
}
