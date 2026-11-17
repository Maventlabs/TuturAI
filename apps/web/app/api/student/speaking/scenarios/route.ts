import { NextRequest, NextResponse } from 'next/server'
import {
  SPEAKING_PRACTICE_MODES,
  SPEAKING_SCENARIOS,
  SPEAKING_SESSION_TYPES,
  isSpeakingPracticeMode,
  speakingScenarioBrief,
} from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getRequestId } from '@/lib/api/observability'

/**
 * Scenario catalog for the selected practice mode. Free Practice receives the
 * brief with empty hint arrays, so guided material never reaches a client that
 * must not display it.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const requestId = getRequestId(request)

  const modeParam = request.nextUrl.searchParams.get('mode') ?? 'guided'
  if (!isSpeakingPracticeMode(modeParam)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'mode must be guided or free', { requestId }), { status: 400 })
  }

  return NextResponse.json(
    {
      data: {
        mode: modeParam,
        modes: Object.values(SPEAKING_PRACTICE_MODES),
        sessionTypes: Object.values(SPEAKING_SESSION_TYPES),
        scenarios: SPEAKING_SCENARIOS.map((scenario) => speakingScenarioBrief(scenario, modeParam)),
      },
    },
    { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
  )
}
