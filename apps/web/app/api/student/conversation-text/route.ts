import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { assessConversationText, validateConversationTextInput } from '@/lib/conversation-text'

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const validation = validateConversationTextInput(await request.json())
  if (!validation.success) return NextResponse.json(apiError('VALIDATION_ERROR', validation.message), { status: 400 })
  try {
    return NextResponse.json({ data: await assessConversationText(auth.user.uid, validation.data) }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'QUESTION_NOT_FOUND') return NextResponse.json(apiError('NOT_FOUND', 'Conversation scenario not found'), { status: 404 })
    throw error
  }
}
