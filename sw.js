// Bump CACHE on any sw.js change so old caches are dropped on activate.
const CACHE = "secadvisory-v5";
const STATIC = ["./", "./index.html", "./manifest.json"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Cross-origin (API backend on Render/Azure, Supabase, Anthropic, CDNs): always network.
  // Never cache API responses — stale advisory data is worse than an offline error.
  if (url.origin !== self.location.origin) {
    if (e.request.method !== "GET" || /onrender\.com|azurecontainerapps\.io|supabase\.co|anthropic\.com/.test(url.hostname)) {
      e.respondWith(fetch(e.request).catch(() =>
        new Response(JSON.stringify({error:"offline"}), {headers:{"Content-Type":"application/json"}})
      ));
    }
    return; // CDN scripts etc. — let the browser handle normally
  }
  // The page itself: network-first so every deploy is picked up; cache only as offline fallback.
  if (e.request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
    e.respondWith(fetch(e.request).then(resp => {
      if (resp && resp.status === 200) {
        const toCache = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, toCache));
      }
      return resp;
    }).catch(() => caches.match(e.request).then(c => c || caches.match("./index.html"))));
    return;
  }
  // Other same-origin static assets (icons, manifest): cache-first.
  e.respondWith(caches.match(e.request).then(cached => {
    if (cached) return cached;
    return fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && e.request.method === "GET") {
        const toCache = resp.clone(); // clone BEFORE returning — body can only be read once
        caches.open(CACHE).then(c => c.put(e.request, toCache));
      }
      return resp;
    });
  }));
});
