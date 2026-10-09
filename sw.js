/*! Road to LA — service worker
 * Cambia VERSION cada vez que subas cambios: así la app instalada se actualiza.
 */
const VERSION = 'v1.0.1';
const SHELL = `rtla-shell-${VERSION}`;
const IMAGES = 'rtla-images-v1';
const META = 'rtla-meta';
const MAX_IMAGES = 60;
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './manifest.json',
  './assets/fonts/anton-latin-400-normal.woff2',
  './assets/fonts/yellowtail-latin-400-normal.woff2',
  './assets/fonts/manrope-latin-wght-normal.woff2',
  './assets/icons/icon.svg',
  './assets/icons/favicon.svg',
  './assets/icons/favicon-32.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/badge-96.png',
  './assets/scenes/fireworks.svg',
  './assets/scenes/flight.svg',
  './assets/scenes/hero-palms.svg',
  './assets/scenes/lights.svg',
  './assets/scenes/mammoth.svg',
  './assets/scenes/marigold.svg',
  './assets/scenes/neon.svg',
  './assets/scenes/observatory.svg',
  './assets/scenes/pier.svg',
  './assets/scenes/road.svg',
  './assets/scenes/skyline.svg',
  './assets/scenes/sunset.svg',
];

try { importScripts('./data.js'); } catch (e) { /* sin data.js, el recordatorio local usa un texto genérico */ }

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('rtla-shell-') && k !== SHELL).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) { /* opcional */ }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') { event.respondWith(pageNetworkFirst(event)); return; }
  if (url.origin === self.location.origin) { event.respondWith(staleWhileRevalidate(event, req)); return; }
  if (req.destination === 'image' || /(^|\.)wikimedia\.org$/.test(url.hostname)) event.respondWith(imageCacheFirst(req));
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// Páginas: red primero (para recibir cambios), caché si no hay conexión.
async function pageNetworkFirst(event) {
  const cache = await caches.open(SHELL);
  try {
    const preload = await event.preloadResponse;
    const res = preload || await withTimeout(fetch(event.request), 4000);
    if (res && res.ok && !res.redirected) cache.put('./index.html', res.clone());
    return res;
  } catch (e) {
    return (await cache.match('./index.html')) || (await cache.match('./'))
      || new Response('<!doctype html><meta charset="utf-8"><title>Road to LA</title><p>Sin conexión. Abre la app de nuevo cuando tengas internet.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

// Archivos propios: respuesta inmediata desde caché y actualización en segundo plano.
async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (cached) { event.waitUntil(network); return cached; }
  return (await network) || new Response('', { status: 504, statusText: 'Sin conexión' });
}

// Fotos externas: caché primero, con un máximo de entradas.
async function imageCacheFirst(req) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).then(trimImages).catch(() => {});
    return res;
  } catch (e) {
    return Response.error();
  }
}
async function trimImages() {
  const cache = await caches.open(IMAGES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_IMAGES; i++) await cache.delete(keys[i]);
}

// ---------------------------------------------------------------- notificaciones
const ICON = './assets/icons/icon-192.png';
const BADGE = './assets/icons/badge-96.png';

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'ROAD TO LA';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Hay un día nuevo en tu cuenta regresiva.',
    icon: ICON, badge: BADGE, tag: data.tag || 'road-to-la-daily', renotify: true,
    data: { url: data.url || './#today' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './#today', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.startsWith(self.registration.scope)) {
        await client.focus();
        try { await client.navigate(target); } catch (e) { /* cliente no controlado */ }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

// Recordatorio local (Chrome Android con la app instalada): sin servidor, horario aproximado.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'road-to-la-daily') event.waitUntil(localDaily());
});

function crNow() {
  const D = self.ROAD_TO_LA;
  const tz = (D && D.CONFIG.timeZone) || 'America/Costa_Rica';
  try {
    const p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' })
      .formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    return { iso: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
  } catch (e) {
    const t = new Date(Date.now() - 6 * 36e5);
    return { iso: t.toISOString().slice(0, 10), hour: t.getUTCHours() };
  }
}

async function localDaily() {
  const D = self.ROAD_TO_LA;
  const { iso, hour } = crNow();
  if (hour < ((D && D.CONFIG.push.dailyHour) || 8)) return;
  const meta = await caches.open(META);
  const last = await meta.match('./__last-notified');
  if (last && (await last.text()) === iso) return;
  const msg = D ? D.notificationFor(iso) : { title: 'ROAD TO LA', body: 'Hay un día nuevo en tu cuenta regresiva.', url: './#today' };
  if (!msg) return;
  await self.registration.showNotification(msg.title, { body: msg.body, icon: ICON, badge: BADGE, tag: 'road-to-la-daily', data: { url: msg.url } });
  await meta.put('./__last-notified', new Response(iso));
}
