'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Cpu,
  FileText,
  GraduationCap,
  Headphones,
  Mail,
  Server,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

type Billing = 'bulanan' | 'tahunan'

type Plan = {
  id: string
  name: string
  tagline: string
  price: Record<Billing, string>
  unit: string
  note: Record<Billing, string>
  cta: string
  href: string
  tone: 'light' | 'primary' | 'dark'
  featured?: boolean
  features: string[]
  extras: { icon: LucideIcon; label: string }[]
}

const plans: Plan[] = [
  {
    id: 'gratis',
    name: 'Gratis',
    tagline: 'Untuk siswa yang ingin mencoba dulu.',
    price: { bulanan: 'Rp0', tahunan: 'Rp0' },
    unit: 'selamanya',
    note: { bulanan: 'Tanpa kartu kredit', tahunan: 'Tanpa kartu kredit' },
    cta: 'Mulai gratis',
    href: '/auth/sign-up',
    tone: 'light',
    features: [
      'Partner speaking AI, 3 sesi per hari',
      'Feedback grammar dan vocabulary',
      'Kuis per kata dan analisis paragraf',
      'Progres, streak, dan badge',
      'Leaderboard kelas',
      'Mode offline terbatas',
    ],
    extras: [
      { icon: Clock, label: 'Riwayat latihan 7 hari' },
      { icon: FileText, label: 'Ringkasan hasil per sesi' },
      { icon: Users, label: 'Dukungan komunitas' },
    ],
  },
  {
    id: 'sekolah',
    name: 'School Plan',
    tagline: 'Semua yang ada di paket Gratis, plus:',
    price: { bulanan: 'Rp15.000', tahunan: 'Rp12.000' },
    unit: 'per siswa / bulan',
    note: { bulanan: 'Ditagih per bulan', tahunan: 'Ditagih per tahun, hemat 20%' },
    cta: 'Ajukan School Plan',
    href: '/auth/sign-up',
    tone: 'primary',
    featured: true,
    features: [
      'Sesi speaking tanpa batas',
      'Feedback lima dimensi termasuk pronunciation',
      'Dashboard analitik guru',
      'Penugasan dan penilaian otomatis',
      'Voice profile guru (OmniVoice)',
      'Laporan PDF per kelas',
    ],
    extras: [
      { icon: Cpu, label: 'Monitoring perangkat ESP32-S3' },
      { icon: GraduationCap, label: 'Onboarding guru satu sesi' },
      { icon: Mail, label: 'Dukungan email 1x24 jam' },
      { icon: ShieldCheck, label: 'Data siswa terisolasi per sekolah' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Semua yang ada di School Plan, plus:',
    price: { bulanan: 'Custom', tahunan: 'Custom' },
    unit: 'sesuai kebutuhan',
    note: { bulanan: 'Kontrak tahunan', tahunan: 'Kontrak multi-tahun' },
    cta: 'Hubungi kami',
    href: 'mailto:hello@tuturai.id?subject=Enterprise%20Plan',
    tone: 'dark',
    features: [
      'Multi-sekolah dan multi-kelas',
      'SSO dan manajemen peran',
      'Kuota perangkat tanpa batas',
      'SLA uptime 99,5%',
      'Pendampingan kurikulum',
      'Integrasi Dapodik',
    ],
    extras: [
      { icon: UserCog, label: 'Account manager khusus' },
      { icon: BookOpen, label: 'Pelatihan guru on-site' },
      { icon: Server, label: 'Opsi deployment on-premise' },
      { icon: Headphones, label: 'Dukungan prioritas 24/7' },
    ],
  },
]

const priceTone: Record<Plan['tone'], string> = {
  light: 'bg-secondary text-foreground',
  primary: 'bg-primary text-primary-foreground',
  dark: 'bg-ink-deep text-background',
}

export function Pricing() {
  const [billing, setBilling] = useState<Billing>('bulanan')

  return (
    <section id="harga" className="scroll-mt-24 bg-secondary px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto max-w-2xl text-center">
          <GSAPReveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Paket
            </p>
          </GSAPReveal>
          <GSAPLines>
            <h2 className="mt-4 font-heading text-3xl font-bold leading-[1.08] tracking-[-0.02em] text-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Berapa biayanya?
              </span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.1}>
            <p className="mt-5 text-muted-foreground text-pretty">
              Pilih paket yang sesuai tujuanmu. Bisa dijeda, diubah, atau diperpanjang kapan saja.
            </p>
          </GSAPReveal>
        </div>

        <GSAPReveal delay={0.15} className="mt-10 flex justify-center">
          <div
            role="group"
            aria-label="Periode penagihan"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1"
          >
            {(['bulanan', 'tahunan'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setBilling(option)}
                aria-pressed={billing === option}
                className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors ${
                  billing === option
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option}
                {option === 'tahunan' && (
                  <span className="font-mono text-[10px] font-normal opacity-70">-20%</span>
                )}
              </button>
            ))}
          </div>
        </GSAPReveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <GSAPReveal key={plan.id} delay={index * 0.06} className="h-full">
              <article
                className={`flex h-full flex-col rounded-sm border bg-card p-6 sm:p-7 ${
                  plan.featured ? 'border-primary ring-1 ring-primary' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading text-lg font-bold tracking-[-0.01em] text-foreground">
                    {plan.name}
                  </h3>
                  {plan.featured && (
                    <span className="shrink-0 rounded-sm bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground">
                      Paling populer
                    </span>
                  )}
                </div>

                <div className="mt-6 flex items-end justify-between gap-3">
                  <div className={`rounded-sm px-3.5 py-2.5 ${priceTone[plan.tone]}`}>
                    <span className="font-heading text-3xl font-bold tracking-[-0.02em]">
                      {plan.price[billing]}
                    </span>
                    <span className="ml-1.5 font-mono text-[10px] opacity-80">{plan.unit}</span>
                  </div>
                  <p className="max-w-[11ch] pb-1 text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-muted-foreground">
                    {plan.note[billing]}
                  </p>
                </div>

                <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Fitur
                </p>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">{plan.tagline}</p>

                <ul className="mt-4 flex flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                      </span>
                      <span className="text-sm leading-relaxed text-foreground text-pretty">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <ul className="mt-5 flex flex-col gap-2.5 border-t border-border pt-5">
                  {plan.extras.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="text-sm leading-relaxed text-muted-foreground text-pretty">
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-7">
                  <Link
                    href={plan.href}
                    className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99] ${
                      plan.featured
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-foreground/20 text-foreground hover:border-foreground/40'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </article>
            </GSAPReveal>
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-[11px] text-muted-foreground">
          Harga dalam Rupiah, belum termasuk PPN. Pembayaran diproses lewat gateway resmi.
        </p>
      </div>
    </section>
  )
}
