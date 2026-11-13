import { ClassroomDetail } from '@/components/guru/classroom-detail'

type PageProps = {
  params: Promise<{ classroomId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ClassroomPage({ params, searchParams }: PageProps) {
  const [{ classroomId }, query] = await Promise.all([params, searchParams])
  const initialTab = query.tab === 'classwork' || query.tab === 'people' ? query.tab : 'stream'

  return <ClassroomDetail classroomId={classroomId} initialTab={initialTab} />
}
