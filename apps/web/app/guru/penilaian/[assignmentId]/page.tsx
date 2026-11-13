import { StudentWorkTable } from '@/components/guru/student-work-table'

export default async function AssignmentSubmissionsPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const { assignmentId } = await params
  return <StudentWorkTable assignmentId={assignmentId} />
}
