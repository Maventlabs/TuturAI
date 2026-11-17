import type { Metadata } from 'next'
import { ChallengeSpeakingRoom } from '@/components/student/challenge-speaking/challenge-speaking-room'
import { getSessionProfile } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Matchmaking · TuturAI',
  description:
    'Berlatih berbicara Bahasa Inggris dengan sesama siswa TuturAI secara real-time. Pilih mode percakapan, temukan partner dengan level seimbang, lalu mulai sesi 3–5 menit.',
}

export default async function ChallengeSpeakingPage() {
  const { user, profile } = await getSessionProfile()

  return (
    <ChallengeSpeakingRoom
      student={{
        uid: user?.uid ?? '',
        name: profile?.full_name ?? 'Siswa',
        level: profile?.level ?? 1,
      }}
    />
  )
}
