import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { createDeviceId, createPairingCode, hashPairingCode, issuePairingCode, listTeacherDevices, registerDevice } from '@/lib/devices'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/devices', () => ({
  PAIRING_TTL_MS: 15 * 60 * 1000,
  createDeviceId: vi.fn(),
  createPairingCode: vi.fn(),
  hashPairingCode: vi.fn(),
  isValidDeviceId: (value: string) => /^[A-Za-z0-9_-]{4,64}$/.test(value),
  issuePairingCode: vi.fn(),
  listTeacherDevices: vi.fn(),
  registerDevice: vi.fn(),
  revokeDevice: vi.fn(),
}))

const mockedRequireRole = vi.mocked(requireRole)
const mockedList = vi.mocked(listTeacherDevices)
const mockedRegister = vi.mocked(registerDevice)
const mockedIssue = vi.mocked(issuePairingCode)
const mockedCreateId = vi.mocked(createDeviceId)
const mockedCreateCode = vi.mocked(createPairingCode)
const mockedHashCode = vi.mocked(hashPairingCode)

function post(body: unknown) {
  return new NextRequest('http://localhost/api/teacher/devices', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('/api/teacher/devices', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedCreateCode.mockReturnValue('K7F-2QP')
    mockedHashCode.mockResolvedValue('pairing-hash')
    mockedCreateId.mockReturnValue('esp32-generated')
  })

  it('rejects student access', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Forbidden', { status: 403 }) })
    const response = await GET()
    expect(response.status).toBe(403)
  })

  it('creates a device and returns a pairing code instead of a device secret', async () => {
    mockedRegister.mockResolvedValue({ id: 'esp32-generated' } as never)
    const response = await POST(post({ label: 'Unit kelas XI' }))
    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.data.pairing.code).toBe('K7F-2QP')
    expect(payload.data.device.id).toBe('esp32-generated')
    expect(payload.data.secret).toBeUndefined()
    expect(mockedRegister).toHaveBeenCalledWith({
      deviceId: 'esp32-generated',
      teacherId: 'teacher-1',
      classroomId: null,
      label: 'Unit kelas XI',
      pairingCodeHash: 'pairing-hash',
      pairingExpiresAt: expect.any(Date),
    })
  })

  it('re-issues a pairing code for a device that has not been claimed yet', async () => {
    mockedIssue.mockResolvedValue({ id: 'esp32-1' } as never)
    const response = await POST(post({ deviceId: 'esp32-1' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { device: { id: 'esp32-1' }, pairing: { code: 'K7F-2QP' } } })
    expect(mockedRegister).not.toHaveBeenCalled()
  })

  it('registers a teacher-supplied id when the device does not exist yet', async () => {
    mockedIssue.mockRejectedValue(new Error('DEVICE_NOT_FOUND'))
    mockedRegister.mockResolvedValue({ id: 'esp32-1' } as never)
    const response = await POST(post({ deviceId: 'esp32-1' }))
    expect(response.status).toBe(201)
    expect(mockedRegister).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'esp32-1' }))
  })

  it('refuses to re-pair a device that already holds a credential', async () => {
    mockedIssue.mockRejectedValue(new Error('DEVICE_ALREADY_PAIRED'))
    const response = await POST(post({ deviceId: 'esp32-1' }))
    expect(response.status).toBe(409)
  })

  it('rejects unsafe device ids before touching Firestore', async () => {
    const response = await POST(post({ deviceId: 'bad id' }))
    expect(response.status).toBe(400)
    expect(mockedRegister).not.toHaveBeenCalled()
    expect(mockedIssue).not.toHaveBeenCalled()
  })

  it('returns the teacher device list', async () => {
    mockedList.mockResolvedValue([{ id: 'esp32-1' }] as never)
    const response = await GET()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [{ id: 'esp32-1' }] })
  })
})
