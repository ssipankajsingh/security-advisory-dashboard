// Cache version — bump this on every deploy to force cache refresh across all browsers
const CACHE = "secadvisory-v20260512";
const STATIC = ["./", "./index.html", "./manifest.json"];

// Install: cache static assets and skip waiting immediately
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())  // Activate new SW immediately without waiting
  );
});

// Activate: delete ALL old caches, claim all clients immediately
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log("[SW] Deleting old cache:", k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())  // Take control of all open tabs immediately
      .then(() => {
        // Notify all clients to reload after cache update
        self.clients.matchAll({type:"window"}).then(clients => {
          clients.forEach(client => client.postMessage({type:"SW_UPDATED", version:CACHE}));
        });
      })
  );
});

// Fetch: network-first for HTML (always get fresh index.html), cache-first for assets
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Always bypass SW for API calls — never cache proxy/supabase responses
  if (
    url.hostname.includes("onrender.com") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("anthropic.com") ||
    url.hostname.includes("nvd.nist.gov") ||
    url.hostname.includes("first.org")
  ) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({error:"offline"}), {
          headers:{"Content-Type":"application/json"}
        })
      )
    );
    return;
  }

  // Network-first for HTML pages — ensures index.html is always fresh
  if (e.request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname === "/security-advisory-dashboard/") {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))  // Fallback to cache if offline
    );
    return;
  }

  // Cache-first for other static assets (manifest, icons)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === "GET") {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      });
    })
  );
});

// Handle SKIP_WAITING message from clients (forces immediate activation)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
