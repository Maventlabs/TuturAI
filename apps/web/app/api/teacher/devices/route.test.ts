import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { createDeviceSecret, hashDeviceSecret, listTeacherDevices, registerDevice } from '@/lib/devices'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/devices', () => ({
  createDeviceSecret: vi.fn(),
  hashDeviceSecret: vi.fn(),
  isValidDeviceId: (value: string) => /^[A-Za-z0-9_-]{4,64}$/.test(value),
  listTeacherDevices: vi.fn(),
  registerDevice: vi.fn(),
}))

const mockedRequireRole = vi.mocked(requireRole)
const mockedList = vi.mocked(listTeacherDevices)
const mockedRegister = vi.mocked(registerDevice)
const mockedCreateSecret = vi.mocked(createDeviceSecret)
const mockedHash = vi.mocked(hashDeviceSecret)

describe('/api/teacher/devices', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects student access', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Forbidden', { status: 403 }) })
    const response = await GET()
    expect(response.status).toBe(403)
  })

  it('returns the one-time device secret only after registration', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedCreateSecret.mockReturnValue('secret-1')
    mockedHash.mockResolvedValue('hash-1')
    mockedRegister.mockResolvedValue({ id: 'esp32-1' } as never)
    const request = new NextRequest('http://localhost/api/teacher/devices', { method: 'POST', body: JSON.stringify({ deviceId: 'esp32-1' }), headers: { 'content-type': 'application/json' } })
    const response = await POST(request)
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ data: { secret: 'secret-1', device: { id: 'esp32-1' } } })
    expect(mockedRegister).toHaveBeenCalledWith({ deviceId: 'esp32-1', teacherId: 'teacher-1', classroomId: null, secretHash: 'hash-1' })
  })

  it('rejects unsafe device ids before touching Firestore', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    const request = new NextRequest('http://localhost/api/teacher/devices', { method: 'POST', body: JSON.stringify({ deviceId: 'bad id' }), headers: { 'content-type': 'application/json' } })
    const response = await POST(request)
    expect(response.status).toBe(400)
    expect(mockedRegister).not.toHaveBeenCalled()
  })
})
