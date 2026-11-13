import { ClassroomProvider } from '@/components/guru/classroom-context'
import { ClassroomHeader } from '@/components/guru/classroom-header'

export default async function ClassroomLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ classroomId: string }>
}) {
  const { classroomId } = await params

  return (
    <ClassroomProvider classroomId={classroomId}>
      <ClassroomHeader />
      <div className="mx-auto max-w-6xl pt-6">{children}</div>
    </ClassroomProvider>
  )
}
