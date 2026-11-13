import { SubmissionDetail } from '@/components/guru/submission-detail'

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string; studentId: string }>
}) {
  const { assignmentId, studentId } = await params
  return <SubmissionDetail assignmentId={assignmentId} studentId={studentId} />
}
