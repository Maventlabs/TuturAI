// Runtime security checks for the deployed TuturAI web app.
//
// Verifies the production boundary WITHOUT needing credentials:
//   1. security headers on public pages (CSP, HSTS, X-Content-Type-Options,
//      X-Frame-Options, Referrer-Policy, Permissions-Policy, no X-Powered-By)
//   2. protected API routes return a structured 401 JSON envelope, not a
//      redirect and not an empty 200
//   3. no server secret is inlined into the browser bundle
//   4. protected pages redirect unauthenticated users instead of serving HTML
//
// Usage:
//   node scripts/e2e-security-headers.mjs                        # local next start
//   SECURITY_BASE_URL=https://tuturai-apps.netlify.app node scripts/e2e-security-headers.mjs
//
// Deliberately credential-free so it can run without an E2E account.
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const BASE_URL = (process.env.SECURITY_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
// HSTS is a Netlify edge header (netlify.toml); a local `next start` cannot
// emit it, so that assertion only runs against the deployed target.
const IS_NETLIFY_TARGET =
  process.env.SECURITY_TARGET === 'netlify' || /netlify\.app$/.test(new URL(BASE_URL).hostname)

const CONSTRUCT_NEXT = resolve(import.meta.dirname, '..')
const NEXT_DIR = join(CONSTRUCT_NEXT, '.next')

// Only `.next/static/**` is served to the browser. `.next/server/**`,
// `.next/dev/**` and `.next/node_modules/**` never reach a client, so scanning
// them reports framework code strings (e.g. firebase-admin's JSDoc examples and
// the FIREBASE_ADMIN_PRIVATE_KEY validation message) as false positives.
const CLIENT_BUNDLE_DIR = join(NEXT_DIR, 'static')

const results = []
let failures = 0

function check(name, ok, detail) {
  results.push({ name, ok, detail })
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${detail}`}`)
}

async function getJson(url) {
  const response = await fetch(url, { redirect: 'manual' })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { response, text, json }
}

// ----------------------------------------------------------------- headers
async function checkHeaders() {
  console.log(`\n== security headers @ ${BASE_URL} ==`)
  const response = await fetch(`${BASE_URL}/`, { redirect: 'manual' })
  const headers = response.headers

  check('homepage responds 200', response.status === 200, `status=${response.status}`)

  const required = {
    'content-security-policy': 'Content-Security-Policy',
    'x-content-type-options': 'X-Content-Type-Options',
    'x-frame-options': 'X-Frame-Options',
    'referrer-policy': 'Referrer-Policy',
    'permissions-policy': 'Permissions-Policy',
  }
  for (const [key, label] of Object.entries(required)) {
    const value = headers.get(key)
    check(`${label} present`, Boolean(value), `header ${key} missing`)
  }

  // HSTS and the edge header set are applied by the Netlify/CDN layer
  // (netlify.toml), so a local `next start` cannot emit them.
  if (IS_NETLIFY_TARGET) {
    check(
      'Strict-Transport-Security present',
      Boolean(headers.get('strict-transport-security')),
      'header strict-transport-security missing',
    )
    check(
      'HSTS has a max-age',
      /max-age=\d+/.test(headers.get('strict-transport-security') ?? ''),
      `got "${headers.get('strict-transport-security')}"`,
    )
  } else {
    console.log('SKIP  Strict-Transport-Security (Netlify edge header, not emitted by next start)')
  }

  check(
    'X-Content-Type-Options is nosniff',
    (headers.get('x-content-type-options') ?? '').toLowerCase() === 'nosniff',
    `got "${headers.get('x-content-type-options')}"`,
  )
  check(
    'X-Frame-Options is DENY',
    (headers.get('x-frame-options') ?? '').toUpperCase() === 'DENY',
    `got "${headers.get('x-frame-options')}"`,
  )
  check(
    'Permissions-Policy restricts geolocation',
    /geolocation=\(\)/.test(headers.get('permissions-policy') ?? ''),
    `got "${headers.get('permissions-policy')}"`,
  )
  check(
    'powered-by header disabled',
    !headers.get('x-powered-by'),
    `got "${headers.get('x-powered-by')}"`,
  )

  // The CSP must not be the wildcard-ish "default-src *".
  const csp = headers.get('content-security-policy') ?? ''
  check('CSP is not a wildcard', !/default-src\s+\*/.test(csp) && csp.length > 0, `got "${csp}"`)
  check(
    'CSP blocks object-src',
    /object-src\s+'none'/.test(csp),
    `object-src not restricted in "${csp}"`,
  )
  check(
    'CSP sets frame-ancestors none',
    /frame-ancestors\s+'none'/.test(csp),
    `frame-ancestors not set in "${csp}"`,
  )
}

