'use client'

import { useEffect, useState } from 'react'
import type { QuestionBankItem } from '@tuturai/domain'
import { EmptyState, PracticeHeader, type LevelOption } from '@/components/student/practice/practice-ui'
import { LevelCardGrid } from '@/components/student/practice/level-cards'
import { PronunciationLab } from '@/components/student/pronunciation-lab'

type LevelId = 'beginner' | 'intermediate' | 'advanced'

const LEVELS: Array<{ id: LevelId; name: string; english: string; detail: string }> = [
  {
    id: 'beginner',
    name: 'Mudah',
    english: 'Beginner',
    detail: 'IELTS 5.0–6.0: huruf senyap, tekanan dasar, dan gugus konsonan sederhana.',
  },
  {
    id: 'intermediate',
    name: 'Sedang',
    english: 'Intermediate',
    detail: 'IELTS 6.0–7.0: pergeseran tekanan dan vokal schwa pada kata bersuku banyak.',
  },
  {
    id: 'advanced',
    name: 'Sulit',
    english: 'Advanced',
    detail: 'IELTS 7.0+: gugus konsonan rapat, bunyi /θ/ dan /ʃ/, serta kata lima suku kata.',
  },
]

export default function PronunciationPage() {
  const [banks, setBanks] = useState<Record<LevelId, QuestionBankItem[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<LevelId | null>(null)

  useEffect(() => {
    Promise.all(
      LEVELS.map((entry) =>
        fetch(`/api/student/question-bank?type=pronunciation&level=${entry.id}&limit=10`, { cache: 'no-store' }).then(
          async (response) => {
            if (!response.ok) throw new Error('LOAD_FAILED')
            return (await response.json()) as { data?: QuestionBankItem[] }
          },
        ),
      ),
    )
      .then((results) => {
        const next = {} as Record<LevelId, QuestionBankItem[]>
        LEVELS.forEach((entry, index) => {
          next[entry.id] = (results[index].data ?? []).filter((item) => Boolean(item.word))
        })
        setBanks(next)
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        if (preferredId) {
          const match = LEVELS.find((entry) => next[entry.id].some((item) => item.id === preferredId))
          if (match) setLevel(match.id)
        }
      })
      .catch(() => setError('Bank pronunciation belum dapat dimuat. Coba lagi nanti.'))
      .finally(() => setLoading(false))
  }, [])

  const options: LevelOption[] = LEVELS.map((entry) => ({
    id: entry.id,
    name: entry.name,
    english: entry.english,
    count: banks?.[entry.id].length ?? 0,
    detail: entry.detail,
    action: 'Mulai level',
    disabled: banks ? banks[entry.id].length === 0 : false,
    disabledReason: 'Belum ada kata untuk level ini.',
  }))

  const activeLevel = LEVELS.find((entry) => entry.id === level) ?? null
  const activeWords = level && banks ? banks[level] : []

  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Pronunciation"
        title="Pronunciation Lab"
        description="Pilih level, dengarkan rekaman model, lalu rekam satu kata. Speech recognition menilai kecocokan pelafalanmu pada skala 1–100."
        meta={[
          { label: 'Level', value: 3 },
          { label: 'Kata / level', value: 10 },
          { label: 'Skor', value: '1–100' },
        ]}
      />

      {loading ? (
        <div className="border border-rule bg-card px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Memuat latihan pronunciation
        </div>
      ) : null}

      {error ? <EmptyState title="Latihan tidak tersedia" description={error} /> : null}

      {!loading && !error && !level ? (
        <div className="space-y-4">
          <p className="max-w-[62ch] text-pretty text-[13px] leading-relaxed text-muted-foreground">
            Setiap level berisi sepuluh kata dengan satu target bunyi. Rekaman model sudah tersimpan, jadi bisa
            didengarkan kapan saja tanpa menunggu suara sintetis.
          </p>
          <LevelCardGrid options={options} onSelect={(id) => setLevel(id as LevelId)} />
        </div>
      ) : null}

      {!loading && !error && level && activeLevel && activeWords.length > 0 ? (
        <PronunciationLab words={activeWords} levelName={activeLevel.name} onExit={() => setLevel(null)} />
      ) : null}
    </div>
  )
}
