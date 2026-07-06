const CACHE_NAME = "life-planner-mobile-v1";
const APP_SHELL = [
  "/mobile.html",
  "/src/mobile.css",
  "/src/mobile.js",
  "/src/db.js",
  "/src/supabase.js",
  "/manifest.webmanifest",
  "/assets/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("/mobile.html")))
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() || {};
  const title = payload.title || "Life Planner";
  const body = payload.body || "확인할 일정이 있습니다.";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/assets/icon.svg",
    badge: "/assets/icon.svg",
    data: {
      url: payload.url || "/mobile.html"
    }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/mobile.html";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    const existing = clientList.find((client) => client.url.includes(url));
    if (existing) return existing.focus();
    return clients.openWindow(url);
  }));
});
