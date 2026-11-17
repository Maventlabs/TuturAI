import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { normalizeConversationReply } from '@tuturai/domain'
import { ConversationProviderError, HttpConversationProvider } from '@/lib/ai/conversation-provider'
import { buildConversationMessages, type ConversationMessage } from '@/lib/ai/conversation-prompt'
import { HttpSttProvider, SttProviderError } from '@/lib/ai/stt-provider'
import { requireRole } from '@/lib/api/auth-guard'
import { readJsonBody } from '@/lib/api/request'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getAiEnv } from '@/lib/config/env'
import {
  getConversationSession,
  loadConversationTurns,
  recurringErrorLabels,
  saveConversationTurn,
} from '@/lib/conversation/store'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/

interface TurnInput {
  sessionId: string
  turnId: string
  transcript: string
  audio: { bytes: Uint8Array; mimeType: string; filename: string } | null
}

async function readTurnInput(request: NextRequest): Promise<TurnInput | { error: string }> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const sessionId = String(form.get('sessionId') ?? '')
    const turnId = String(form.get('turnId') ?? '')
    const transcriptValue = form.get('transcript')
    const audioValue = form.get('audio')

    let audio: TurnInput['audio'] = null
    if (audioValue instanceof File && audioValue.size > 0) {
      if (audioValue.size > MAX_AUDIO_BYTES) return { error: 'Rekaman terlalu besar (maksimal 10MB).' }
      if (!audioValue.type.startsWith('audio/')) return { error: 'Format audio tidak didukung.' }
      audio = {
        bytes: new Uint8Array(await audioValue.arrayBuffer()),
        mimeType: audioValue.type,
        filename: audioValue.name || 'speech.webm',
      }
    }

    return {
      sessionId,
      turnId,
      transcript: typeof transcriptValue === 'string' ? transcriptValue.trim() : '',
      audio,
    }
  }

  const body = await readJsonBody(request)
  const value = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  return {
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : '',
    turnId: typeof value.turnId === 'string' ? value.turnId : '',
    transcript: typeof value.transcript === 'string' ? value.transcript.trim() : '',
    audio: null,
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const input = await readTurnInput(request)
  if ('error' in input) {
    return NextResponse.json(apiError('VALIDATION_ERROR', input.error), { status: 400 })
  }
  if (!ID_PATTERN.test(input.sessionId) || !ID_PATTERN.test(input.turnId)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid sessionId and turnId are required'), { status: 400 })
  }
  if (!input.audio && !input.transcript) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Audio or transcript is required'), { status: 400 })
  }

  try {
    await consumeApiRateLimit({ scope: 'student-conversation', subject: auth.user.uid, limit: 20, windowMs: 60_000 })
  } catch (error) {
    const limited = rateLimitResponse(error)
    if (limited) return limited
    throw error
  }

  const session = await getConversationSession(auth.user.uid, input.sessionId)
  if (!session) {
    return NextResponse.json(apiError('NOT_FOUND', 'Conversation session was not found'), { status: 404 })
  }
  if (session.status === 'ended') {
    return NextResponse.json(apiError('CONFLICT', 'This conversation has already ended'), { status: 409 })
  }

  let config: ReturnType<typeof getAiEnv>['ai']
  try {
    config = getAiEnv().ai
  } catch {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Tutor is not configured'), { status: 503 })
  }

  let transcript = input.transcript
  if (input.audio) {
    if (!config.stt.baseUrl) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Speech recognition is not configured'), { status: 503 })
    }
    try {
      const transcription = await new HttpSttProvider({
        baseUrl: config.stt.baseUrl,
        modelId: config.stt.modelId ?? 'whisper',
        apiKey: config.stt.apiKey,
      }).transcribe({
        audio: input.audio.bytes,
        mimeType: input.audio.mimeType,
        filename: input.audio.filename,
        language: 'en',
      })
      transcript = transcription.text
    } catch (error) {
      if (error instanceof SttProviderError) {
        return NextResponse.json(
          apiError('EXTERNAL_SERVICE_ERROR', 'Ucapanmu belum berhasil dikenali. Coba rekam ulang.', {
            code: error.code,
            retryable: error.retryable,
          }),
          { status: error.retryable ? 503 : 422 },
        )
      }
      throw error
    }
  }

  if (!transcript) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'Tidak ada ucapan yang terdeteksi. Coba bicara lebih jelas.', {
        code: 'EMPTY_TRANSCRIPT',
        retryable: true,
      }),
      { status: 422 },
    )
  }

  if (!config.llm.baseUrl) {
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Tutor is not configured'), { status: 503 })
  }

  const history = await loadConversationTurns(auth.user.uid, input.sessionId, 24)
  const messages = buildConversationMessages({
    level: session.level,
    topicLabel: session.topicLabel,
    transcript,
    history: history.map((turn) => ({ speaker: turn.speaker, transcript: turn.transcript })),
    recurringErrors: recurringErrorLabels(history),
  })

  try {
    const provider = new HttpConversationProvider({
      baseUrl: config.llm.baseUrl,
      modelId: config.llm.modelId,
      apiKey: config.llm.apiKey,
    })

    let raw = await provider.complete(messages)
    let reply = normalizeConversationReply(raw)

    if (!reply.success) {
      // One controlled retry: a model that answered in prose instead of the
      // contract gets a single chance to correct itself before the turn fails.
      const retryMessages: ConversationMessage[] = [
        ...messages,
        {
          role: 'user',
          content:
            'Balasan sebelumnya tidak sesuai format. Balas lagi HANYA dengan satu objek JSON valid sesuai skema di system prompt, tanpa markdown.',
        },
      ]
      raw = await provider.complete(retryMessages)
      reply = normalizeConversationReply(raw)
    }

    if (!reply.success) {
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', 'Tutor tidak mengirim balasan yang valid. Coba lagi.', {
          code: 'INVALID_REPLY',
          retryable: true,
          transcript,
        }),
        { status: 502 },
      )
    }

    const saved = await saveConversationTurn({
      studentId: auth.user.uid,
      sessionId: input.sessionId,
      turnId: input.turnId,
      transcript,
      reply: reply.data,
    })
    if (!saved) {
      return NextResponse.json(apiError('NOT_FOUND', 'Conversation session was not found'), { status: 404 })
    }

    return NextResponse.json(
      {
        data: {
          sessionId: input.sessionId,
          turnId: input.turnId,
          transcript,
          reply: reply.data,
          studentTurn: saved.studentTurn,
          tutorTurn: saved.tutorTurn,
        },
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof ConversationProviderError) {
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', error.message, { code: error.code, retryable: error.retryable, transcript }),
        { status: error.code === 'RATE_LIMITED' ? 429 : error.retryable ? 503 : 502 },
      )
    }
    throw error
  }
}
