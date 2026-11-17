import { redirect } from 'next/navigation'
import { ServiceUnavailable } from '@/components/system/service-unavailable'
import { getSessionProfile } from '@/lib/auth'

export default async function DashboardRouter() {
  const { user, profile, profileUnavailable } = await getSessionProfile()

  if (!user) redirect('/auth/login')
  if (profileUnavailable) return <ServiceUnavailable />
  if (!profile) redirect('/onboarding')
  redirect(profile.role === 'teacher' ? '/guru' : '/siswa')
}
