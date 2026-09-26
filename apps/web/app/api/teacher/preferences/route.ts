import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { apiError, validateTeacherPreferencesInput } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'
import { readJsonBody } from '@/lib/api/request'

const defaults = { submissions: true, lowScore: true, weekly: false, device: true }
type TeacherProfile = { teacherPreferences?: typeof defaults }

export async function GET() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const snapshot = await getAdminDb().collection('users').doc(auth.user.uid).get()
  const profile = snapshot.data() as TeacherProfile | undefined
  return NextResponse.json({ data: profile?.teacherPreferences ?? defaults })
}

export async function PATCH(request: Request) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const validation = validateTeacherPreferencesInput(await readJsonBody(request))
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid teacher preferences', validation.issues), { status: 400 })
  }

  try {
    const ref = getAdminDb().collection('users').doc(auth.user.uid)
    await ref.update({ teacherPreferences: validation.data, updatedAt: FieldValue.serverTimestamp() })
    const snapshot = await ref.get()
    return NextResponse.json({ data: snapshot.data()?.teacherPreferences ?? validation.data })
  } catch {
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Unable to update teacher preferences'), { status: 500 })
  }
}
