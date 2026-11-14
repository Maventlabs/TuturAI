import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Inter_Tight, IBM_Plex_Mono, Newsreader } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { BootSplash } from '@/app/boot-splash'
import { AppHydratedMarker } from '@/app/app-hydrated-marker'
import {
  BRAND_COLORS,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from '@/lib/site'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
})
const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin'],
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.primary,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${jakarta.variable} ${interTight.variable} ${plexMono.variable} ${newsreader.variable} bg-background`}
    >
      <head>
        {/* Preload the header mark so it paints without waiting on JS. */}
        <link
          rel="preload"
          as="image"
          href="/brand/logo-icon.png"
          // Mobile data: the header must never wait on a 200 KB asset.
          media="(min-width: 768px)"
        />
      </head>
      <body className="font-sans antialiased">
        <BootSplash />
        <div id="app-root">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <AppHydratedMarker />
          </ThemeProvider>
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
