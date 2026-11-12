import { Clock, Eye, FileText, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

function Panel({
  tone = 'light',
  className,
  children,
}: {
  tone?: 'light' | 'dark'
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative z-10 rounded-[3px] border shadow-[0_10px_30px_-16px_rgba(0,0,0,0.45)]',
        tone === 'dark' ? 'border-white/15 bg-ink-deep' : 'border-border bg-card',
        className,
      )}
    >
      {children}
    </div>
  )
}

function PanelLabel({
  tone = 'light',
  right,
  children,
}: {
  tone?: 'light' | 'dark'
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={cn(
          'font-mono text-[10px] uppercase tracking-[0.14em]',
          tone === 'dark' ? 'text-white/45' : 'text-muted-foreground',
        )}
      >
        {children}
      </span>
      {right}
    </div>
  )
}

function Pill({ tone = 'light', children }: { tone?: 'light' | 'dark'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em]',
        tone === 'dark' ? 'bg-white/10 text-white/70' : 'bg-secondary text-muted-foreground',
      )}
    >
      {children}
    </span>
  )
}

export function MuteMockup() {
  return (
    <>
      <Panel className="p-3.5">
        <PanelLabel right={<Mic className="size-3 text-primary" strokeWidth={1.5} />}>
          Sesi speaking
        </PanelLabel>
        <p className="mt-2 text-sm font-medium leading-snug text-foreground">
          Ceritakan harimu
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-muted-foreground">[2 MENIT]</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full bg-muted-foreground/25" />
            ))}
          </div>
        </div>
      </Panel>

      <Panel tone="dark" className="p-3.5">
        <PanelLabel
          tone="dark"
          right={
            <Pill tone="dark">
              <span className="size-1 rounded-full bg-white/60" />
              Menunggu
            </Pill>
          }
        >
          Catatan
        </PanelLabel>
        <div className="mt-2 flex flex-col gap-1.5">
          {['Paham semua soal', 'Tahu jawabannya', 'Tidak keluar suara'].map((line) => (
            <div key={line} className="flex items-center gap-1.5">
              <span className="size-1 shrink-0 rounded-full bg-white/30" />
              <span className="text-[11px] leading-tight text-white/70">{line}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}

const flatWave = [3, 4, 3, 5, 3, 4, 3, 3, 4, 3, 5, 3, 4, 3, 3, 4, 3, 5, 3, 4, 3, 3, 4, 3]

export function AnxietyMockup() {
  return (
    <>
      <Panel className="p-2">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="relative aspect-4/3 overflow-hidden rounded-[2px] bg-secondary">
            <div className="absolute inset-0 flex items-center justify-center">
              <Mic className="size-4 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <span className="absolute left-1 top-1 rounded-[2px] bg-card/90 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-foreground">
              Kamu
            </span>
          </div>
          <div className="relative aspect-4/3 overflow-hidden rounded-[2px] bg-ink-deep">
            <div className="absolute inset-0 flex items-center justify-center">
              <Eye className="size-4 text-white/35" strokeWidth={1.5} />
            </div>
            <span className="absolute left-1 top-1 rounded-[2px] bg-white/15 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-white/80">
              Dinilai
            </span>
          </div>
        </div>
      </Panel>

      <Panel tone="dark" className="p-3.5">
        <PanelLabel tone="dark">Terdengar</PanelLabel>
        <div className="mt-2 flex h-6 items-end gap-[3px]">
          {flatWave.map((h, i) => (
            <span
              key={i}
              className="w-[2px] rounded-full bg-white/25"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-[9px] text-white/40">0 kata terdeteksi</p>
      </Panel>
    </>
  )
}

export function CrowdedMockup() {
  return (
    <>
      <Panel className="p-3.5">
        <PanelLabel right={<span className="font-mono text-[9px] text-foreground">36 siswa</span>}>
          Kelas 11-A
        </PanelLabel>
        <div className="mt-2 grid grid-cols-12 gap-1.5">
          {Array.from({ length: 36 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'aspect-square rounded-full',
                i === 0 ? 'bg-primary' : 'bg-muted-foreground/20',
              )}
            />
          ))}
        </div>
      </Panel>

      <Panel tone="dark" className="p-3.5">
        <PanelLabel tone="dark">Antrean umpan balik</PanelLabel>
        <div className="mt-2 flex flex-col gap-1.5">
          {['Siswa 01', 'Siswa 02', 'Siswa 03'].map((name) => (
            <div key={name} className="flex items-center gap-1.5">
              <FileText className="size-2.5 shrink-0 text-white/35" strokeWidth={1.5} />
              <span className="text-[11px] leading-tight text-white/70">{name}</span>
              <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-white/30">
                belum
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}

export function OfflineMockup() {
  return (
    <>
      <Panel className="p-3.5">
        <PanelLabel right={<Pill>Offline</Pill>}>Latihan</PanelLabel>
        <p className="mt-2 text-sm font-medium leading-snug text-foreground">
          Speaking — set 3
        </p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-[42%] rounded-full bg-primary" />
        </div>
      </Panel>

      <Panel tone="dark" className="p-3.5">
        <PanelLabel tone="dark">Tersimpan lokal</PanelLabel>
        <div className="mt-2 flex flex-col gap-1.5">
          {['Rekaman 1', 'Rekaman 2', 'Rekaman 3'].map((name) => (
            <div key={name} className="flex items-center gap-1.5">
              <Clock className="size-2.5 shrink-0 text-white/35" strokeWidth={1.5} />
              <span className="text-[11px] leading-tight text-white/70">{name}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[9px] text-white/40">Menunggu sinyal</p>
      </Panel>
    </>
  )
}
