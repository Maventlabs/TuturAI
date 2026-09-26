import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { createContentSecurityPolicy, proxy } from './proxy'

describe('proxy protected page boundary', () => {
  it('redirects anonymous protected page requests to login', () => {
    const response = proxy(new NextRequest('https://tuturai-apps.netlify.app/siswa'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://tuturai-apps.netlify.app/auth/login')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('does not redirect anonymous API requests', () => {
    const response = proxy(new NextRequest('https://tuturai-apps.netlify.app/api/me'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'")
  })

  it('allows protected page requests with a session cookie to reach the server guard', () => {
    const request = new NextRequest('https://tuturai-apps.netlify.app/guru', {
      headers: { cookie: 'tuturai_session=session-value' },
    })

    expect(proxy(request).status).toBe(200)
  })

  it('allows Firebase emulators only in non-production CSP mode', () => {
    expect(createContentSecurityPolicy(true)).toContain('http://127.0.0.1:9099')
    expect(createContentSecurityPolicy(false)).not.toContain('http://127.0.0.1:9099')
  })
})
