// ============================================================
// Vida Organizada — Service Worker
// Cache inteligente: app shell offline + sync quando online
// ============================================================

const CACHE_NAME = 'vida-organizada-v1.5';
const APP_SHELL = [
  '/vida-organizada/',
  '/vida-organizada/index.html',
  '/vida-organizada/manifest.json',
  '/vida-organizada/icons/icon-192.png',
  '/vida-organizada/icons/icon-512.png',
];

// Recursos externos que também queremos cachear
const EXTERNAL_CACHE = [
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// ── INSTALL: pré-cacheia o app shell ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // App shell local — crítico
      cache.addAll(APP_SHELL).catch(() => {});
      // Externos — melhor esforço
      EXTERNAL_CACHE.forEach(url => cache.add(url).catch(() => {}));
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpa caches antigos ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: estratégia Cache-First para shell, Network-First para API ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requisições ao Apps Script (API) — sempre tenta rede primeiro
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ success: false, error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Fontes e CDN — Cache-First (raramente mudam)
  if (url.hostname.includes('fonts.g') || url.hostname.includes('jsdelivr') || url.hostname.includes('cdnjs')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
      )
    );
    return;
  }

  // App shell (HTML, manifest, ícones) — Cache-First com fallback para index
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        // Offline e não tem cache: retorna o index.html
        caches.match('/vida-organizada/index.html')
      );
    })
  );
});
