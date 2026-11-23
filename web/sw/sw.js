// TaskMng service worker: keeps the app working offline.
//
// The list of files and the version are filled in at build time by the
// `serviceWorker` plugin in vite.config.ts.

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `taskmng-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // "reload" skips the browser's HTTP cache, which GitHub Pages lets hold
      // pages for 10 minutes — otherwise a fresh install could store a stale
      // copy of the page.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // Pages: always ask the server for the newest version (checking past the
  // browser's own HTTP cache, which could otherwise serve a page up to 10
  // minutes old), and fall back to the cached one when offline. A navigate
  // request can't be given cache options, so it's re-fetched by URL.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request.url, { cache: "no-cache", credentials: "same-origin" })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./", copy));
          return response;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  // Everything else is versioned by the build, so the cache can answer first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

// Tapping a notification brings the app forward, or opens it if it was closed.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => "focus" in client);
      return open ? open.focus() : self.clients.openWindow("./");
    }),
  );
});
