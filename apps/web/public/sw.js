// Basic service worker — offline shell + push
const CACHE = "workspace-v1";
const OFFLINE_URLS = ["/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("/api/")) return; // never cache API
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request) || caches.match("/"))
  );
});

self.addEventListener("push", (e) => {
  if (!e.data) return;
  const payload = e.data.json();
  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { link: payload.link || "/" }
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  let link = e.notification.data?.link || "/";
  // Prevent open redirect — only allow same-origin paths
  try {
    const url = new URL(link, self.location.origin);
    if (url.origin !== self.location.origin) link = "/";
  } catch { link = "/"; }
  e.waitUntil(clients.openWindow(link));
});
