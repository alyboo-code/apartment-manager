// Apartment Manager — service worker (installable PWA + fast loads).
// Strategy: network-first for the app page (so new deploys show immediately,
// cached copy used only when offline); cache-first for static assets. Supabase
// API/auth/realtime is NEVER intercepted — it must always hit the network.
const CACHE = 'apt-mgr-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {})) // don't fail install if one asset 404s
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // never touch writes
  let url;
  try { url = new URL(req.url); } catch { return; }

  // Supabase (data, auth, realtime): always straight to network.
  if (url.hostname.endsWith('supabase.co')) return;

  // The app page: network-first so updates land; fall back to cached shell offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(resp => { const cp = resp.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return resp; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else (icon, manifest, the pinned CDN script): cache-first.
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        try { const cp = resp.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } catch (_) {}
        return resp;
      });
    })
  );
});
