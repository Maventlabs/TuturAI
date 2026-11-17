export interface CompletionSummary {
  title: string
  message: string
}

export type ScoreTone = 'high' | 'good' | 'fair' | 'low'

export interface ScoreNarrative {
  tone: ScoreTone
  title: string
  message: string
}

/**
 * One narrative for every scored practice screen, so a 90 and a 30 never get
 * the same closing line. The low band stays encouraging on purpose: the score
 * is a measurement, not a verdict.
 */
export function getScoreNarrative(score: number): ScoreNarrative {
  const value = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0
  if (value >= 85) {
    return {
      tone: 'high',
      title: 'Hebat!',
      message: 'Skor ini menunjukkan penguasaan yang kuat. Pertahankan ritme latihanmu dan coba tantangan berikutnya.',
    }
  }
  if (value >= 70) {
    return {
      tone: 'good',
      title: 'Bagus sekali!',
      message: 'Kamu sudah di jalur yang tepat. Rapikan bagian yang masih meleset, lalu ulangi sesi ini sekali lagi.',
    }
  }
  if (value >= 50) {
    return {
      tone: 'fair',
      title: 'Teruskan!',
      message: 'Dasar-dasarnya sudah terbaca. Ulangi sesi ini untuk mengunci bagian yang belum stabil.',
    }
  }
  return {
    tone: 'low',
    title: 'Jangan berkecil hati',
    message: 'Setiap latihan menambah bekal. Ulangi sesi ini pelan-pelan; skor berikutnya akan lebih baik.',
  }
}

export function getQuizCompletionSummary(score: number, total: number): CompletionSummary {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0
  if (percentage >= 80) return { title: 'Luar biasa!', message: `Kamu menjawab ${score} dari ${total} soal dengan benar.` }
  if (percentage >= 50) return { title: 'Bagus, teruskan!', message: `Kamu menjawab ${score} dari ${total} soal dengan benar.` }
  return { title: 'Terus berlatih!', message: `Kamu menjawab ${score} dari ${total} soal dengan benar.` }
}
