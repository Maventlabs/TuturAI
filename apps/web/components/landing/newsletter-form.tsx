'use client'

import { useState } from 'react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'submitting') return

    setStatus('submitting')
    setMessage('')

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null

      if (!response.ok) {
        setStatus('error')
        setMessage(payload?.error?.message ?? 'Pendaftaran gagal. Coba lagi.')
        return
      }

      setStatus('success')
      setMessage('Terima kasih! Kabar terbaru akan dikirim ke email kamu.')
      setEmail('')
    } catch {
      setStatus('error')
      setMessage('Tidak dapat terhubung. Periksa koneksi lalu coba lagi.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-sm">
      <label htmlFor="newsletter-email" className="sr-only">
        Alamat email
      </label>
      <div className="flex items-center gap-3 border-b border-primary-foreground/40 pb-2 transition-colors focus-within:border-primary-foreground">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Masukkan email kamu"
          aria-invalid={status === 'error'}
          aria-describedby="newsletter-status"
          disabled={status === 'submitting'}
          className="h-9 w-full min-w-0 bg-transparent text-sm text-primary-foreground placeholder:text-primary-foreground/60 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          aria-label="Daftar ke buletin TuturAI"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-primary-foreground/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground disabled:opacity-60"
        >
          {status === 'submitting' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : status === 'success' ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      <p
        id="newsletter-status"
        role="status"
        aria-live="polite"
        className="mt-3 min-h-4 text-xs leading-relaxed text-pretty"
      >
        {message}
      </p>
    </form>
  )
}
