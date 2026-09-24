import { redirect } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth'

export default async function DashboardRouter() {
  const { user, profile } = await getSessionProfile()

  if (!user) redirect('/auth/login')
  if (!profile) redirect('/onboarding')
  redirect(profile?.role === 'teacher' ? '/guru' : '/siswa')
}
