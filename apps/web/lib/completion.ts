export interface CompletionSummary {
  title: string
  message: string
}

export function getQuizCompletionSummary(score: number, total: number): CompletionSummary {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0
  if (percentage >= 80) return { title: 'Luar biasa!', message: `Kamu menjawab ${score} dari ${total} soal dengan benar.` }
  if (percentage >= 50) return { title: 'Bagus, teruskan!', message: `Kamu menjawab ${score} dari ${total} soal dengan benar.` }
  return { title: 'Terus berlatih!', message: `Kamu menjawab ${score} dari ${total} soal dengan benar.` }
}
