import type { Metadata } from 'next'
import { conversationLevelFromNumber } from '@tuturai/domain'
import { ConversationPartner } from '@/components/student/conversation/conversation-partner'
import { getSessionProfile } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Latihan Bicara AI · TuturAI',
  description:
    'Bicara Bahasa Inggris dengan tutor AI TuturAI. Dapatkan respons natural, koreksi terarah, dan penjelasan dalam Bahasa Indonesia.',
}

export default async function LatihanBicaraAIPage() {
  const { profile } = await getSessionProfile()

  return (
    <ConversationPartner
      initialLevel={conversationLevelFromNumber(profile?.level ?? 1)}
      studentName={profile?.full_name ?? null}
    />
  )
}