// --------------------------------------------------------- 401 JSON boundary
async function checkAuthBoundary() {
  console.log(`\n== protected API boundary @ ${BASE_URL} ==`)
  const protectedReads = [
    '/api/me',
    '/api/student/dashboard',
    '/api/teacher/leaderboard',
  ]
  for (const path of protectedReads) {
    const { response, text, json } = await getJson(`${BASE_URL}${path}`)
    // An unauthenticated caller must get a real 401 JSON body.
    check(`${path} returns 401`, response.status === 401, `status=${response.status} body=${text.slice(0, 120)}`)
    check(
      `${path} returns structured error JSON`,
      Boolean(json?.error?.code) && typeof json.error.message === 'string',
      `body=${text.slice(0, 160)}`,
    )
    check(
      `${path} error code is UNAUTHENTICATED`,
      json?.error?.code === 'UNAUTHENTICATED',
      `code=${json?.error?.code}`,
    )
    const location = response.headers.get('location')
    check(
      `${path} does not redirect`,
      !(response.status >= 300 && response.status < 400),
      `redirected to ${location}`,
    )
  }

  console.log(`\n== protected page redirect @ ${BASE_URL} ==`)
  for (const path of ['/dashboard', '/siswa', '/guru', '/onboarding']) {
    const response = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' })
    const location = response.headers.get('location') ?? ''
    check(
      `${path} redirects to login`,
      response.status >= 300 && response.status < 400 && location.includes('/auth/login'),
      `status=${response.status} location=${location}`,
    )
    check(
      `${path} redirect is not a 200 page`,
      response.status !== 200,
      `served a page with status 200`,
    )
  }
}

// -------------------------------------------------------------- secret scan
async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

async function collectClientBundle() {
  // Only `.next/static/**` is downloadable by a browser. Scanning
  // `.next/server/**` would flag framework code strings (firebase-admin's JSDoc
  // examples, the FIREBASE_ADMIN_PRIVATE_KEY validation message) that never
  // reach a client, producing false positives.
  const chunks = []
  for await (const file of walk(CLIENT_BUNDLE_DIR)) {
    if (/\.(js|mjs|json|css)$/.test(file)) {
      try {
        const info = await stat(file)
        if (info.size <= 8 * 1024 * 1024) chunks.push(await readFile(file, 'utf8'))
      } catch {
        // Unreadable build artifact; skip it.
      }
    }
  }
  return chunks
}

// Only private values fail. A bare env-var NAME is fine: framework code
// legitimately references process.env.SOMETHING, and grep-level matches on
// those names are not leaks.
const FORBIDDEN_PATTERNS = [
  // A real PEM body (BEGIN marker + base64 + END marker), not a doc comment.
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[A-Za-z0-9+/=\s\r\n]{60,}-----END/, 'PEM private key body'],
  // Private keys assigned to a value rather than merely named.
  [/(?:FIREBASE_ADMIN_PRIVATE_KEY|AI_V1_API_KEY|AI_LOCAL_API_KEY)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{40,}/i, 'private key or API key assigned to a value'],
  [/sk-[A-Za-z0-9]{30,}/, 'OpenAI-style secret key'],
]

