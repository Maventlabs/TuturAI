import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { getSessionProfile, initialsOf } from '@/lib/auth'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile } = await getSessionProfile()

  if (!user) redirect('/auth/login')
  if (profile?.role === 'student') redirect('/siswa')

  const name = profile?.full_name ?? user.email ?? 'Guru'

  return (
    <DashboardShell
      role="teacher"
      user={{
        name,
        email: user.email ?? '',
        initials: initialsOf(profile?.full_name, 'GR'),
        meta: profile?.subject ?? profile?.school ?? 'Guru',
      }}
    >
      {children}
    </DashboardShell>
  )
}
