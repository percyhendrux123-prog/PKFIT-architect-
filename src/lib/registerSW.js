// Service worker registration helper.
// Production-only: keeps Vite HMR clean in dev (no SW caches in your face).

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        console.warn('[pkfit] SW registration failed:', err);
      });
  });
}
