import { redirect } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth'
import { OnboardingForm } from '@/components/auth/onboarding-form'

export default async function OnboardingPage() {
  const { user, profile } = await getSessionProfile()
  if (!user) redirect('/auth/login')
  if (profile) redirect('/dashboard')
  return <OnboardingForm />
}
