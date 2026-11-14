import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PracticeHeader, MonoLabel, Panel, PanelHeader } from '@/components/student/practice/practice-ui'
import { getAdaptiveModule } from '@/lib/adaptive-modules'
import { PrintModuleButton } from './print-module-button'

export async function generateMetadata({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params
  const learningModule = getAdaptiveModule(moduleId)
  return { title: learningModule ? `${learningModule.title} | TuturAI` : 'Modul adaptif | TuturAI' }
}

export default async function AdaptiveModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params
  const learningModule = getAdaptiveModule(moduleId)
  if (!learningModule) notFound()

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/siswa/adaptive"><ArrowLeft data-icon="inline-start" /> Kembali ke jalur adaptif</Link>
        </Button>
        <PrintModuleButton />
      </div>

      <article className="module-report space-y-6 bg-background">
        <header className="overflow-hidden border border-rule bg-card">
          <div className="flex min-h-36 flex-col justify-between gap-6 bg-primary px-6 py-6 text-white sm:flex-row sm:items-end sm:px-9 sm:py-8 print:min-h-0 print:bg-white print:text-black">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">{learningModule.banner}</p>
              <h1 className="mt-3 max-w-2xl font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{learningModule.title}</h1>
            </div>
            <div className="shrink-0 border-l border-white/40 pl-4 print:border-black">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-80">Level kemampuan</p>
              <p className="mt-1 text-lg font-semibold">{learningModule.level}</p>
              <p className="font-mono text-xs opacity-80">Rentang panduan {learningModule.range}</p>
            </div>
          </div>
          <div className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_auto] sm:px-9">
            <div>
              <MonoLabel>Ringkasan modul</MonoLabel>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground">{learningModule.summary}</p>
            </div>
            <p className="self-end font-mono text-[10px] text-muted-foreground">TuturAI · Rencana belajar adaptif</p>
          </div>
        </header>

        <Panel>
          <PanelHeader label="Analisis pembelajaran" />
          <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-6">
            <p className="text-sm leading-7 text-foreground">{learningModule.analysis}</p>
            <aside className="border-l-2 border-primary bg-secondary/40 px-4 py-3" aria-label="Catatan interpretasi">
              <MonoLabel>Catatan</MonoLabel>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Rentang ini adalah panduan belajar internal, bukan konversi CEFR atau nilai ujian. Guru dan siswa tetap meninjau bukti latihan.</p>
            </aside>
          </div>
        </Panel>

        <div className="grid gap-6 md:grid-cols-2">
          <Panel>
            <PanelHeader label="Target belajar" />
            <ul className="flex flex-col gap-3 p-5">
              {learningModule.objectives.map((objective, index) => (
                <li key={objective} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <span className="font-mono text-xs text-primary">0{index + 1}</span>{objective}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader label="Rekomendasi tindak lanjut" />
            <ul className="flex flex-col gap-3 p-5">
              {learningModule.recommendations.map((recommendation) => (
                <li key={recommendation} className="border-l border-rule pl-3 text-sm leading-relaxed text-foreground">{recommendation}</li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel>
          <PanelHeader label="Rangkaian aktivitas" right={<MonoLabel>3 langkah</MonoLabel>} />
          <ol className="divide-y divide-rule">
            {learningModule.activities.map((activity, index) => (
              <li key={activity.title} className="grid gap-2 px-5 py-4 sm:grid-cols-[48px_1fr_1fr] sm:gap-4">
                <span className="font-mono text-xs text-primary">0{index + 1}</span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{activity.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{activity.instruction}</p>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Bukti belajar: </span>{activity.evidence}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <footer className="flex flex-col gap-2 border-t border-rule pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <MonoLabel>Langkah berikutnya</MonoLabel>
            <p className="mt-1 text-sm text-foreground">{learningModule.nextStep}</p>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">Materi belajar · {learningModule.category} · {learningModule.level}</p>
        </footer>
      </article>
      <style>{`@media print { @page { size: A4; margin: 16mm; } body { background: white !important; } body * { visibility: hidden !important; } .module-report, .module-report * { visibility: visible !important; } .module-report { position: absolute; inset: 0; width: 100%; color: #1d1d1f; } .module-report section, .module-report header { break-inside: avoid; box-shadow: none !important; } }`}</style>
    </main>
  )
}
