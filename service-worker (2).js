// ============================================================
//  Kreutzträger Kälteanlage Dashboard – Service Worker
//  Version: 2.1.0
//  Kreutzträger Kältetechnik GmbH & Co. KG
// ============================================================

const CACHE_NAME = 'kt-kaelte-v2.1.0';
const OFFLINE_URL = './offline.html';

const CACHE_FILES = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Install v2.1.0');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(CACHE_FILES);
      })
      .then(function() {
        return self.skipWaiting();
      })
      .catch(function(err) {
        console.error('[SW] Install error:', err);
      })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) {
              console.log('[SW] Delete old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (event.request.url.indexOf('chrome-extension') !== -1) return;

  event.respondWith(
    caches.match(event.request)
      .then(function(cached) {
        // Cache vorhanden → zurückgeben + im Hintergrund aktualisieren
        if (cached) {
          fetch(event.request)
            .then(function(fresh) {
              if (fresh && fresh.ok) {
                caches.open(CACHE_NAME).then(function(c) {
                  c.put(event.request, fresh.clone());
                });
              }
            })
            .catch(function() {});
          return cached;
        }

        // Kein Cache → Netzwerk versuchen
        return fetch(event.request)
          .then(function(response) {
            if (response && response.ok && response.type !== 'opaque') {
              var clone = response.clone();
              caches.open(CACHE_NAME).then(function(c) {
                c.put(event.request, clone);
              });
            }
            return response;
          })
          .catch(function() {
            // Offline-Fallback für HTML-Seiten
            if (event.request.destination === 'document') {
              return caches.match(OFFLINE_URL);
            }
            return new Response('', { status: 408, statusText: 'Offline' });
          });
      })
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;

  var data;
  try { data = event.data.json(); }
  catch(e) { data = { title: 'Kreutzträger Kälteanlage', body: event.data.text() }; }

  var options = {
    body:    data.body || 'Neue Meldung von der Kälteanlage',
    icon:    './icons/icon-192x192.png',
    badge:   './icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag:     data.tag || 'kt-alert',
    renotify: true,
    data:    { url: data.url || './' },
    actions: [
      { action: 'open',    title: 'Dashboard öffnen' },
      { action: 'dismiss', title: 'Schließen' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Kreutzträger Kälteanlage',
      options
    )
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  var url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(list) {
        for (var i = 0; i < list.length; i++) {
          if ('focus' in list[i]) return list[i].focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});

// ── MESSAGE ───────────────────────────────────────────────
self.addEventListener('message', function(event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION' && event.ports[0]) {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('[SW] Kreutzträger Kälteanlage Service Worker v2.1.0 geladen');
