'use client'

import { useEffect, useState } from 'react'
import type { QuestionBankItem } from '@tuturai/domain'
import { EmptyState, PracticeHeader } from '@/components/student/practice/practice-ui'
import { PronunciationLab } from '@/components/student/pronunciation-lab'

export default function PronunciationPage() {
  const [words, setWords] = useState<QuestionBankItem[]>([])
  const [initialIndex, setInitialIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/student/question-bank?type=pronunciation&limit=20')
      .then(async (response) => {
        if (!response.ok) throw new Error('LOAD_FAILED')
        return response.json() as Promise<{ data?: QuestionBankItem[] }>
      })
      .then((payload) => {
        const data = payload.data ?? []
        setWords(data)
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        const preferredIndex = preferredId ? data.findIndex((item) => item.id === preferredId) : -1
        if (preferredIndex >= 0) setInitialIndex(preferredIndex)
      })
      .catch(() => setError('Bank pronunciation belum dapat dimuat. Coba lagi nanti.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Pronunciation"
        title="Pronunciation Lab"
        description="Satu kata per giliran. Rekam, lalu bandingkan fonem yang dinilai provider dengan target IPA."
        meta={[
          { label: 'Kata', value: words.length },
          { label: 'Penilaian', value: 'Fonem' },
          { label: 'Sumber', value: 'Provider' },
        ]}
      />

      {loading ? (
        <div className="border border-rule bg-card px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Memuat latihan pronunciation
        </div>
      ) : null}

      {error ? <EmptyState title="Latihan tidak tersedia" description={error} /> : null}

      {!loading && !error && words.length === 0 ? (
        <EmptyState
          title="Belum ada latihan pronunciation"
          description="Guru belum mempublikasikan kata latihan. Coba lagi setelah materi baru ditambahkan."
        />
      ) : null}

      {!loading && !error && words.length > 0 ? (
        <PronunciationLab words={words} initialIndex={initialIndex} />
      ) : null}
    </div>
  )
}