async function checkSecretsInBundle() {
  console.log(`\n== browser bundle secret scan (${CLIENT_BUNDLE_DIR}) ==`)
  let bundle
  try {
    bundle = await collectClientBundle()
  } catch {
    console.log('SKIP  no build output found (run a production build first)')
    return
  }
  if (bundle.length === 0) {
    console.log('SKIP  no .next/static artifacts to scan (run a production build first)')
    return
  }

  const joined = bundle.join('\n')
  for (const [pattern, label] of FORBIDDEN_PATTERNS) {
    const hit = joined.match(pattern)
    check(`${label} not in client bundle`, !hit, hit ? `matched "${hit[0].slice(0, 40)}..."` : '')
  }

  // Private server env vars must never gain a NEXT_PUBLIC_ alias, which is the
  // only way a server secret can actually reach a browser.
  for (const name of ['AI_V1_API_KEY', 'AI_LOCAL_API_KEY', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_PRIVATE_KEY']) {
    const publicName = `NEXT_PUBLIC_${name}`
    check(`${publicName} not in client bundle`, !joined.includes(publicName), `found ${publicName}`)
  }

  // Sanity check in the other direction: the intended public config must be
  // present, otherwise the scan would silently pass on an empty bundle.
  check(
    'public Firebase config is intentionally present (scan sanity)',
    joined.includes('NEXT_PUBLIC_FIREBASE_API_KEY') || joined.includes('gen-lang-client'),
    'scan may have gathered nothing - verify the build output exists',
  )

  console.log(`      (scanned ${bundle.length} client artifacts under .next/static)`)
}

// ------------------------------------------------------------ PWA artifacts
async function checkPwaArtifacts() {
  console.log(`\n== PWA artifacts ==`)
  const { response: manRes, json: manifest } = await getJson(`${BASE_URL}/manifest.webmanifest`)
  check('manifest served as JSON', manRes.status === 200 && Boolean(manifest), `status=${manRes.status}`)
  check(
    'manifest declares 192 and 512 icons',
    (manifest?.icons ?? []).some((i) => i.sizes === '192x192') &&
      (manifest?.icons ?? []).some((i) => i.sizes === '512x512'),
    `icons=${JSON.stringify(manifest?.icons ?? [])}`,
  )
  check(
    'manifest declares a maskable icon',
    (manifest?.icons ?? []).some((i) => i.purpose === 'maskable'),
    'maskable icon missing',
  )
  check('manifest start_url set', manifest?.start_url === '/', `start_url=${manifest?.start_url}`)
  check('manifest theme_color is brand blue', manifest?.theme_color === '#2f6df5', `theme_color=${manifest?.theme_color}`)
  check('manifest background_color is brand canvas', manifest?.background_color === '#f5f5f7', `background_color=${manifest?.background_color}`)

  const sw = await fetch(`${BASE_URL}/sw.js`, { redirect: 'manual' })
  const swBody = await sw.text()
  check('service worker served', sw.status === 200, `status=${sw.status}`)
  check('service worker handles fetch', swBody.includes("addEventListener('fetch'"), 'no fetch handler')
  check('service worker registers an install cache', swBody.includes("addEventListener('install'"), 'no install handler')

  for (const iconPath of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/brand/logo-icon.png']) {
    const r = await fetch(`${BASE_URL}${iconPath}`, { redirect: 'manual' })
    check(`${iconPath} served`, r.status === 200, `status=${r.status}`)
  }
}

await checkHeaders()
await checkAuthBoundary()
await checkSecretsInBundle()
await checkPwaArtifacts()

console.log(`\n${'='.repeat(52)}`)
if (failures === 0) {
  console.log('SECURITY/PWA RUNTIME CHECKS PASS')
} else {
  console.log(`SECURITY/PWA RUNTIME CHECKS FAILED: ${failures} failing check(s)`)
  for (const result of results.filter((r) => !r.ok)) {
    console.log(`  - ${result.name}`)
  }
}
process.exit(failures === 0 ? 0 : 1)
