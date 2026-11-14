import { redirect } from 'next/navigation'

// Penugasan is no longer a top-level destination: it lives inside a classroom's
// Classwork tab, so the old route forwards there instead of 404-ing.
export default function TeacherAssignmentsPage() {
  redirect('/guru/kelas')
}
