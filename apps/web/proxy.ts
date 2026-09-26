import { NextResponse, type NextRequest } from 'next/server'

export function createContentSecurityPolicy(includeLocalEmulators = process.env.NODE_ENV !== 'production') {
  const localEmulatorSources = includeLocalEmulators ? ' http://localhost:9099 http://127.0.0.1:9099 http://localhost:8080 http://127.0.0.1:8080' : ''
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "media-src 'self' blob:",
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://accounts.google.com wss://*.firebaseio.com${localEmulatorSources}`,
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
  ].join('; ')
}

export const CONTENT_SECURITY_POLICY = createContentSecurityPolicy()

const SESSION_COOKIE = 'tuturai_session'
const PROTECTED_PAGE_PREFIXES = ['/dashboard', '/onboarding', '/guru', '/siswa']

function isProtectedPage(pathname: string) {
  return PROTECTED_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function proxy(request: NextRequest) {
  const response = isProtectedPage(request.nextUrl.pathname) && !request.cookies.has(SESSION_COOKIE)
    ? NextResponse.redirect(new URL('/auth/login', request.url))
    : NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()')
  response.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
