import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { claimDevice } from '@/lib/devices'

vi.mock('@/lib/devices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/devices')>()
  return { ...actual, claimDevice: vi.fn() }
})

const mockedClaim = vi.mocked(claimDevice)

function request(body: unknown) {
  return new NextRequest('http://localhost/api/device/pair', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/device/pair', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects a malformed pairing code before touching Firestore', async () => {
    const response = await POST(request({ code: 'abc' }))
    expect(response.status).toBe(400)
    expect(mockedClaim).not.toHaveBeenCalled()
  })

  it('rejects an unknown pairing code', async () => {
    mockedClaim.mockResolvedValue({ ok: false, reason: 'invalid' })
    const response = await POST(request({ code: 'K7F-2QP' }))
    expect(response.status).toBe(401)
  })

  it('reports an expired pairing code distinctly so the teacher can re-issue', async () => {
    mockedClaim.mockResolvedValue({ ok: false, reason: 'expired' })
    const response = await POST(request({ code: 'K7F-2QP' }))
    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })

  it('returns the device id and secret to the claiming device', async () => {
    mockedClaim.mockResolvedValue({ ok: true, deviceId: 'esp32-1', secret: 'device-secret' })
    const response = await POST(request({ code: 'k7f 2qp', hardwareId: 'A0:B1:C2:D3:E4:F5', firmware: '1.4.2' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: { deviceId: 'esp32-1', secret: 'device-secret', heartbeatIntervalSeconds: 30, heartbeatUrl: '/api/device/heartbeat' },
    })
    expect(mockedClaim).toHaveBeenCalledWith({ code: 'k7f 2qp', hardwareId: 'A0:B1:C2:D3:E4:F5', firmware: '1.4.2' })
  })
})
