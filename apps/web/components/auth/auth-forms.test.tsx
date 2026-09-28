import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

import { LoginForm } from './login-form'
import { SignUpForm } from './sign-up-form'

describe('auth form placeholders and accessible names', () => {
  it('keeps login labels and uses contextual email/password placeholders', () => {
    const markup = renderToStaticMarkup(createElement(LoginForm))
    expect(markup).toMatch(/<label[^>]*for="email"[^>]*>Email<\/label>/)
    expect(markup).toContain('type="email"')
    expect(markup).toContain('autoComplete="email"')
    expect(markup).toContain('placeholder="nama@sekolah.id"')
    expect(markup).toMatch(/<label[^>]*for="password"[^>]*>Kata Sandi<\/label>/)
    expect(markup).toContain('autoComplete="current-password"')
    expect(markup).toContain('placeholder="Masukkan kata sandi"')
  })

  it('keeps signup labels, semantic autocomplete, and natural placeholders', () => {
    const markup = renderToStaticMarkup(createElement(SignUpForm))
    expect(markup).toMatch(/<label[^>]*for="fullName"[^>]*>Nama Lengkap<\/label>/)
    expect(markup).toContain('autoComplete="name"')
    expect(markup).toContain('placeholder="Nama lengkap"')
    expect(markup).toMatch(/<label[^>]*for="email"[^>]*>Email<\/label>/)
    expect(markup).toContain('placeholder="nama@sekolah.id"')
    expect(markup).toMatch(/<label[^>]*for="school"[^>]*>Asal Sekolah<\/label>/)
    expect(markup).toContain('autoComplete="organization"')
    expect(markup).toContain('placeholder="Nama sekolah"')
    expect(markup).toMatch(/<label[^>]*for="extra"[^>]*>Kelas<\/label>/)
    expect(markup).toContain('placeholder="Contoh: XI IPA 2"')
    expect(markup).toContain('type="password"')
    expect(markup).toContain('autoComplete="new-password"')
    expect(markup).toContain('placeholder="Buat kata sandi"')
  })
})
