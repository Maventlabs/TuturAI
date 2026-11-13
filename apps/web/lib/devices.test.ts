import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_BUCKETS,
  ONLINE_WINDOW_MS,
  buildActivitySeries,
  createDeviceSecret,
  createPairingCode,
  deriveDeviceStatus,
  hashDeviceSecret,
  hashPairingCode,
  isValidDeviceId,
  normalizePairingCode,
  parseDeviceHeartbeat,
  verifyDeviceSecret,
} from './devices'

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

  it('accepts an optional hardware id on the heartbeat', () => {
    expect(parseDeviceHeartbeat({ hardwareId: 'A0:B1:C2:D3:E4:F5' })).toEqual({ hardwareId: 'A0:B1:C2:D3:E4:F5' })
    expect(parseDeviceHeartbeat({ hardwareId: '' })).toBeNull()
  })
})

describe('pairing codes', () => {
  it('issues a readable code without ambiguous characters', () => {
    for (let index = 0; index < 50; index += 1) {
      const code = createPairingCode()
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/)
      expect(normalizePairingCode(code)).toHaveLength(6)
    }
  })

  it('normalises what a person actually types on a keypad', () => {
    expect(normalizePairingCode('k7f-2qp')).toBe('K7F2QP')
    expect(normalizePairingCode(' K7F 2QP ')).toBe('K7F2QP')
    expect(normalizePairingCode('K7F2Q')).toBeNull()
    expect(normalizePairingCode('K7F2QPX')).toBeNull()
    expect(normalizePairingCode('K7F-2Q0')).toBeNull()
  })

  it('hashes the normalised form so formatting never changes the lookup', async () => {
    await expect(hashPairingCode('k7f-2qp')).resolves.toBe(await hashPairingCode('K7F2QP'))
    await expect(hashPairingCode('K7F2QP')).resolves.not.toBe('K7F2QP')
  })
})

describe('derived device status', () => {
  const now = Date.parse('2026-11-13T10:00:00.000Z')

  it('reports a registered device without a credential as waiting for pairing', () => {
    expect(deriveDeviceStatus({ credentialHash: null, lastSyncAt: null }, now)).toBe('pairing')
  })

  it('reports online only inside the heartbeat window', () => {
    const fresh = new Date(now - ONLINE_WINDOW_MS + 1000).toISOString()
    const stale = new Date(now - ONLINE_WINDOW_MS - 1000).toISOString()
    expect(deriveDeviceStatus({ credentialHash: 'hash', lastSyncAt: fresh }, now)).toBe('online')
    expect(deriveDeviceStatus({ credentialHash: 'hash', lastSyncAt: stale }, now)).toBe('offline')
  })

  it('never reports a revoked device as online', () => {
    const fresh = new Date(now - 1000).toISOString()
    expect(deriveDeviceStatus({ credentialHash: 'hash', lastSyncAt: fresh, revokedAt: fresh }, now)).toBe('offline')
  })
})

describe('activity series', () => {
  it('always returns a fixed 24 bucket window ending at the current hour', () => {
    const now = new Date('2026-11-13T10:42:00.000Z')
    const series = buildActivitySeries({ '2026111310': 7, '2026111309': 3, '2026010100': 99 }, now)
    expect(series).toHaveLength(ACTIVITY_BUCKETS)
    expect(series[ACTIVITY_BUCKETS - 1]).toEqual({ hour: '2026-11-13T10:00:00.000Z', count: 7 })
    expect(series[ACTIVITY_BUCKETS - 2]).toEqual({ hour: '2026-11-13T09:00:00.000Z', count: 3 })
    expect(series.reduce((total, bucket) => total + bucket.count, 0)).toBe(10)
  })

  it('tolerates a missing or malformed activity map', () => {
    const series = buildActivitySeries(undefined, new Date('2026-11-13T10:00:00.000Z'))
    expect(series).toHaveLength(ACTIVITY_BUCKETS)
    expect(series.every((bucket) => bucket.count === 0)).toBe(true)
  })
})
