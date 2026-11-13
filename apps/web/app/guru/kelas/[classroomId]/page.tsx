import { ClassroomDetail, type ClassroomTab } from '@/components/guru/classroom-detail'

type PageProps = {
  params: Promise<{ classroomId: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS: ClassroomTab[] = ['stream', 'classwork', 'people', 'grades']

export default async function ClassroomPage({ params, searchParams }: PageProps) {
  const [{ classroomId }, query] = await Promise.all([params, searchParams])
  const initialTab = TABS.find((tab) => tab === query.tab) ?? 'stream'

  return <ClassroomDetail classroomId={classroomId} initialTab={initialTab} />
}
