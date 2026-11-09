import { SiteHeader } from '@/components/landing/site-header'
import { Hero } from '@/components/landing/hero'
import { ProofMarquee } from '@/components/landing/proof-marquee'
import { Problem } from '@/components/landing/problem'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Audience } from '@/components/landing/audience'
import { OfflineHardware } from '@/components/landing/offline-hardware'
import { CTA } from '@/components/landing/cta'
import { SiteFooter } from '@/components/landing/site-footer'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TuturAI',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  description:
    'Platform latihan speaking Bahasa Inggris berbasis AI untuk siswa SMA/SMK Indonesia dengan feedback 5 dimensi dan dashboard analitik untuk guru.',
  url: 'https://tuturai.id',
  inLanguage: 'id',
  audience: {
    '@type': 'EducationalAudience',
    educationalRole: ['student', 'teacher'],
  },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
  featureList: [
    'Partner speaking AI',
    'Feedback 5 dimensi instan',
    'Dashboard analitik guru',
    'Offline-first PWA dan perangkat ESP32-S3',
  ],
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ProofMarquee />
        <Problem />
        <Features />
        <HowItWorks />
        <Audience />
        <OfflineHardware />
        <CTA />
      </main>
      <SiteFooter />
    </div>
  )
}
