import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { getAdminDb } from '@/lib/firebase/admin'
import { getDevice, updateDeviceHeartbeat, verifyDeviceSecret } from '@/lib/devices'

vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/devices', () => ({ getDevice: vi.fn(), updateDeviceHeartbeat: vi.fn(), verifyDeviceSecret: vi.fn() }))

const mockedDb = vi.mocked(getAdminDb)
const mockedGetDevice = vi.mocked(getDevice)
const mockedUpdate = vi.mocked(updateDeviceHeartbeat)
const mockedVerify = vi.mocked(verifyDeviceSecret)

function request(body: unknown, secret = 'secret') {
  return new NextRequest('http://localhost/api/device/heartbeat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-id': 'esp32-1', 'x-device-secret': secret }, body: JSON.stringify(body) })
}

describe('/api/device/heartbeat', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedGetDevice.mockResolvedValue({ id: 'esp32-1' } as never)
    mockedVerify.mockResolvedValue(true)
    mockedDb.mockReturnValue({ collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ credentialHash: 'hash' }) }) }) }) } as never)
  })

  it('rejects invalid credentials', async () => {
    mockedVerify.mockResolvedValue(false)
    const response = await POST(request({ battery: 90 }))
    expect(response.status).toBe(401)
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('accepts bounded telemetry and updates the durable device record', async () => {
    const response = await POST(request({ battery: 90, signal: 75, firmware: '1.0.0' }))
    expect(response.status).toBe(200)
    expect(mockedUpdate).toHaveBeenCalledWith('esp32-1', { battery: 90, signal: 75, firmware: '1.0.0' })
  })

  it('rejects telemetry outside the device contract', async () => {
    const response = await POST(request({ battery: 101 }))
    expect(response.status).toBe(400)
    expect(mockedUpdate).not.toHaveBeenCalled()
  })
})
