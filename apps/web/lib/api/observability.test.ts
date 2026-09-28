import { describe, expect, it, vi } from 'vitest'
import { getRequestId, logApiFailure } from './observability'

describe('API observability', () => {
  it('accepts a bounded request id or creates one', () => {
    const request = new Request('https://example.test/api/health', { headers: { 'x-request-id': 'e2e-request-1' } })
    expect(getRequestId(request)).toBe('e2e-request-1')
    expect(getRequestId(new Request('https://example.test/api/health'))).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('logs only the allowlisted structured fields', () => {
    const sink = vi.fn()
    logApiFailure({
      requestId: 'request-1',
      route: '/api/auth/session',
      status: 503,
      errorCode: 'FIREBASE_SERVICE_UNAVAILABLE',
      provider: 'firebase-admin',
      durationMs: 9.7,
      accessToken: 'never-log-this',
    } as never, sink)

    expect(JSON.parse(sink.mock.calls[0][0])).toEqual({
      event: 'api_failure',
      requestId: 'request-1',
      route: '/api/auth/session',
      status: 503,
      errorCode: 'FIREBASE_SERVICE_UNAVAILABLE',
      provider: 'firebase-admin',
      durationMs: 10,
    })
    expect(sink.mock.calls[0][0]).not.toContain('never-log-this')
  })
})
