const CACHE = "secadvisory-v3";
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
  if (url.hostname.includes("onrender.com") || url.hostname.includes("supabase.co") || url.hostname.includes("anthropic.com")) {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({error:"offline"}), {headers:{"Content-Type":"application/json"}})
    ));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached => {
    if (cached) return cached;
    return fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && e.request.method === "GET") {
        caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
      }
      return resp;
    });
  }));
});
