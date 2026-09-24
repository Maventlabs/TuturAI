'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { MailCheck, RefreshCw, Loader2, Info } from 'lucide-react'
import { sendEmailVerification } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { cn } from '@/lib/utils'

const COOLDOWN_SECONDS = 60

export default function SignUpSuccessPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingEmail')
    if (stored) setEmail(stored)
  }, [])

  // Countdown ticker
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleResend = useCallback(async () => {
    if (!email || cooldown > 0 || resending) return
    setResending(true)
    setResendStatus('idle')
    setResendError(null)

    const user = getFirebaseAuth().currentUser
    if (!user) {
      setResendError('Sesi akun tidak tersedia. Silakan masuk kembali.')
      setResendStatus('error')
    } else {
      try {
        await sendEmailVerification(user)
        setResendStatus('success')
        setCooldown(COOLDOWN_SECONDS)
      } catch {
        setResendError('Email verifikasi belum dapat dikirim. Coba lagi nanti.')
        setResendStatus('error')
      }
    }
    setResending(false)
  }, [email, cooldown, resending])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        {/* Icon */}
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
          <MailCheck className="h-8 w-8" />
        </span>

        <h1 className="mt-6 font-heading text-2xl font-extrabold tracking-tight text-foreground">
          Cek email kamu
        </h1>

        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          Kami telah mengirim tautan konfirmasi ke{' '}
          {email ? (
            <span className="font-semibold text-foreground">{email}</span>
          ) : (
            'alamat emailmu'
          )}
          . Klik tautan tersebut untuk mengaktifkan akun dan mulai berlatih.
        </p>

        <p className="mt-2 text-pretty text-xs leading-relaxed text-muted-foreground/70">
          Periksa juga folder <span className="font-medium">spam</span> atau <span className="font-medium">promotions</span> jika tidak ada di kotak masuk.
        </p>

        {/* Resend section */}
        {email && (
          <div className="mt-6 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-2"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
            >
              {resending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className={cn('h-4 w-4', cooldown > 0 && 'opacity-40')} />
              )}
              {resending
                ? 'Mengirim...'
                : cooldown > 0
                  ? `Kirim ulang dalam ${cooldown}d`
                  : 'Kirim ulang email konfirmasi'}
            </Button>

            {resendStatus === 'success' && (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                Email konfirmasi berhasil dikirim ulang. Cek kotak masukmu.
              </p>
            )}

            {resendStatus === 'error' && resendError && (
              <div className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-left text-sm text-destructive">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{resendError}</p>
              </div>
            )}
          </div>
        )}

        {/* Custom SMTP tip */}
        <div className="mt-6 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Kenapa email lambat / tidak terkirim?</p>
          <p className="mt-1">
            Supabase free tier membatasi pengiriman email menjadi <span className="font-medium text-foreground">2 email per jam</span> menggunakan SMTP bawaan.
            Untuk menghilangkan batas ini, atur <span className="font-medium text-foreground">Custom SMTP</span> di:
          </p>
          <p className="mt-1 font-mono text-[11px]">
            Supabase Dashboard → Project Settings → Auth → SMTP Settings
          </p>
          <p className="mt-1">
            Gunakan provider gratis seperti <span className="font-medium text-foreground">Resend</span>, <span className="font-medium text-foreground">SendGrid</span>, atau <span className="font-medium text-foreground">Brevo</span>.
          </p>
        </div>

        <Button className="mt-6 w-full" variant="ghost" asChild>
          <Link href="/auth/login">Sudah konfirmasi? Masuk di sini</Link>
        </Button>
      </div>
    </main>
  )
}
