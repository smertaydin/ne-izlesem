// Ne İzlesem offline support.
// App page: served from the phone at once, refreshed in the background (updates show on the next launch).
// Data: fetched live; the last copy is used when there is no connection.
// Images: kept on the phone after the first view.
const SHELL = "ni-shell-v1";
const DATA = "ni-data-v1";
const IMAGES = "ni-img-v1";
const KEEP = [SHELL, DATA, IMAGES];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["./", "./icon-180.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const cached = await cache.match("./");
      const fresh = fetch(req).then((r) => { if (r.ok) cache.put("./", r.clone()); return r; }).catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      return (await fresh) || Response.error();
    })());
    return;
  }

  if (url.hostname.endsWith(".supabase.co") && url.pathname.endsWith("/film-rehberi")) {
    e.respondWith((async () => {
      const cache = await caches.open(DATA);
      try {
        const r = await fetch(req);
        if (r.ok && url.searchParams.get("action") !== "img") { await cache.put(req, r.clone()); e.waitUntil(trim(DATA, 200)); }
        return r;
      } catch (err) {
        const c = await cache.match(req);
        if (c) return c;
        throw err;
      }
    })());
    return;
  }

  if (url.hostname === "images.justwatch.com") {
    e.respondWith((async () => {
      const cache = await caches.open(IMAGES);
      const c = await cache.match(req);
      if (c) return c;
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") { await cache.put(req, r.clone()); e.waitUntil(trim(IMAGES, 400)); }
      return r;
    })());
  }
});
