const CACHE_NAME = 'tuturai-static-v1'
const STATIC_ASSETS = [
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
  const isStaticAsset =
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    (['font', 'image', 'script', 'style'].includes(request.destination) ||
      url.pathname.startsWith('/_next/static/'))

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
