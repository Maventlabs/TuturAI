import { describe, expect, it } from 'vitest'
import { createDeviceSecret, hashDeviceSecret, isValidDeviceId, parseDeviceHeartbeat, verifyDeviceSecret } from './devices'

describe('device credential model', () => {
  it('accepts bounded device ids and rejects unsafe values', () => {
    expect(isValidDeviceId('esp32-class-01')).toBe(true)
    expect(isValidDeviceId('ab')).toBe(false)
    expect(isValidDeviceId('device with spaces')).toBe(false)
    expect(isValidDeviceId('a'.repeat(65))).toBe(false)
  })

  it('creates a secret that can be verified but is never stored in plaintext', async () => {
    const secret = createDeviceSecret()
    const hash = await hashDeviceSecret(secret)
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hash).not.toContain(secret)
    await expect(verifyDeviceSecret(secret, hash)).resolves.toBe(true)
    await expect(verifyDeviceSecret('wrong-secret', hash)).resolves.toBe(false)
  })

  it('accepts only bounded numeric telemetry and a short firmware string', () => {
    expect(parseDeviceHeartbeat({ battery: 82, signal: 67, firmware: '1.2.3' })).toEqual({ battery: 82, signal: 67, firmware: '1.2.3' })
    expect(parseDeviceHeartbeat({})).toEqual({})
    expect(parseDeviceHeartbeat({ battery: '82' })).toBeNull()
    expect(parseDeviceHeartbeat({ signal: 101 })).toBeNull()
    expect(parseDeviceHeartbeat({ firmware: 'x'.repeat(65) })).toBeNull()
    expect(parseDeviceHeartbeat({ command: 'unlock' })).toBeNull()
    expect(parseDeviceHeartbeat(null)).toBeNull()
  })
})
