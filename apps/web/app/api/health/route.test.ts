import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { requireRole, getAdminDb, getFirebaseAdminEnv, logApiFailure } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getAdminDb: vi.fn(),
  getFirebaseAdminEnv: vi.fn(),
  logApiFailure: vi.fn(),
}))

vi.mock('@/lib/api/auth-guard', () => ({ requireRole }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb }))
vi.mock('@/lib/config/env', () => ({ getFirebaseAdminEnv }))
vi.mock('@/lib/api/observability', async () => ({
  ...(await vi.importActual('@/lib/api/observability')),
  logApiFailure,
}))

import { GET as getLiveness } from './route'
import { GET as getReadiness } from './readiness/route'

describe('health endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFirebaseAdminEnv.mockReturnValue({ projectId: 'real-project-12345' })
    getAdminDb.mockReturnValue({
      collection: () => ({ limit: () => ({ get: vi.fn().mockResolvedValue({ empty: true }) }) }),
    })
  })

  it('exposes process liveness without claiming dependency readiness', async () => {
    const response = await getLiveness(new Request('https://tuturai-apps.netlify.app/api/health', {
      headers: { 'x-request-id': 'health-check-1' },
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.data.status).toBe('ok')
    expect(body.data.requestId).toBe('health-check-1')
    expect(body.data.dependencies).toBe('not_checked')
  })

  it('keeps readiness protected and performs a read-only Firestore probe', async () => {
    requireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-test' } })
    const response = await getReadiness(new Request('https://tuturai-apps.netlify.app/api/health/readiness'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(requireRole).toHaveBeenCalledWith('teacher')
    expect(getAdminDb).toHaveBeenCalledTimes(1)
    expect(body.data.status).toBe('ready')
    expect(body.data.firebase.projectId).toBe('real-project-12345')
    expect(body.data.firebase.firestore).toBe('reachable')
    expect(JSON.stringify(body)).not.toContain('privateKey')
  })

  it('returns 401 without probing Firestore for an unauthenticated caller', async () => {
    requireRole.mockResolvedValue({ ok: false, response: NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 }) })
    const response = await getReadiness(new Request('https://tuturai-apps.netlify.app/api/health/readiness'))

    expect(response.status).toBe(401)
    expect(getAdminDb).not.toHaveBeenCalled()
  })

  it('returns structured 503 when Firebase session initialization fails', async () => {
    requireRole.mockRejectedValue(new Error('private credential data'))
    const response = await getReadiness(new Request('https://tuturai-apps.netlify.app/api/health/readiness'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error.details.code).toBe('FIREBASE_AUTH_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('private credential data')
    expect(logApiFailure).toHaveBeenCalledWith(expect.objectContaining({
      route: '/api/health/readiness',
      status: 503,
      errorCode: 'FIREBASE_AUTH_UNAVAILABLE',
      provider: 'firebase-admin',
    }))
  })

  it('returns a sanitized 503 when the read-only Firestore probe fails', async () => {
    requireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-test' } })
    getAdminDb.mockReturnValue({
      collection: () => ({ limit: () => ({ get: vi.fn().mockRejectedValue(new Error('private-key-content')) }) }),
    })
    const response = await getReadiness(new Request('https://tuturai-apps.netlify.app/api/health/readiness'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error.details.code).toBe('FIRESTORE_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('private-key-content')
    expect(logApiFailure).toHaveBeenCalledWith(expect.objectContaining({
      route: '/api/health/readiness',
      status: 503,
      errorCode: 'FIRESTORE_UNAVAILABLE',
      provider: 'firebase-admin',
    }))
  })
})
