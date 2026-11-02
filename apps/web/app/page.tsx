import { SiteHeader } from '@/components/landing/site-header'
import { Hero } from '@/components/landing/hero'
import { Problem } from '@/components/landing/problem'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Audience } from '@/components/landing/audience'
import { OfflineHardware } from '@/components/landing/offline-hardware'
import { CTA } from '@/components/landing/cta'
import { SiteFooter } from '@/components/landing/site-footer'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
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
