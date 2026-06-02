/* PKFIT service-worker KILL SWITCH
 *
 * The retired dashboard app used to register a scope-"/" service worker that
 * cached the app shell and intercepted every navigation. That cached SW is
 * why returning visitors kept seeing the old app (and why the marketing site
 * appeared to hang) even after the site was repointed.
 *
 * This replacement registers nothing of its own: on activate it purges every
 * cache, unregisters itself, and reloads any open tab so the next load comes
 * straight from the network. A returning browser fetches /sw.js on its next
 * navigation, sees this changed file, installs it, and self-destructs.
 *
 * There is intentionally NO fetch handler — nothing is intercepted or served
 * from cache.
 */

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for old clients to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Delete every cache the old SW (or any version) created.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      // 2. Remove this service worker so nothing controls the page anymore.
      await self.registration.unregister();

      // 3. Reload open tabs so they re-fetch fresh, uncontrolled content.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        if ('navigate' in client) {
          client.navigate(client.url).catch(() => undefined);
        }
      }
    })(),
  );
});
