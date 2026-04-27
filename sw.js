// Cache version — bump this on every deploy to force all clients to update
// Format: secadvisory-vYYYYMMDD so it's easy to see when it was last updated
const CACHE = "secadvisory-v20260427";
const STATIC = ["./", "./index.html", "./manifest.json"];

// Install: cache static assets and immediately take control
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())  // activate immediately, don't wait for old SW to die
  );
});

// Activate: delete ALL old caches, claim all clients immediately
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log("[SW] Deleting old cache:", k);
        return caches.delete(k);
      })))
      .then(() => self.clients.claim())  // take control of all open tabs immediately
      .then(() => {
        // Notify all clients they should reload to get fresh content
        return self.clients.matchAll({ type: "window" }).then(clients => {
          clients.forEach(client => client.postMessage({ type: "SW_UPDATED", version: CACHE }));
        });
      })
  );
});

// Fetch strategy:
// - API calls (onrender, supabase, anthropic): always network, never cache
// - index.html: network-first with cache fallback (always get latest)
// - Other static: cache-first with background network update
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // API calls: always go to network
  if (url.hostname.includes("onrender.com") ||
      url.hostname.includes("supabase.co") ||
      url.hostname.includes("anthropic.com")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: "offline" }),
          { headers: { "Content-Type": "application/json" } })
      )
    );
    return;
  }

  // index.html: network-first so team always gets latest version
  if (url.pathname.endsWith("/") ||
      url.pathname.endsWith("index.html") ||
      url.pathname === "/security-advisory-dashboard/" ||
      url.pathname === "/security-advisory-dashboard/index.html") {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then(resp => {
          if (resp && resp.status === 200) {
            // Update cache with fresh version
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))  // fallback to cache if offline
    );
    return;
  }

  // Other static assets: cache-first with background refresh
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === "GET") {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      });
      return cached || networkFetch;
    })
  );
});
