import { describe, expect, it } from 'vitest'
import health from '../netlify/health'

describe('health function', () => {
  it('returns an operational function response', async () => {
    const response = await health()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ service: 'tuturai-functions', status: 'ok' })
  })
})
