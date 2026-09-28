importScripts("./precache.js");
const CACHE = self.KINFORGE_CACHE;
const PUBLIC_HOST = "kinforge-genealogy-studio-public.marianneleong3.chatgpt.site";
const isPublicMarketingHost = self.location.hostname === PUBLIC_HOST;
self.addEventListener("install", event => {
  if (isPublicMarketingHost) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(self.KINFORGE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  if (isPublicMarketingHost) {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("kinforge-")).map(key => caches.delete(key)))).then(() => self.registration.unregister()).then(() => self.clients.claim()));
    return;
  }
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("kinforge-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (isPublicMarketingHost && request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html")) {
    event.respondWith(Response.redirect("/website/", 302));
    return;
  }
  if (new URL(request.url).pathname.startsWith("/api/") || /\/(signin-with-chatgpt|signout-with-chatgpt|callback)/.test(new URL(request.url).pathname)) return;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(new URL("./index.html", self.location.href), { ignoreVary: true })));
    return;
  }
  // Same-origin hashed assets are identical regardless of the request Origin header.
  event.respondWith(caches.match(request, { ignoreVary: true }).then(cached => cached || fetch(request)));
});
