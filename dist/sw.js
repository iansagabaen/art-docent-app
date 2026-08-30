// Service worker for Art Docent.
//
// Strategy: network-first for navigations / HTML so a new Netlify deploy is
// picked up on the next online load; the cache is only an offline fallback.
// Hashed files under /assets/ are safe to serve cache-first because their names
// change every build. `skipWaiting` + `clients.claim` (paired with the
// controllerchange reload in index.html) make returning visitors -- especially
// iOS Safari / "Add to Home Screen" installs -- self-heal onto the newest
// version without manually clearing website data.
//
// Bumping CACHE_NAME purges the previous cache (which pinned an old app shell)
// on activate.

const CACHE_NAME = 'art-docent-v2'
const OFFLINE_URLS = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // Data / config JSON: always go to the network.
  if (url.pathname.endsWith('.json')) {
    event.respondWith(fetch(request))
    return
  }

  // Navigations / HTML: network-first, fall back to cache only when offline.
  const isNavigation = request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy))
          return response
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('/index.html'))
        )
    )
    return
  }

  // Everything else (hashed assets, icons, pdfs): cache-first, populate on miss.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        return cached
      }
      return fetch(request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
        }
        return response
      })
    })
  )
})
