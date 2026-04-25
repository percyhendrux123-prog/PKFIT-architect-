/* PKFIT service worker
 *
 * Responsibilities:
 *   1. Install / activate lifecycle with a minimal offline shell cache.
 *   2. Network-first navigation handler with offline fallback.
 *   3. Web Push (`push`) → system notification.
 *   4. `notificationclick` → focus existing client or open deep-link from data.url.
 *
 * Versioned caches: bump CACHE_VERSION on shell changes to force refresh.
 */

const CACHE_VERSION = 'pkfit-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Skip cross-origin and API/function calls — let the network handle them.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/.netlify/functions/') || url.pathname.startsWith('/api/')) return;

  // Network-first for navigations; fall back to cached shell on failure.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/').then((cached) => cached || new Response('Offline', { status: 503 })),
      ),
    );
    return;
  }

  // Cache-first for shell static assets.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    }),
  );
});

/* ---------- Web Push ---------- */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'PKFIT', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'PKFIT';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'pkfit-notification',
    renotify: payload.renotify ?? false,
    data: {
      url: payload.url || '/dashboard',
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a same-origin window exists, focus it and navigate.
        for (const client of clientList) {
          if (client.url && new URL(client.url).origin === self.location.origin && 'focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(targetUrl).catch(() => undefined);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        return undefined;
      }),
  );
});
