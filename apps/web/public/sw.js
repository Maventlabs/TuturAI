const CACHE_NAME = 'tuturai-static-v2'
const STATIC_ASSETS = [
  '/offline.html',
  '/icon.svg',
  '/logo_tuturai.svg',
  '/placeholder.svg',
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('tuturai-static-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  const isNavigation = request.method === 'GET' && request.mode === 'navigate' && url.origin === self.location.origin
  const isStaticAsset =
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    (['font', 'image', 'script', 'style'].includes(request.destination) ||
      url.pathname.startsWith('/_next/static/'))

  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html')),
    )
    return
  }

  if (!isStaticAsset) return

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse

      return fetch(request).then((response) => {
        if (response.ok) {
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        }
        return response
      })
    }),
  )
})
