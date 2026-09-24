import { describe, expect, it } from 'vitest'
import { createDeviceSecret, hashDeviceSecret, isValidDeviceId, verifyDeviceSecret } from './devices'

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
})
