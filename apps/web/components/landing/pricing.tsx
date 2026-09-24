'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Siswa',
    price: 'Gratis',
    period: 'selamanya',
    desc: 'Untuk belajar mandiri setiap hari.',
    features: [
      'Sesi speaking AI harian',
      'Feedback pronunciation & grammar',
      'Streak, XP, dan badge',
      'Akses materi dasar',
    ],
    cta: 'Mulai Gratis',
    highlight: false,
  },
  {
    name: 'Kelas',
    price: 'Rp25rb',
    period: '/siswa per bulan',
    desc: 'Untuk guru dan kelas yang ingin pantauan lengkap.',
    features: [
      'Semua fitur Siswa',
      'Dashboard analitik guru',
      'Penugasan & pemantauan kelas',
      'Laporan progres mingguan',
      'Prioritas dukungan',
    ],
    cta: 'Coba untuk Kelas',
    highlight: true,
  },
  {
    name: 'Sekolah',
    price: 'Custom',
    period: 'hubungi kami',
    desc: 'Untuk implementasi tingkat sekolah/yayasan.',
    features: [
      'Semua fitur Kelas',
      'Manajemen multi-kelas',
      'Integrasi data sekolah',
      'Pelatihan guru & onboarding',
    ],
    cta: 'Hubungi Tim',
    highlight: false,
  },
]

export function Pricing() {
  return (
    <section id="harga" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Harga
          </p>
          <h2 className="mt-3 text-balance font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Mulai gratis, tingkatkan saat siap
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Transparan dan ramah anggaran sekolah Indonesia.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
            >
              <Card
                className={`relative flex h-full flex-col p-7 ${
                  plan.highlight
                    ? 'border-primary shadow-lg ring-1 ring-primary'
                    : 'border-border'
                }`}
              >
                {plan.highlight && (
                  <Badge className="absolute -top-3 left-7 bg-primary text-primary-foreground hover:bg-primary">
                    Paling Populer
                  </Badge>
                )}
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-heading text-3xl font-extrabold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 flex-none text-primary" />
                      <span className="text-sm text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-7 w-full"
                  variant={plan.highlight ? 'default' : 'outline'}
                  asChild
                >
                  <Link href="/auth/sign-up">{plan.cta}</Link>
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
