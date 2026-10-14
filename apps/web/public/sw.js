/*
 * TuturAI service worker.
 *
 * Behaviour that matters:
 *  - `skipWaiting()` + `clients.claim()` so the worker controls the very first
 *    visit after install. Without a controller, PWABuilder (and Chrome's own
 *    install criteria) report "no service worker" and refuse to offer install.
 *  - Navigation requests are network-first with an offline fallback, so a fresh
 *    deploy is picked up immediately while a dropped connection still renders
 *    the offline shell instead of the browser's dinosaur page.
 *  - Static assets are cache-first because Next.js fingerprints their URLs.
 */
const CACHE_VERSION = 'v5'
const CACHE_NAME = `tuturai-static-${CACHE_VERSION}`

// Only same-origin paths that are guaranteed to exist. A missing entry would
// make `addAll` reject and abort the whole install.
const PRECACHE_URLS = [
  '/offline.html',
  '/brand/logo-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Individual adds so one bad URL cannot fail the entire install.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
        ),
      ),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('tuturai-static-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  // Navigations: prefer the network so a new deploy is used immediately, then
  // fall back to the offline shell when the network is unavailable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        return (
          (await cache.match(request)) ??
          (await cache.match('/offline.html')) ??
          new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        )
      }),
    )
    return
  }

  // Immutable build output and static media: cache-first.
  const isCacheable =
    ['font', 'image', 'script', 'style'].includes(request.destination) ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/')

  if (!isCacheable) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match('/offline.html'))
    }),
  )
})