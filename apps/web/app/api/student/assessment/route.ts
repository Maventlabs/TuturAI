import { NextRequest, NextResponse } from 'next/server'
import { type Assessment, type AssessmentMode } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { AssessmentProviderError, HttpAssessmentProvider } from '@/lib/ai/assessment-provider'
import { processAssessment } from '@/lib/ai/assessment-processing'
import { HttpSttProvider, SttProviderError } from '@/lib/ai/stt-provider'
import { requireRole } from '@/lib/api/auth-guard'
import { getAiEnv } from '@/lib/config/env'
import { getAdminDb } from '@/lib/firebase/admin'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= MAX_AUDIO_BYTES && value.type.startsWith('audio/')
}

async function saveAssessment(assessment: Assessment) {
  const reference = getAdminDb().collection('assessments').doc(assessment.id)
  return getAdminDb().runTransaction(async (transaction) => {
    const existing = await transaction.get(reference)
    if (existing.exists) return existing.data() as Assessment
    transaction.create(reference, assessment)
    return assessment
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const form = await request.formData()
  const sessionId = form.get('sessionId')
  const modeValue = form.get('mode')
  const expectedText = form.get('expectedText')
  const questionId = form.get('questionId')
  const audio = form.get('audio')
  const mode = ['speaking', 'pronunciation', 'conversation'].includes(String(modeValue)) ? modeValue as AssessmentMode : 'speaking'
  if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(sessionId) || !isAudioFile(audio) || (expectedText !== null && typeof expectedText !== 'string') || (questionId !== null && (typeof questionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(questionId)))) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid sessionId and audio file are required'), { status: 400 })
  }

  const config = getAiEnv().ai
  if (!config.stt.baseUrl || !config.llm.baseUrl) {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Speech assessment providers are not configured'), { status: 503 })
  }

  try {
    const requestAudio = { audio: new Uint8Array(await audio.arrayBuffer()), mimeType: audio.type, filename: audio.name }
    const transcription = await new HttpSttProvider({
      baseUrl: config.stt.baseUrl,
      modelId: config.stt.modelId,
      apiKey: config.stt.apiKey,
    }).transcribe(requestAudio)
    const provider = new HttpAssessmentProvider({
      baseUrl: config.llm.baseUrl,
      modelId: config.llm.modelId,
      apiKey: config.llm.apiKey,
    })
    const assessment = await processAssessment({
      provider,
      save: saveAssessment,
      studentId: auth.user.uid,
      sessionId,
      questionId: typeof questionId === 'string' ? questionId : undefined,
       mode,
       request: { ...requestAudio, mode, expectedText: typeof expectedText === 'string' ? expectedText.trim() : undefined, transcript: transcription.text },
    })
    return NextResponse.json({ data: assessment })
  } catch (error) {
    if (error instanceof AssessmentProviderError || error instanceof SttProviderError) {
      const status = error.code === 'CANCELLED' ? 499 : error.retryable ? 503 : 502
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', error.message, { code: error.code, retryable: error.retryable }), { status })
    }
    throw error
  }
}
