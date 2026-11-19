/* Offline support: the app keeps working without signal in Japan. */
const CACHE = "tabi-v3";
const SHELL = [
  "./", "./index.html", "./css/styles.css",
  "./js/app.js", "./js/activities.js", "./js/importer.js",
  "./js/vendor/pdf.min.js", "./js/vendor/pdf.worker.min.js",
  "./fonts/baloo-2-latin-wght-normal.woff2", "./fonts/baloo-2-latin-ext-wght-normal.woff2",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates show up), falling back to the cache when offline.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && (res.ok || res.type === "opaque")) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
