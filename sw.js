// Trippone - service worker.
// Pattern lavanderia: rete prima per la shell (cosi' gli aggiornamenti arrivano),
// cache come rete di sicurezza. I documenti cifrati (doc/*.enc) sono cache-first:
// dentro una versione non cambiano, e a ogni deploy la versione ruota e la cache riparte.
// NON aggiornare CACHE_VERSION a mano: lo fa deploy.sh.

const CACHE_VERSION = "trippone-v19";
const FILE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./vendor/leaflet.js",
  "./vendor/leaflet.css",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./dati.enc"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(nomi => Promise.all(nomi.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Tile della mappa e altre origini esterne: rete e basta, mai in cache (peserebbero troppo).
  if(url.origin !== location.origin) return;

  // Documenti cifrati: cache-first.
  if(url.pathname.includes("/doc/")){
    e.respondWith(
      caches.open(CACHE_VERSION).then(async c => {
        const inCache = await c.match(e.request);
        if(inCache) return inCache;
        const r = await fetch(e.request);
        if(r && r.ok) c.put(e.request, r.clone());
        return r;
      })
    );
    return;
  }

  // Tutto il resto (shell + dati.enc): rete prima, cache come fallback.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if(r && r.ok){
          const copia = r.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() =>
        caches.match(e.request).then(r => r || caches.match("./index.html"))
      )
  );
});
