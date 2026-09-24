import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { getSessionProfile, initialsOf } from '@/lib/auth'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile } = await getSessionProfile()

  if (!user) redirect('/auth/login')
  if (profile?.role === 'teacher') redirect('/guru')

  const name = profile?.full_name ?? user.email ?? 'Siswa'

  return (
    <DashboardShell
      role="student"
      user={{
        name,
        email: user.email ?? '',
        initials: initialsOf(profile?.full_name, 'SW'),
        meta: profile?.class ? `${profile.class}` : 'Siswa',
      }}
      studentStats={{
        level: profile?.level ?? 1,
        xp: profile?.xp ?? 0,
        streak: profile?.streak ?? 0,
      }}
    >
      {children}
    </DashboardShell>
  )
}
