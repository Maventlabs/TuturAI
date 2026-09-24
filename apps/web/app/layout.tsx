import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Inter, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
})
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'TuturAI — Latihan Speaking Bahasa Inggris dengan AI',
  description:
    'Platform latihan speaking Bahasa Inggris berbasis AI untuk siswa SMA/SMK Indonesia. Feedback instan, gamifikasi, dan dashboard analitik untuk guru.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7fbfc' },
    { media: '(prefers-color-scheme: dark)', color: '#16202b' },
  ],
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
      className={`${jakarta.variable} ${inter.variable} ${geistMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
