// Career Board service worker — offline-after-first-visit
// Strategy:
//  - HTML navigations: NetworkFirst (3s timeout), fall back to cached shell
//  - JS/CSS/font/image: StaleWhileRevalidate
const VERSION = "cb-sw-v1";
const RUNTIME = `${VERSION}-runtime`;
const SHELL = `${VERSION}-shell`;
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.add(new Request(SHELL_URL, { cache: "reload" }))).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API or server functions
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn/")) return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const net = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
        ]);
        const cache = await caches.open(SHELL);
        cache.put(SHELL_URL, net.clone()).catch(() => {});
        return net;
      } catch {
        const cache = await caches.open(SHELL);
        const cached = (await cache.match(req)) || (await cache.match(SHELL_URL));
        if (cached) return cached;
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  // Static assets: stale-while-revalidate
  if (/\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|gif)$/i.test(url.pathname) || url.pathname.startsWith("/assets/")) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(req);
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;
    })());
  }
});
