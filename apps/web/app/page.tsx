import Script from 'next/script'
import { SiteHeader } from '@/components/landing/site-header'
import { Hero } from '@/components/landing/hero'
import { Problem } from '@/components/landing/problem'
import { Features } from '@/components/landing/features'
import { OfflineHardware } from '@/components/landing/offline-hardware'
import { Pricing } from '@/components/landing/pricing'
import { Testimonials } from '@/components/landing/testimonials'
import { FAQ } from '@/components/landing/faq'
import { CTA } from '@/components/landing/cta'
import { SiteFooter } from '@/components/landing/site-footer'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TuturAI',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web, ESP32-S3',
  description:
    'Platform latihan speaking bahasa Inggris berbasis AI untuk siswa SMA/SMK Indonesia. Feedback lima dimensi, gamifikasi, dan dashboard analitik untuk guru, dengan mode offline.',
  url: 'https://tuturai.id',
  inLanguage: 'id',
  audience: {
    '@type': 'EducationalAudience',
    educationalRole: ['student', 'teacher'],
  },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
  featureList: [
    'Partner speaking AI',
    'Feedback lima dimensi instan',
    'Dashboard analitik guru',
    'Mode offline PWA dan perangkat ESP32-S3',
  ],
}

export default function HomePage() {
  return (
    <div className="theme-light flex min-h-screen flex-col bg-background text-foreground">
      <Script
        id="ld-json-software-application"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Problem />
        <Features />
        <OfflineHardware />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <SiteFooter />
    </div>
  )
}
