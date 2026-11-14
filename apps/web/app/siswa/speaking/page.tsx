'use client'

import { useEffect, useState } from 'react'
import type { QuestionBankItem } from '@tuturai/domain'
import { EmptyState, PracticeHeader } from '@/components/student/practice/practice-ui'
import { SpeakingStudio } from '@/components/student/speaking-studio'

export default function SpeakingPage() {
  const [topics, setTopics] = useState<QuestionBankItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/student/question-bank?type=speaking&limit=20')
      .then(async (response) => {
        if (!response.ok) throw new Error('LOAD_FAILED')
        return response.json() as Promise<{ data?: QuestionBankItem[] }>
      })
      .then((payload) => {
        const data = payload.data ?? []
        setTopics(data)
        const preferredId = new URLSearchParams(window.location.search).get('questionId')
        const preferred = data.find((item) => item.id === preferredId) ?? data[0]
        setActiveId(preferred?.id ?? null)
      })
      .catch(() => setError('Topik speaking belum dapat dimuat. Coba lagi nanti.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Speaking"
        title="Speaking Practice"
        description="Satu sesi, satu tugas. Bicara dalam kalimat lengkap, lalu baca transkrip dan lima dimensi penilaian dari provider."
        meta={[
          { label: 'Skenario', value: topics.length },
          { label: 'Mode', value: 'Real-time' },
          { label: 'Penilaian', value: '5 dimensi' },
        ]}
      />

      {loading ? (
        <div className="border border-rule bg-card px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Memuat topik speaking
        </div>
      ) : null}

      {error ? (
        <EmptyState title="Topik tidak tersedia" description={error} />
      ) : null}

      {!loading && !error && topics.length === 0 ? (
        <EmptyState
          title="Belum ada topik speaking"
          description="Guru belum mempublikasikan topik speaking. Coba lagi setelah materi baru ditambahkan."
        />
      ) : null}

      {!loading && !error && activeId ? (
        <SpeakingStudio topics={topics} activeTopicId={activeId} onSelectTopic={setActiveId} />
      ) : null}
    </div>
  )
}
